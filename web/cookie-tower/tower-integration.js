/* The existing app owns persistence and the timer. This adapter owns only its tower ledger. */
(function (root, factory) {
  const Core = typeof module === 'object' && module.exports ? require('./tower-core.js') : root.CookieTowerCore;
  const api = factory(Core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CookieTowerIntegration = api;
})(globalThis, function (Core) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const whole = value => Math.max(0, Math.floor(Number(value) || 0));
  const id = () => globalThis.crypto?.randomUUID?.() || `app-focus-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function isClassGap(classes, minimum, at = Date.now()) {
    const date = new Date(at + 9 * 3600000), day = date.getUTCDay();
    const minute = date.getUTCHours() * 60 + date.getUTCMinutes();
    const toMinutes = text => { const [h, m] = String(text).split(':').map(Number); return h * 60 + m; };
    const items = (classes || []).filter(item => item.day === day).sort((a, b) => a.start.localeCompare(b.start));
    // Merge overlapping classes before checking the gaps between them.
    const intervals = [];
    for (const item of items) {
      const start = toMinutes(item.start), end = toMinutes(item.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      const previous = intervals.at(-1);
      if (previous && start <= previous.end) previous.end = Math.max(previous.end, end);
      else intervals.push({ start, end });
    }
    for (let i = 0; i < intervals.length - 1; i++) {
      const end = intervals[i].end, next = intervals[i + 1].start;
      if (next - end >= Math.max(0, Number(minimum) || 0) && minute >= end && minute < next) return true;
    }
    return false;
  }
  function month(state, at) {
    const key = Core.monthKey(at);
    return state.months[key] || (state.months[key] = Core.createState(at).months[key]);
  }
  function mirror(app, at) {
    const record = Core.summary(app.cookieTower, at);
    app.cookieRewards ||= { history: [] };
    app.cookieRewards.loose = record.cookies;
    app.cookieRewards.boxes = 0;
    app.cookieRewards.gapBonus = record.gapHours + (record.importedGapBonus || 0);
    return record;
  }
  function initialize(app, at = Date.now()) {
    if (app.cookieTower?.version === 1) { Core.rollover(app.cookieTower, at); return mirror(app, at); }
    const tower = Core.createState(at), old = copy(app.cookieRewards || {});
    app.cookieTower = tower;
    tower.migration = { version: 1, at, originalRewards: old, undatedCookies: 0 };
    let remaining = whole(old.loose) + whole(old.boxes) * 10;
    const entries = (old.history || []).filter(entry => Number.isFinite(Number(entry.at)) && Number(entry.at) > 0 && Number(entry.at) <= at).sort((a, b) => Number(b.at) - Number(a.at));
    for (const entry of entries) {
      const count = Math.min(remaining, whole(entry.count));
      if (!count) continue;
      const record = month(tower, Number(entry.at));
      record.cookies += count;
      record.importedCookies = (record.importedCookies || 0) + count;
      if (entry.gapBonus) record.importedGapBonus = (record.importedGapBonus || 0) + count;
      remaining -= count;
    }
    // Old versions kept only 30 reward entries. Preserve the unmatched balance once,
    // visibly marked as imported, rather than inventing dates for missing history.
    if (remaining) {
      const record = month(tower, at);
      record.cookies += remaining;
      record.importedCookies = (record.importedCookies || 0) + remaining;
      record.undatedCookies = remaining;
      tower.migration.undatedCookies = remaining;
    }
    for (const record of app.dailyRecords || []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date || '')) continue;
      const when = Date.parse(`${record.date}T12:00:00+09:00`);
      if (Number.isFinite(when) && when <= at + 86400000) month(tower, when).focusSeconds += Math.min(86400, whole(record.focusSeconds));
    }
    const f = app.focus || (app.focus = {});
    f.towerObservedSeconds = whole(f.sessionSeconds);
    f.towerSeconds = f.active && !f.deviation ? whole(f.sessionSeconds) : 0;
    f.towerSessionId = null;
    if (f.active && !f.deviation) {
      f.towerSessionId = id();
      // The old app has already paid these hours. Carry the remainder and tier,
      // but never replay them as new rewards when first connecting or reloading.
      tower.sessions[f.towerSessionId] = { seconds: f.towerSeconds, at, ended: false };
    }
    return mirror(app, at);
  }
  function reconcile(app, at = Date.now()) { return initialize(app, at); }
  function begin(app, at = Date.now()) {
    initialize(app, at);
    const f = app.focus;
    if (f.towerSessionId && app.cookieTower.sessions[f.towerSessionId]) app.cookieTower.sessions[f.towerSessionId].ended = true;
    f.towerSessionId = id();
    f.towerSeconds = 0;
    f.towerObservedSeconds = whole(f.sessionSeconds);
    Core.syncSession(app.cookieTower, { sessionId: f.towerSessionId, totalSeconds: 0, at }, at);
    return f.towerSessionId;
  }
  function progress(app, at = Date.now()) {
    initialize(app, at);
    const f = app.focus, result = { cookies: 0, hours: [] };
    if (!f.active || f.deviation) return result;
    if (!f.towerSessionId) begin(app, at);
    const observed = whole(f.sessionSeconds), previousObserved = whole(f.towerObservedSeconds);
    const delta = Math.max(0, observed - previousObserved);
    if (!delta) return result;
    const previous = whole(f.towerSeconds), next = previous + delta;
    const boundaries = [];
    for (let hour = Math.floor(previous / 3600) + 1; hour <= Math.floor(next / 3600); hour++) boundaries.push(hour * 3600);
    if (boundaries.at(-1) !== next) boundaries.push(next);
    for (const seconds of boundaries) {
      const observedAt = at - (next - seconds) * 1000;
      const earned = Core.syncSession(app.cookieTower, {
        sessionId: f.towerSessionId, totalSeconds: seconds, at: observedAt,
        isGap: isClassGap(app.classes, app.settings?.gapMinutes ?? 30, observedAt)
      }, at);
      result.cookies += earned.cookies;
      result.hours.push(...earned.hours);
    }
    f.towerSeconds = next;
    f.towerObservedSeconds = observed;
    f.rewardedHours = Math.floor(next / 3600);
    if (result.hours.length) {
      const history = app.cookieRewards.history || [];
      app.cookieRewards.history = [...result.hours].reverse().map(entry => ({ ...entry, gapBonus: entry.cookies === 2, source: 'monthly-tower' })).concat(history).slice(0, 200);
    }
    mirror(app, at);
    return result;
  }
  function end(app, at = Date.now()) {
    const result = progress(app, at), f = app.focus;
    if (f.towerSessionId && app.cookieTower.sessions[f.towerSessionId]) app.cookieTower.sessions[f.towerSessionId].ended = true;
    f.towerSessionId = null;
    f.towerSeconds = 0;
    f.towerObservedSeconds = whole(f.sessionSeconds);
    return result;
  }
  function summary(app, at = Date.now()) { reconcile(app, at); return Core.summary(app.cookieTower, at); }
  function history(app, at = Date.now()) {
    reconcile(app, at);
    return Object.values(app.cookieTower.months).sort((a, b) => b.month.localeCompare(a.month)).map(copy);
  }
  return { initialize, reconcile, begin, progress, end, summary, history, isClassGap };
});
