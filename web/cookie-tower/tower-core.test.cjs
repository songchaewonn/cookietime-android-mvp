const { test } = require('node:test');
const assert = require('node:assert/strict');
const Core = require('./tower-core.js');
const at = text => new Date(text).getTime();
const NOV = at('2026-11-12T12:00:00+09:00');
function memoryStore(clock = () => NOV) {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  return { store: Core.createStore({ storage, clock }), storage };
}
test('completed hours only; the fifth and later consecutive hours award five without stacking gap bonuses', () => {
  assert.equal(Core.rewardForHour(1), 1);
  assert.equal(Core.rewardForHour(4, true), 2);
  assert.equal(Core.rewardForHour(5), 5);
  assert.equal(Core.rewardForHour(6, true), 5);
  const state = Core.createState(NOV);
  assert.equal(Core.syncSession(state, { sessionId: 'a', totalSeconds: 3599, at: NOV }, NOV).cookies, 0);
  assert.equal(Core.syncSession(state, { sessionId: 'a', totalSeconds: 3600, at: NOV + 1000 }, NOV + 1000).cookies, 1);
  assert.equal(Core.syncSession(state, { sessionId: 'a', totalSeconds: 21600, at: NOV + 18001000 }, NOV + 18001000).cookies, 13);
  assert.equal(Core.summary(state, NOV).cookies, 14);
});
test('gap context at each completed-hour boundary and a break resets the five-hour tier', () => {
  let now = NOV;
  const { store } = memoryStore(() => now);
  store.syncSession({ sessionId: 'gap', totalSeconds: 14400, isGap: true, at: now });
  now += 3600000;
  assert.equal(store.syncSession({ sessionId: 'gap', totalSeconds: 18000, isGap: true, at: now }).result.cookies, 5);
  store.endSession('gap');
  now += 3600000;
  assert.equal(store.syncSession({ sessionId: 'after-break', totalSeconds: 3600, at: now }).result.cookies, 1);
  assert.equal(store.summary().cookies, 14);
});
test('identical, stale, and already-ended session snapshots cannot award the same hour twice, even after reload', () => {
  const { store, storage } = memoryStore();
  const input = { sessionId: 'once', totalSeconds: 3600, at: NOV };
  assert.equal(store.syncSession(input).result.cookies, 1);
  const reloaded = Core.createStore({ storage, clock: () => NOV });
  assert.equal(reloaded.syncSession(input).result.cookies, 0);
  assert.equal(reloaded.syncSession({ ...input, totalSeconds: 1200 }).result.cookies, 0);
  reloaded.endSession('once');
  assert.equal(reloaded.syncSession({ ...input, totalSeconds: 7200 }).result.cookies, 0);
  assert.equal(reloaded.summary().cookies, 1);
});
test('Korean midnight on the first starts a zero-cookie tower and preserves the past month', () => {
  const before = at('2026-11-30T23:59:59+09:00'), after = at('2026-12-01T00:00:00+09:00');
  const state = Core.createState(before);
  Core.syncSession(state, { sessionId: 'nov', totalSeconds: 3600, at: before }, before);
  Core.rollover(state, after);
  assert.equal(state.activeMonth, '2026-12');
  assert.equal(Core.summary(state, after).cookies, 0);
  assert.equal(state.months['2026-11'].cookies, 1);
  assert.equal(state.months['2026-11'].focusSeconds, 3600);
});
test('a running session crossing months credits each hour to its completion month and splits focus time', () => {
  const end = at('2026-12-01T00:30:00+09:00'), state = Core.createState(end - 7200000);
  const result = Core.syncSession(state, { sessionId: 'cross', totalSeconds: 7200, at: end }, end);
  assert.deepEqual(result.hours.map(hour => hour.month), ['2026-11', '2026-12']);
  assert.equal(state.months['2026-11'].focusSeconds, 5400);
  assert.equal(state.months['2026-12'].focusSeconds, 1800);
  assert.equal(Core.summary(state, end).cookies, 1);
  const midnight = at('2026-12-01T00:00:00+09:00'), exact = Core.createState(midnight);
  Core.syncSession(exact, { sessionId: 'exact', totalSeconds: 3600, at: midnight }, midnight);
  assert.equal(exact.months['2026-12'].cookies, 1);
  assert.equal(exact.months['2026-11'].cookies, 0);
});
test('a session keeps its continuous tier through month rollover without modifying old rewards', () => {
  const start = at('2026-11-30T19:30:00+09:00'), state = Core.createState(start);
  Core.syncSession(state, { sessionId: 'long', totalSeconds: 14400, at: start + 14400000 }, start + 14400000);
  const novemberCookies = state.months['2026-11'].cookies;
  const result = Core.syncSession(state, { sessionId: 'long', totalSeconds: 18000, at: start + 18000000 }, start + 18000000);
  assert.equal(novemberCookies, 4);
  assert.equal(state.months['2026-11'].cookies, 4);
  assert.equal(result.cookies, 5);
  assert.equal(state.months['2026-12'].cookies, 5);
});
test('month rollover also handles December to January and unopened months', () => {
  const state = Core.createState(at('2026-12-01T00:00:00+09:00'));
  state.months['2026-12'].cookies = 9;
  const now = at('2027-03-01T00:00:00+09:00');
  Core.rollover(state, now);
  assert.equal(state.activeMonth, '2027-03');
  assert.equal(Core.summary(state, now).cookies, 0);
  assert.equal(state.months['2026-12'].cookies, 9);
  assert.equal(Core.monthKey(at('2026-12-31T15:00:00Z')), '2027-01');
});
test('live timer catches up after reload, stops cleanly, and resumes with a new session', () => {
  let now = NOV;
  const { store, storage } = memoryStore(() => now);
  const runner = store.start();
  assert.equal(store.start().id, runner.id);
  now += 3600000;
  const reloaded = Core.createStore({ storage, clock: () => now });
  assert.equal(reloaded.tick().result.cookies, 1);
  assert.equal(reloaded.tick().result.cookies, 0);
  reloaded.stop();
  assert.equal(reloaded.read().runner, null);
  const next = reloaded.start(true);
  assert.notEqual(next.id, runner.id);
  now += 3600000;
  assert.equal(reloaded.stop().result.cookies, 2);
  assert.equal(reloaded.summary().cookies, 3);
});
test('stage boundaries use the requested 100m and 10,000m thresholds', () => {
  assert.equal(Core.stageFor(99).id, 'forest');
  assert.equal(Core.stageFor(100).id, 'mountain');
  assert.equal(Core.stageFor(999).id, 'mountain');
  assert.equal(Core.stageFor(1000).id, 'cloud');
  assert.equal(Core.stageFor(9999).id, 'cloud');
  assert.equal(Core.stageFor(10000).id, 'space');
});
test('invalid snapshots fail before they mutate records', () => {
  const state = Core.createState(NOV), original = JSON.stringify(state);
  for (const input of [
    { sessionId: '__proto__', totalSeconds: 3600, at: NOV },
    { sessionId: 'negative', totalSeconds: -1, at: NOV },
    { sessionId: 'fractional', totalSeconds: 3.1, at: NOV },
    { sessionId: 'future', totalSeconds: 3600, at: NOV + 2000 }
  ]) assert.throws(() => Core.syncSession(state, input, NOV));
  assert.equal(JSON.stringify(state), original);
  Core.syncSession(state, { sessionId: 'speed', totalSeconds: 0, at: NOV }, NOV);
  assert.throws(() => Core.syncSession(state, { sessionId: 'speed', totalSeconds: 3600, at: NOV + 1000 }, NOV + 1000));
});
