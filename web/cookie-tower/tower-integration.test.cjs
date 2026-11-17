const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const Core = require('./tower-core.js');
const Integration = require('./tower-integration.js');
const at = value => Date.parse(value);
const NOV = at('2026-11-13T09:30:00+09:00');
function app() {
  return { focus: { active: false, deviation: false, sessionSeconds: 0 }, settings: { gapMinutes: 30 }, classes: [], cookieRewards: { loose: 0, boxes: 0, gapBonus: 0, history: [] }, dailyRecords: [] };
}
function start(state, now) { state.focus.active = true; Integration.begin(state, now); }
test('migration preserves the entire balance exactly once, assigns dated entries to their month, and backs up the old data', () => {
  const state = app();
  state.cookieRewards = { loose: 10, boxes: 2, gapBonus: 1, history: [
    { count: 2, at: NOV - 1000 }, { count: 3, at: at('2026-10-15T12:00:00+09:00') }
  ] };
  const old = JSON.stringify(state.cookieRewards);
  Integration.initialize(state, NOV);
  assert.equal(state.cookieTower.months['2026-10'].cookies, 3);
  assert.equal(state.cookieTower.months['2026-11'].cookies, 27);
  assert.equal(state.cookieTower.migration.undatedCookies, 25);
  assert.equal(JSON.stringify(state.cookieTower.migration.originalRewards), old);
  Integration.initialize(state, NOV);
  assert.equal(Object.values(state.cookieTower.months).reduce((n, record) => n + record.cookies, 0), 30);
  assert.equal(state.cookieRewards.loose, 27);
});
test('connecting an already running session carries the partial hour without replaying previously rewarded hours', () => {
  const state = app();
  state.focus.active = true; state.focus.sessionSeconds = 17999;
  state.cookieRewards.loose = 4;
  Integration.initialize(state, NOV);
  state.focus.sessionSeconds++;
  assert.equal(Integration.progress(state, NOV + 1000).cookies, 5);
  assert.equal(state.cookieRewards.loose, 9);
  assert.equal(Integration.progress(state, NOV + 1000).cookies, 0);
  const reloaded = JSON.parse(JSON.stringify(state));
  assert.equal(Integration.progress(reloaded, NOV + 1000).cookies, 0);
});
test('regular six-hour focus uses only the new reward ledger and yields fourteen cookies', () => {
  const state = app(); start(state, NOV);
  state.focus.sessionSeconds = 21600;
  assert.equal(Integration.progress(state, NOV + 21600000).cookies, 14);
  assert.equal(state.cookieRewards.loose, 14);
  assert.equal(state.cookieRewards.history.reduce((n, entry) => n + entry.cookies, 0), 14);
  assert.equal(Integration.summary(state, NOV + 21600000).focusSeconds, 21600);
});
test('timetable gap is evaluated at each earned-hour boundary when a delayed tick spans several hours', () => {
  const state = app();
  state.classes = [{ day: 5, start: '09:00', end: '10:00' }, { day: 5, start: '13:00', end: '14:00' }];
  start(state, NOV); state.focus.sessionSeconds = 21600;
  const result = Integration.progress(state, NOV + 21600000);
  assert.deepEqual(result.hours.map(entry => entry.cookies), [2, 2, 2, 1, 5, 5]);
  assert.equal(state.cookieRewards.loose, 17);
  assert.equal(state.cookieRewards.gapBonus, 3);
});
test('short breaks reset the uninterrupted tier and incomplete hours do not carry across a break', () => {
  const state = app(); start(state, NOV);
  state.focus.sessionSeconds = 1800; Integration.end(state, NOV + 1800000);
  state.focus.deviation = true;
  state.focus.deviation = false; Integration.begin(state, NOV + 1860000);
  state.focus.sessionSeconds = 3600;
  assert.equal(Integration.progress(state, NOV + 3660000).cookies, 0);
  state.focus.sessionSeconds += 1800;
  assert.equal(Integration.progress(state, NOV + 5460000).cookies, 1);
  assert.equal(state.focus.towerSeconds, 3600);
});
test('the old five-hour tier does not survive a break', () => {
  const state = app(); start(state, NOV);
  state.focus.sessionSeconds = 18000; Integration.end(state, NOV + 18000000);
  Integration.begin(state, NOV + 18060000);
  state.focus.sessionSeconds += 3600;
  assert.equal(Integration.progress(state, NOV + 21660000).cookies, 1);
  assert.equal(state.cookieRewards.loose, 10);
});
test('new month resets the app cookie balance as well as the tower and keeps last month intact', () => {
  const before = at('2026-11-30T23:30:00+09:00'), state = app();
  state.cookieRewards.loose = 8; Integration.initialize(state, before);
  start(state, before); state.focus.sessionSeconds = 3600;
  const end = at('2026-12-01T00:30:00+09:00');
  Integration.progress(state, end);
  assert.equal(state.cookieRewards.loose, 1);
  assert.equal(state.cookieTower.months['2026-11'].cookies, 8);
  assert.equal(state.cookieTower.months['2026-12'].cookies, 1);
  assert.equal(state.cookieTower.months['2026-11'].focusSeconds, 1800);
  assert.equal(state.cookieTower.months['2026-12'].focusSeconds, 1800);
});
test('gap detection uses Korean time, excludes class time and the end boundary, and merges overlapping classes', () => {
  const classes = [{ day: 5, start: '09:00', end: '11:00' }, { day: 5, start: '10:00', end: '12:00' }, { day: 5, start: '13:00', end: '14:00' }];
  assert.equal(Integration.isClassGap(classes, 30, at('2026-11-13T11:30:00+09:00')), false);
  assert.equal(Integration.isClassGap(classes, 30, at('2026-11-13T12:00:00+09:00')), true);
  assert.equal(Integration.isClassGap(classes, 30, at('2026-11-13T13:00:00+09:00')), false);
  assert.equal(Integration.isClassGap(classes, 90, at('2026-11-13T12:30:00+09:00')), false);
});
function loadExistingApp() {
  let now = NOV;
  const values = new Map(), intervals = [];
  const node = { innerHTML: '', textContent: '', style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; }, prepend() {}, append() {} };
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const window = { CookieTowerIntegration: Integration, CookieTowerCore: Core, addEventListener() {}, dispatchEvent() {}, scrollTo() {} };
  const context = vm.createContext({ window, location: { hash: '' }, history: { replaceState() {} }, Date: FakeDate, document: { querySelector: () => node, querySelectorAll: () => [], addEventListener() {}, visibilityState: 'visible' }, localStorage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }, sessionStorage: { getItem: () => null, setItem() {} }, navigator: {}, crypto: globalThis.crypto, structuredClone, console, CustomEvent: class {}, setInterval(callback, ms) { intervals.push({ callback, ms }); return intervals.length; }, clearInterval() {}, setTimeout() {}, clearTimeout() {} });
  const root = path.resolve(__dirname, '..');
  // Run the adapter on the same fake clock as the app, rather than the host clock.
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'tower-core.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'tower-integration.js'), 'utf8'), context);
  vm.runInContext('window.CookieTowerCore=CookieTowerCore;window.CookieTowerIntegration=CookieTowerIntegration;', context);
  let source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  source = source.replace('timer=setInterval(pulse,1000);render();syncNativeState();', 'timer=setInterval(pulse,1000);syncNativeState();');
  vm.runInContext(source, context);
  vm.runInContext("render=()=>{};showToast=()=>{};state.settings.onboardingDone=true;state.settings.focusMode='stopwatch';state.classes=[];state.tasks=[];", context);
  return { context, intervals, run: source => vm.runInContext(source, context), advance(seconds) { now += seconds * 1000; }, loadDesign() {
    let design = fs.readFileSync(path.join(root, 'design.js'), 'utf8');
    design = design.replace('render=designRender;', 'render=()=>{};');
    vm.runInContext(design, context);
  } };
}
test('the actual app pulse, save, start, break and resume paths use the monthly ledger once', () => {
  const fixture = loadExistingApp();
  fixture.run("focusAction('start-focus')");
  fixture.advance(3600); fixture.run('pulse()');
  assert.equal(fixture.run('state.cookieRewards.loose'), 1);
  fixture.run("focusAction('deviation')"); fixture.advance(60); fixture.run("focusAction('deviation')");
  fixture.advance(1800); fixture.run('pulse()');
  assert.equal(fixture.run('state.cookieRewards.loose'), 1);
  fixture.advance(1800); fixture.run('pulse()');
  assert.equal(fixture.run('state.cookieRewards.loose'), 2);
  fixture.run('pulse();save()');
  assert.equal(fixture.run('JSON.parse(localStorage.getItem(KEY)).cookieTower.months[CookieTowerCore.monthKey(Date.now())].cookies'.replace('CookieTowerCore.', 'window.CookieTowerCore.')), 2);
});
test('the actual timer stops at its chosen duration while viewing records, without awarding delayed background time', () => {
  const fixture = loadExistingApp(); fixture.loadDesign();
  fixture.run("state.settings.focusMode='timer';state.settings.focusTimerMinutes=75;focusAction('start-focus');page='stats';");
  fixture.advance(7200); fixture.run('pulse()');
  assert.equal(fixture.run('state.focus.sessionSeconds'), 4500);
  assert.equal(fixture.run('state.cookieRewards.loose'), 1);
  fixture.intervals.find(item => item.ms === 250).callback();
  assert.equal(fixture.run('state.focus.active'), false);
  assert.equal(fixture.run('state.cookieRewards.loose'), 1);
});
