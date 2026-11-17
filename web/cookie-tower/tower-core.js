/* Standalone domain module. Works in a browser and in Node without dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CookieTowerCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORAGE_KEY = 'chagok-cookie-tower-v1';
  const HEIGHT_PER_COOKIE = 10;
  const HOUR = 3600;
  const SEOUL_OFFSET = 9 * 3600000;
  const STAGES = [
    { id: 'forest', name: '숲속', min: 0, description: '작은 집중이 자라나는 곳' },
    { id: 'mountain', name: '산 정상', min: 100, description: '어느새 산봉우리보다 높이' },
    { id: 'cloud', name: '구름 위', min: 1000, description: '구름을 지나 더 넓은 하늘로' },
    { id: 'space', name: '우주', min: 10000, description: '너의 집중은 우주까지' }
  ];
  const clone = value => JSON.parse(JSON.stringify(value));
  function timestamp(value) {
    const result = Number(value instanceof Date ? value.getTime() : value);
    if (!Number.isFinite(result) || result < 0) throw new TypeError('유효한 시각이 필요합니다.');
    return result;
  }
  function monthKey(at = Date.now()) { return new Date(timestamp(at) + SEOUL_OFFSET).toISOString().slice(0, 7); }
  function nextMonthAt(at) {
    const d = new Date(timestamp(at) + SEOUL_OFFSET);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - SEOUL_OFFSET;
  }
  function newMonth(key) { return { month: key, cookies: 0, focusSeconds: 0, completedHours: 0, gapHours: 0, streakHours: 0, bestStreakSeconds: 0 }; }
  function ensureMonth(state, key) { return state.months[key] || (state.months[key] = newMonth(key)); }
  function createState(at = Date.now()) {
    const key = monthKey(at);
    return { version: 1, activeMonth: key, months: { [key]: newMonth(key) }, sessions: {}, runner: null, updatedAt: timestamp(at) };
  }
  function rollover(state, at = Date.now()) {
    const key = monthKey(at);
    ensureMonth(state, key);
    state.activeMonth = key;
    state.updatedAt = timestamp(at);
    return state;
  }
  function rewardForHour(hour, isGap = false) {
    if (!Number.isSafeInteger(hour) || hour < 1) throw new TypeError('집중 시간은 1 이상의 정수여야 합니다.');
    return hour >= 5 ? 5 : isGap ? 2 : 1;
  }
  function stageFor(height) { return [...STAGES].reverse().find(stage => height >= stage.min) || STAGES[0]; }
  function summary(state, at = Date.now()) {
    const key = monthKey(at), record = state.months[key] || newMonth(key);
    const height = record.cookies * HEIGHT_PER_COOKIE;
    const stage = stageFor(height), nextStage = STAGES.find(item => item.min > height) || null;
    return { ...clone(record), height, stage, nextStage, remainingCookies: nextStage ? Math.ceil((nextStage.min - height) / HEIGHT_PER_COOKIE) : 0 };
  }
  function addFocusTime(state, from, to) {
    let cursor = from;
    while (cursor < to) {
      const end = Math.min(to, nextMonthAt(cursor));
      ensureMonth(state, monthKey(cursor)).focusSeconds += (end - cursor) / 1000;
      cursor = end;
    }
  }
  /** Cumulative seconds for ONE uninterrupted session. A break requires a new sessionId.
   * isGap describes the timetable context at each completed-hour boundary.
   * For a backfill with changing contexts, submit snapshots at those boundaries. */
  function syncSession(state, input, now = Date.now()) {
    const at = timestamp(input.at ?? now), currentNow = timestamp(now);
    const sessionId = input.sessionId;
    if (typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > 160 || ['__proto__', 'prototype', 'constructor'].includes(sessionId)) throw new TypeError('고유한 sessionId가 필요합니다.');
    const seconds = Number(input.totalSeconds);
    if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 31 * 86400) throw new RangeError('집중 시간은 0~31일 사이의 정수 초여야 합니다.');
    if (at > currentNow + 1000) throw new RangeError('미래의 집중 시간은 적립할 수 없습니다.');
    const previous = Object.hasOwn(state.sessions, sessionId) ? state.sessions[sessionId] : null;
    if (previous?.ended) return { cookies: 0, hours: [], duplicate: true };
    if (previous && (seconds <= previous.seconds || at < previous.at)) return { cookies: 0, hours: [], duplicate: true };
    const previousSeconds = previous?.seconds || 0, delta = seconds - previousSeconds;
    if (previous && delta * 1000 > at - previous.at + 1000) throw new RangeError('실제 경과 시간보다 많이 적립할 수 없습니다.');
    const from = at - delta * 1000;
    if (from < 0) throw new RangeError('집중 시작 시각이 유효하지 않습니다.');
    addFocusTime(state, from, at);
    const result = { cookies: 0, hours: [], duplicate: false };
    for (let hour = Math.floor(previousSeconds / HOUR) + 1; hour <= Math.floor(seconds / HOUR); hour++) {
      const earnedAt = at - (seconds - hour * HOUR) * 1000;
      const count = rewardForHour(hour, Boolean(input.isGap));
      const record = ensureMonth(state, monthKey(earnedAt));
      record.cookies += count;
      record.completedHours++;
      if (hour >= 5) record.streakHours++;
      else if (input.isGap) record.gapHours++;
      result.cookies += count;
      result.hours.push({ hour, cookies: count, at: earnedAt, month: record.month });
    }
    // Record each month's best uninterrupted duration, including a session crossing midnight.
    let cursor = from;
    while (cursor < at) {
      const end = Math.min(at, nextMonthAt(cursor));
      const record = ensureMonth(state, monthKey(cursor));
      record.bestStreakSeconds = Math.max(record.bestStreakSeconds, seconds - (at - end) / 1000);
      cursor = end;
    }
    state.sessions[sessionId] = { seconds, at, isGap: Boolean(input.isGap), ended: false };
    rollover(state, currentNow);
    return result;
  }
  function createStore(options = {}) {
    const storage = options.storage || globalThis.localStorage;
    const clock = options.clock || Date.now, key = options.storageKey || STORAGE_KEY;
    function read() {
      const raw = storage.getItem(key);
      if (!raw) return createState(clock());
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !saved.months || !saved.sessions) throw new Error('타워 저장 데이터를 읽을 수 없습니다.');
      return rollover(saved, clock());
    }
    function write(mutator) {
      const state = read();
      const result = mutator(state);
      storage.setItem(key, JSON.stringify(state));
      return { state: clone(state), result };
    }
    return {
      read,
      summary: () => summary(read(), clock()),
      rollover: () => write(state => rollover(state, clock())).state,
      syncSession: input => write(state => syncSession(state, input, clock())),
      start: (isGap = false) => write(state => {
        if (state.runner) return state.runner;
        const at = clock();
        state.runner = { id: globalThis.crypto?.randomUUID?.() || `focus-${at}-${Math.random().toString(36).slice(2)}`, startedAt: at, isGap: Boolean(isGap) };
        return state.runner;
      }).result,
      tick: () => write(state => {
        if (!state.runner) return { cookies: 0, hours: [] };
        const runner = state.runner, at = clock();
        return syncSession(state, { sessionId: runner.id, totalSeconds: Math.max(0, Math.floor((at - runner.startedAt) / 1000)), isGap: runner.isGap, at }, at);
      }),
      stop: () => write(state => {
        if (!state.runner) return { cookies: 0, hours: [] };
        const runner = state.runner, at = clock();
        const result = syncSession(state, { sessionId: runner.id, totalSeconds: Math.max(0, Math.floor((at - runner.startedAt) / 1000)), isGap: runner.isGap, at }, at);
        if (state.sessions[runner.id]) state.sessions[runner.id].ended = true;
        state.runner = null;
        return result;
      }),
      endSession: sessionId => write(state => {
        if (Object.hasOwn(state.sessions, sessionId)) state.sessions[sessionId].ended = true;
        if (state.runner?.id === sessionId) state.runner = null;
      }),
      history: () => Object.values(read().months).sort((a, b) => b.month.localeCompare(a.month)),
      exportData: () => JSON.stringify(read(), null, 2)
    };
  }
  return { STORAGE_KEY, HEIGHT_PER_COOKIE, STAGES, HOUR, monthKey, nextMonthAt, createState, rollover, rewardForHour, stageFor, summary, syncSession, createStore };
});
