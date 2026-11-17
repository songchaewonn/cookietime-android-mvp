/* Native CookieTime view: shares its timer, timetable, navigation, and save() transaction. */
(function () {
  'use strict';
  const Core = window.CookieTowerCore, Integration = window.CookieTowerIntegration, Art = window.CookieTowerArt;
  const number = value => Number(value).toLocaleString('ko-KR');
  const monthLabel = key => `${key.slice(0, 4)}년 ${Number(key.slice(5))}월`;
  const duration = seconds => `${Math.floor(seconds / 3600)}시간 ${Math.floor(seconds % 3600 / 60)}분`;
  const clock = seconds => `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  let selectedMonth = null, pendingDrops = 0, signature = '', exported = null, exportUrl = null;
  const dialog = document.createElement('dialog');
  dialog.id = 'tower-app-dialog'; dialog.className = 'it-modal';
  dialog.setAttribute('aria-labelledby', 'it-dialog-title');
  document.body.append(dialog);
  function data() {
    const current = Integration.summary(state);
    const record = selectedMonth && selectedMonth !== current.month ? state.cookieTower.months[selectedMonth] : null;
    if (!record) return current;
    const height = record.cookies * Core.HEIGHT_PER_COOKIE;
    return { ...record, height, stage: Core.stageFor(height), archived: true };
  }
  function artMarkup(record, viewHeight, animate = 0) {
    return Art.scene({ count: record.cookies, height: record.height, stage: record.stage, viewHeight, animate })
      .replaceAll('tower-stack', 'it-stack').replaceAll('cookie-piece', 'it-cookie')
      .replaceAll('cloud-drift', 'it-cloud').replaceAll('star-blink', 'it-star');
  }
  function pageMarkup() {
    const record = data();
    return `<section class="integrated-tower ${record.stage.id === 'space' ? 'it-space' : ''}" aria-label="월별 쿠키 타워">
      <svg class="it-scene" viewBox="0 0 390 851" role="img" aria-label="${esc(record.stage.name)}, 쿠키 ${record.cookies}개, 현재 고도 ${record.height}m">${artMarkup(record, 851, Math.min(pendingDrops, 5))}</svg>
      <button class="it-month-button" data-tower-action="history" aria-label="월별 쿠키 기록 보기">${Number(record.month.slice(5))}월 · 쿠키 ${number(record.cookies)}개 <span>⌄</span></button>
      <div class="it-altitude"><button class="it-stage-pill" data-tower-action="stages"><i></i>${esc(record.stage.name)}</button><div><span>현재 고도</span><strong>${number(record.height)}</strong><b>m</b></div><small>${record.archived ? `${monthLabel(record.month)}의 기록` : ''}</small></div>
      ${record.cookies ? '' : `<div class="it-empty"><strong>첫 쿠키를 기다리는 중</strong><span>한 시간의 집중으로 시작해요</span><button data-tower-action="focus">${state.focus.active ? '집중 화면으로 돌아가기' : '집중 시작하기'} ↗</button></div>`}
      <div class="it-earned" role="status"></div>
      <button class="it-share" data-tower-action="share"><svg viewBox="0 0 24 28" aria-hidden="true"><path d="M7 10H3v15h18V10h-4M12 18V2m-5 5 5-5 5 5"/></svg><span>쿠키 타워 이미지 저장 및 공유</span></button>
      <button class="it-footer-link" data-tower-action="${record.archived ? 'current' : 'analytics'}">${record.archived ? '이번 달 타워로 돌아가기　↗' : '집중 기록과 스트릭 달력　›'}</button>
    </section>`;
  }
  function update(animate = 0, force = false) {
    const view = document.querySelector('.integrated-tower');
    if (!view) return;
    const record = data(), svg = view.querySelector('.it-scene');
    const height = Math.round(view.clientHeight / Math.max(1, view.clientWidth) * 390);
    const nextSignature = `${record.month}:${record.cookies}:${record.stage.id}:${height}`;
    if (force || signature !== nextSignature || animate) {
      svg.setAttribute('viewBox', `0 0 390 ${height}`);
      svg.setAttribute('aria-label', `${record.stage.name}, 쿠키 ${record.cookies}개, 현재 고도 ${record.height}m`);
      svg.innerHTML = artMarkup(record, height, Math.min(animate || pendingDrops, 5));
      signature = nextSignature; pendingDrops = 0;
      view.classList.toggle('it-space', record.stage.id === 'space');
      view.querySelector('.it-altitude strong').textContent = number(record.height);
      view.querySelector('.it-stage-pill').innerHTML = `<i></i>${esc(record.stage.name)}`;
      view.querySelector('.it-month-button').innerHTML = `${Number(record.month.slice(5))}월 · 쿠키 ${number(record.cookies)}개 <span>⌄</span>`;
      const empty = view.querySelector('.it-empty');
      if (empty && record.cookies) empty.remove();
      if (!empty && !record.cookies) {
        const message = document.createElement('div'); message.className = 'it-empty';
        message.innerHTML = `<strong>첫 쿠키를 기다리는 중</strong><span>한 시간의 집중으로 시작해요</span><button data-tower-action="focus">${state.focus.active ? '집중 화면으로 돌아가기' : '집중 시작하기'} ↗</button>`;
        view.append(message);
      }
      view.querySelector('.it-altitude>small').textContent = record.archived ? `${monthLabel(record.month)}의 기록` : '';
      const footer = view.querySelector('.it-footer-link');
      footer.dataset.towerAction = record.archived ? 'current' : 'analytics';
      footer.textContent = record.archived ? '이번 달 타워로 돌아가기　↗' : '집중 기록과 스트릭 달력　›';
    }
    if (animate) {
      const bubble = view.querySelector('.it-earned');
      bubble.textContent = `쿠키 ${animate}개가 차곡! +${animate * Core.HEIGHT_PER_COOKIE}m`;
      bubble.classList.remove('it-pop'); void bubble.offsetWidth; bubble.classList.add('it-pop');
    }
  }
  function openDialog(title, content) {
    if (exportUrl) { URL.revokeObjectURL(exportUrl); exportUrl = null; }
    dialog.innerHTML = `<div class="it-dialog-heading"><h2 id="it-dialog-title">${title}</h2><button data-tower-action="close" aria-label="닫기">×</button></div><div class="it-dialog-content">${content}</div>`;
    if (!dialog.open) dialog.showModal();
  }
  function historyMarkup() {
    const current = Integration.summary(state), records = Integration.history(state);
    const past = records.filter(record => record.month < current.month);
    return `<p class="it-copy">매월 1일 00시, 한국 시간에 새 타워가 시작돼요.<br>지난달에 쌓은 쿠키는 이곳에 보관돼요.</p><button class="it-record-current" data-tower-month="${current.month}"><span>${monthLabel(current.month)} · 이번 달</span><strong>${number(current.cookies)} <small>개의 쿠키 · ${number(current.height)}m　›</small></strong><p>${duration(current.focusSeconds)} 집중</p></button>
      ${past.length ? past.map(record => `<button class="it-record-row" data-tower-month="${record.month}"><i>${Core.stageFor(record.cookies * 10).id === 'space' ? '🪐' : '🍪'}</i><span>${monthLabel(record.month)}<small>${duration(record.focusSeconds)} 집중</small></span><b>${number(record.cookies)}개<small>${number(record.cookies * Core.HEIGHT_PER_COOKIE)}m　›</small></b></button>`).join('') : '<div class="it-empty-record">🍪<strong>첫 번째 달을 쌓고 있어요</strong><p>다음 달에는 이곳에서<br>이번 달의 타워를 다시 만나요.</p></div>'}
      ${state.cookieTower.migration?.undatedCookies ? `<p class="it-copy">날짜가 남아 있지 않은 기존 쿠키 ${number(state.cookieTower.migration.undatedCookies)}개는 연결한 달에 한 번만 포함했어요. 날짜가 있는 기존 기록은 해당 달에 보관했어요.</p>` : ''}
      <button class="it-secondary" data-tower-action="share">이미지로 저장하기　↓</button><button class="it-secondary" data-tower-action="analytics">집중 통계와 스트릭 달력 보기　↗</button>`;
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); showToast('파일을 저장했어요.');
  }
  async function prepareShare() {
    const record = data(), space = record.stage.id === 'space', ink = space ? '#fff' : '#3e2723';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="1830" viewBox="0 0 390 915"><rect width="390" height="915" fill="#fbf9f6"/><g transform="translate(0 64)">${Art.scene({ count: record.cookies, height: record.height, stage: record.stage, viewHeight: 851 })}</g><text x="24" y="41" font-family="Arial,sans-serif" font-size="25" font-weight="900" fill="#4b2818">chagok</text><rect x="154" y="140" width="82" height="28" rx="14" fill="#fbf9f6" stroke="#ebdcd3"/><circle cx="170" cy="154" r="4" fill="#f59e0b"/><text x="201" y="158" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#3e2723">${esc(record.stage.name)}</text><text x="195" y="214" text-anchor="middle" font-family="sans-serif" font-size="35" font-weight="800" fill="${ink}">${number(record.height)} <tspan font-size="19">m</tspan></text><text x="195" y="240" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${space ? '#c9c9d7' : '#998273'}">${monthLabel(record.month)} · 쿠키 ${number(record.cookies)}개</text><rect x="25" y="766" width="340" height="52" rx="26" fill="#3e2723"/><text x="195" y="798" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="600" fill="#fbf9f6">집중한 시간만큼, 차곡차곡.</text><text x="195" y="873" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#9e8871">작은 집중도, 소중한 한 층.</text></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 780; canvas.height = 1830;
      canvas.getContext('2d').drawImage(image, 0, 0);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG 변환 실패')), 'image/png'));
      const file = new File([blob], `chagok-tower-${record.month}.png`, { type: 'image/png' });
      exported = { blob, file };
      openDialog('한 장에 담은 나의 집중', '');
      exportUrl = URL.createObjectURL(blob);
      dialog.querySelector('.it-dialog-content').innerHTML = `<p class="it-copy">${monthLabel(record.month)} · 쿠키 ${number(record.cookies)}개 · ${number(record.height)}m</p><img class="it-export-image" src="${exportUrl}" alt="저장할 쿠키 타워 이미지"><button class="it-primary" data-tower-action="save-png">이미지 저장하기　↓</button>${navigator.canShare?.({ files: [file] }) ? '<button class="it-secondary" data-tower-action="share-png">다른 앱으로 공유하기　↗</button>' : ''}`;
    } finally { URL.revokeObjectURL(url); }
  }
  const previousRender = render;
  render = function () {
    previousRender();
    const showing = page === 'stats' && state.settings.onboardingDone;
    document.querySelector('#app').classList.toggle('tower-host', showing);
    document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.page === page));
    if (showing) update(0, true);
    if (page === 'focus' && state.settings.onboardingDone) {
      const rewards = document.createElement('button');
      rewards.className = 'it-focus-link'; rewards.dataset.towerAction = 'visit';
      rewards.innerHTML = `이번 달 쿠키 <b data-tower-count>${number(Integration.summary(state).cookies)}개</b>　타워 보기 ↗<small>연속 집중 <span data-tower-continuous>${clock(state.focus.towerSeconds || 0)}</span> · 휴식하면 새로 시작해요</small>`;
      document.querySelector('.bake-page')?.append(rewards);
    }
  };
  statsPage = pageMarkup;
  shareCookieCollection = prepareShare;
  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-tower-action],[data-tower-month]');
    if (!button) return;
    if (button.dataset.towerMonth) {
      selectedMonth = button.dataset.towerMonth; dialog.close(); go('stats'); return;
    }
    try {
      switch (button.dataset.towerAction) {
        case 'visit': selectedMonth = null; go('stats'); break;
        case 'focus': dialog.close(); if (state.focus.active) go('focus'); else openFocusModePicker(); break;
        case 'history': openDialog('차곡차곡, 월별 기록', historyMarkup()); break;
        case 'close': dialog.close(); break;
        case 'current': selectedMonth = null; render(); break;
        case 'analytics': openDialog('집중 기록과 스트릭 달력', originalStatsPage()); break;
        case 'export': download(new Blob([JSON.stringify(state.cookieTower, null, 2)], { type: 'application/json' }), `chagok-tower-records-${Core.monthKey()}.json`); break;
        case 'share': await prepareShare(); break;
        case 'save-png': if (exported) download(exported.blob, exported.file.name); break;
        case 'share-png': if (exported) await navigator.share({ files: [exported.file], title: '차곡 · 나의 쿠키 타워' }); break;
        case 'stages': openDialog('집중은 이렇게 쌓여요', `<p class="it-copy">완성한 한 시간마다 기본 1개, 공강에는 2개.<br>5번째 연속 집중 시간부터는 시간당 5개를 받아요.<br>공강은 기존 시간표를 기준으로 자동 판정해요.</p><div class="it-stage-list">${Core.STAGES.map(stage => `<div>${Art.thumbnail(stage.id)}<span><strong>${stage.name}</strong><small>${stage.description}</small></span><b>${number(stage.min)}m${stage.min ? '+' : ''}</b></div>`).join('')}</div><p class="it-copy">쿠키 한 개는 10m예요. 휴식하면 연속 집중은 새로 시작하고, 이미 쌓은 쿠키는 그대로 남아요.</p><button class="it-primary" data-tower-action="focus">${state.focus.active ? '집중 화면으로 돌아가기' : '집중 시작하기'}　↗</button>`); break;
      }
    } catch (error) { if (error.name !== 'AbortError') { console.error(error); showToast('타워 이미지를 저장하지 못했어요. 다시 시도해주세요.'); } }
  });
  window.addEventListener('cookietime-tower-earned', event => {
    pendingDrops = Math.min(5, pendingDrops + event.detail.cookies);
    if (!selectedMonth || selectedMonth === Core.monthKey()) update(event.detail.cookies);
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => { if (exportUrl) URL.revokeObjectURL(exportUrl); exportUrl = null; exported = null; });
  const observer = new ResizeObserver(() => update());
  observer.observe(document.querySelector('.app-shell'));
  setInterval(() => {
    if (page === 'stats' && state.settings.onboardingDone) update();
    const focusLink = document.querySelector('.it-focus-link [data-tower-count]');
    if (focusLink) focusLink.textContent = `${number(Integration.summary(state).cookies)}개`;
    const continuous = document.querySelector('[data-tower-continuous]');
    if (continuous) continuous.textContent = clock(state.focus.towerSeconds || 0);
  }, 1000);
  window.CookieTowerApp = { getSummary: () => Integration.summary(state), getHistory: () => Integration.history(state) };
  render();
})();
