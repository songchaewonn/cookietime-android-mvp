(function () {
  'use strict';
  const Core = window.CookieTowerCore, Art = window.CookieTowerArt;
  const $ = selector => document.querySelector(selector);
  const num = value => Number(value).toLocaleString('ko-KR');
  const safe = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const formatMonth = key => `${key.slice(0, 4)}년 ${Number(key.slice(5))}월`;
  const hoursText = seconds => `${Math.floor(seconds / 3600)}시간 ${Math.floor(seconds % 3600 / 60)}분`;
  const timeText = seconds => [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map(v => String(v).padStart(2, '0')).join(':');
  let storageAvailable = true;
  let store;
  try {
    localStorage.setItem('chagok-tower-check', '1');
    localStorage.removeItem('chagok-tower-check');
    store = Core.createStore();
    store.read();
  } catch (error) {
    storageAvailable = false;
    const memory = new Map();
    store = Core.createStore({ storage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) } });
    console.warn('타워 기록을 저장할 수 없어 이번 방문 중에만 유지합니다.', error);
  }
  let mode = store.read().runner || store.summary().cookies || store.summary().focusSeconds ? 'real' : 'preview';
  try { const remembered = sessionStorage.getItem('chagok-tower-view'); if (['real', 'preview'].includes(remembered)) mode = remembered; } catch {}
  let previewCount = 54, previewRate = 1, sheetType = null, selectedHistory = null;
  let sceneSignature = '', toastTimer, focusContext = false, lastOpener = null;
  let animationUntil = 0;
  let pendingExport = null, exportPreviewUrl = null;

  function notify(text) {
    $('#toast').textContent = text;
    $('#toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3400);
  }
  function display() {
    if (selectedHistory) {
      const height = selectedHistory.cookies * Core.HEIGHT_PER_COOKIE;
      return { ...selectedHistory, height, stage: Core.stageFor(height), archived: true };
    }
    if (mode === 'real') return store.summary();
    const height = previewCount * Core.HEIGHT_PER_COOKIE;
    return { cookies: previewCount, height, stage: Core.stageFor(height), preview: true, month: Core.monthKey() };
  }
  function monthlyOverview() {
    const real = store.summary(), next = new Date(Core.nextMonthAt(Date.now()) + 9 * 3600000);
    $('#month-label').textContent = `${Number(real.month.slice(5))}월, 나의 쿠키`;
    $('#real-cookie-count').textContent = num(real.cookies);
    $('#real-focus-time').textContent = `${hoursText(real.focusSeconds)} 집중`;
    $('#reset-label').textContent = `${next.getUTCMonth() + 1}월 1일 새로 시작해요`;
  }
  function renderScene(animate = 0, force = false) {
    const data = display(), view = $('.tower-view');
    const viewHeight = Math.round(view.clientHeight / view.clientWidth * 390);
    const signature = `${data.cookies}-${data.stage.id}-${viewHeight}`;
    const scene = $('#tower-scene');
    if (force || signature !== sceneSignature || animate) {
      scene.setAttribute('viewBox', `0 0 390 ${viewHeight}`);
      scene.innerHTML = `<title id="scene-title">${data.stage.name}의 쿠키 타워</title><desc id="scene-description">${num(data.cookies)}개의 쿠키, 현재 고도 ${num(data.height)}미터. 화면에는 최근 쿠키를 대표하여 보여줍니다.</desc>` + Art.scene({ count: data.cookies, height: data.height, stage: data.stage, animate, viewHeight });
      sceneSignature = signature;
      if (animate) animationUntil = Date.now() + 1800;
    }
    $('#tower-phone').classList.toggle('is-space', data.stage.id === 'space');
    $('#tower-phone').classList.toggle('is-history', Boolean(data.archived));
    $('#stage-name').textContent = data.stage.name;
    $('#altitude').textContent = num(data.height);
    $('#tower-subtitle').textContent = data.archived ? `${formatMonth(data.month)} · 쿠키 ${num(data.cookies)}개` : '';
    $('#empty-tower').hidden = data.cookies > 0;
    $('#preview-indicator').textContent = data.archived ? '현재로 돌아가기' : data.preview ? '미리보기' : `${Number(data.month.slice(5))}월의 타워`;
    $('#preview-indicator').dataset.action = data.archived ? 'return-current' : 'controls';
    $('#caption-mode').textContent = data.archived ? `${formatMonth(data.month)}의 타워` : data.preview ? `${data.stage.name} 미리보기` : `${Number(data.month.slice(5))}월, 나의 쿠키 ${num(data.cookies)}개`;
    $('.share-button span').textContent = '쿠키 타워 이미지 저장 및 공유';
  }
  function landscapeControls() {
    const data = display();
    return `<div class="control-label">어디까지 쌓아볼까요?<span>배경 미리보기</span></div><div class="landscape-options">${Core.STAGES.map(stage => `<button class="landscape-option ${data.stage.id === stage.id ? 'selected' : ''}" data-landscape="${stage.id}">${Art.thumbnail(stage.id)}<strong>${stage.name}</strong><small>${num(stage.min)}m${stage.min ? '+' : ''}</small></button>`).join('')}</div>
      <div class="control-label" style="margin-top:23px">집중 조건<span>한 번 눌러 한 시간 경험하기</span></div><div class="rate-options"><button data-rate="1" class="${previewRate === 1 ? 'selected' : ''}">기본 · 1개</button><button data-rate="2" class="${previewRate === 2 ? 'selected' : ''}">공강 · 2개</button><button data-rate="5" class="${previewRate === 5 ? 'selected' : ''}">5시간+ · 5개</button></div>
      <button class="primary-button" data-action="add-preview"><span>＋</span> 쿠키 쌓아보기 <span>+${previewRate}</span></button><p class="preview-help">지금은 예시 타워를 보고 있어요.<br>미리보기의 쿠키는 나의 기록에 더해지지 않아요.</p>`;
  }
  function timerMarkup() {
    const state = store.read(), runner = state.runner;
    const seconds = runner ? Math.max(0, Math.floor((Date.now() - runner.startedAt) / 1000)) : 0;
    const rate = Core.rewardForHour(Math.floor(seconds / 3600) + 1, runner?.isGap || focusContext);
    return `<div class="live-timer"><span>${runner ? '지금, 차곡차곡 집중하는 중' : '나를 위한 집중을 시작해요'}</span><strong class="timer-digits" data-timer>${timeText(seconds)}</strong><p data-next-reward>다음 한 시간까지 ${60 - Math.floor(seconds % 3600 / 60)}분 · 쿠키 ${rate}개</p><div class="progress-track"><i data-timer-progress style="width:${seconds % 3600 / 36}%"></i></div></div>
      ${runner ? `<div class="sheet-tag">${runner.isGap ? '공강 집중' : '기본 집중'} · 연속 ${Math.floor(seconds / 3600)}시간</div>` : `<label class="gap-toggle">지금은 공강 시간이에요<input type="checkbox" data-gap-toggle ${focusContext ? 'checked' : ''}></label>`}
      <button class="primary-button" data-action="${runner ? 'stop-focus' : 'start-focus'}">${runner ? '집중 마치기' : '집중 시작하기　↗'}</button><p class="timer-note">${runner ? '집중을 마치면 연속 시간이 초기화돼요. 완성한 한 시간의 쿠키는 그대로 남아요.' : '완성한 한 시간마다 쿠키가 쌓여요. 다섯 번째 연속 집중 시간부터 시간당 5개를 받아요.'}</p>`;
  }
  function renderControls() {
    document.querySelectorAll('[data-mode]').forEach(button => {
      button.classList.toggle('selected', button.dataset.mode === mode);
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    });
    $('#control-content').innerHTML = mode === 'preview' ? landscapeControls() : timerMarkup();
    if (sheetType === 'controls') $('#sheet-content').innerHTML = `<div class="mobile-controls"><div class="mode-switch"><button data-mode="preview" class="${mode === 'preview' ? 'selected' : ''}">미리보기</button><button data-mode="real" class="${mode === 'real' ? 'selected' : ''}">내 타워</button></div>${mode === 'preview' ? landscapeControls() : timerMarkup()}</div>`;
  }
  function render(animate = 0) {
    try { sessionStorage.setItem('chagok-tower-view', mode); } catch {}
    renderScene(animate); monthlyOverview(); renderControls();
  }
  function showReward(count) {
    const bubble = $('#reward-bubble');
    bubble.classList.remove('pop');
    bubble.textContent = `쿠키 ${count}개가 차곡! +${count * Core.HEIGHT_PER_COOKIE}m`;
    void bubble.offsetWidth;
    bubble.classList.add('pop');
  }
  function openSheet(type, title, html) {
    lastOpener = document.activeElement;
    sheetType = type;
    $('#sheet-title').textContent = title;
    $('#sheet-content').innerHTML = html;
    if (!$('#sheet').open) $('#sheet').showModal();
  }
  function closeSheet() { $('#sheet').close(); }
  function historyMarkup() {
    const records = store.history(), current = store.summary(), past = records.filter(record => record.month < current.month);
    return `<p class="sheet-copy">이번 달은 새롭게, 지난 노력은 오래도록.<br>매월 1일 00시, 한국 시간에 새 타워가 시작돼요.</p><div class="record-summary"><span>${formatMonth(current.month)} · 이번 달</span><strong>${num(current.cookies)} <small>개의 쿠키 · ${num(current.height)}m</small></strong><p>${hoursText(current.focusSeconds)} 집중했어요</p></div>
      ${past.length ? past.map(record => `<button class="record-row" data-record="${record.month}"><i>${Core.stageFor(record.cookies * 10).id === 'space' ? '🪐' : '🍪'}</i><span>${formatMonth(record.month)}<small>${hoursText(record.focusSeconds)} 집중</small></span><b>${num(record.cookies)}개<small>${num(record.cookies * 10)}m　›</small></b></button>`).join('') : `<div class="empty-history"><span>🍪</span><strong>첫 번째 달을 쌓고 있어요</strong><p>다음 달이 되면 이곳에<br>이번 달의 쿠키 타워가 보관돼요.</p></div>`}
      <p class="sheet-copy">${storageAvailable ? '기록은 이 브라우저에 저장돼요. MY에서 기록을 파일로 보관할 수 있어요.' : '현재 브라우저에서 저장소를 사용할 수 없어, 이번 방문 중에만 기록이 유지돼요.'}</p>`;
  }
  function stagesMarkup() {
    const data = display();
    return `<p class="sheet-copy">쿠키 한 개가 쌓일 때마다 10m씩 높아져요.<br>익숙한 숲에서 저 멀리 우주까지, 천천히 가봐요.</p><div class="stage-list">${Core.STAGES.map(stage => `<button class="stage-row ${data.stage.id === stage.id ? 'selected' : ''}" data-landscape="${stage.id}">${Art.thumbnail(stage.id)}<span><strong>${stage.name}</strong><small>${stage.description}</small></span><b>${num(stage.min)}m${stage.min ? '+' : ''}</b></button>`).join('')}</div><p class="sheet-copy">풍경을 누르면 미리보기로 볼 수 있어요. 나의 쿠키와 기록은 그대로 유지돼요.</p>`;
  }
  function showFocus() {
    openSheet('focus', '오늘도 한 층, 차곡', `${mode === 'preview' ? '<span class="sheet-tag">실제 집중 기록</span>' : ''}${timerMarkup()}`);
  }
  function updateTimers() {
    const runner = store.read().runner;
    if (!runner) return;
    const seconds = Math.max(0, Math.floor((Date.now() - runner.startedAt) / 1000));
    document.querySelectorAll('[data-timer]').forEach(el => { el.textContent = timeText(seconds); });
    const rate = Core.rewardForHour(Math.floor(seconds / 3600) + 1, runner.isGap);
    document.querySelectorAll('[data-next-reward]').forEach(el => { el.textContent = `다음 한 시간까지 ${60 - Math.floor(seconds % 3600 / 60)}분 · 쿠키 ${rate}개`; });
    document.querySelectorAll('[data-timer-progress]').forEach(el => { el.style.width = `${seconds % 3600 / 36}%`; });
  }
  function tick(force = false) {
    try {
      const state = store.read(), runner = state.runner;
      if (runner) {
        const seconds = Math.max(0, Math.floor((Date.now() - runner.startedAt) / 1000));
        const previous = state.sessions[runner.id]?.seconds || 0;
        if (force || seconds - previous >= 10 || Math.floor(seconds / 3600) > Math.floor(previous / 3600)) {
          const { result } = store.tick();
          monthlyOverview();
          if (result.cookies) {
            if (mode === 'real' && !selectedHistory) { render(Math.min(result.cookies, 5)); showReward(result.cookies); }
            else { monthlyOverview(); notify(`내 타워에 쿠키 ${result.cookies}개가 쌓였어요`); }
          }
        }
        updateTimers();
      }
      const shown = display();
      if (mode === 'real' && !selectedHistory && shown.month !== $('#preview-indicator').dataset.month) {
        $('#preview-indicator').dataset.month = shown.month;
        store.rollover();
        render();
      }
    } catch (error) { console.error(error); notify('기록 저장에 문제가 있어요. MY에서 저장 상태를 확인해주세요.'); }
  }
  async function exportTower() {
    const button = $('[data-action="share"]');
    button.disabled = true;
    try {
      const data = display(), W = 390, H = 915;
      const scene = Art.scene({ count: data.cookies, height: data.height, stage: data.stage, viewHeight: 851 });
      const space = data.stage.id === 'space', heroY = space ? 99 : 157, textColor = space ? '#fff' : '#3e2723';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="1830" viewBox="0 0 ${W} ${H}"><rect width="390" height="915" fill="#fbf9f6"/><g transform="translate(0 64)">${scene}</g><text x="24" y="41" font-family="Arial,sans-serif" font-weight="900" font-size="25" fill="#4b2818">chagok</text><rect x="154" y="${heroY - 17}" width="82" height="28" rx="14" fill="#fbf9f6" stroke="#ebdcd3"/><circle cx="170" cy="${heroY - 3}" r="4" fill="#f59e0b"/><text x="200" y="${heroY + 1}" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#3e2723">${safe(data.stage.name)}</text><text x="195" y="${heroY + 58}" text-anchor="middle" font-family="sans-serif" font-size="35" font-weight="800" fill="${textColor}">${num(data.height)} <tspan font-size="19">m</tspan></text><text x="195" y="${heroY + 84}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${space ? '#c9c9d7' : '#998273'}">${formatMonth(data.month)} · 쿠키 ${num(data.cookies)}개${data.preview ? ' · 미리보기' : ''}</text><rect x="25" y="766" width="340" height="52" rx="26" fill="#3e2723"/><text x="195" y="798" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="600" fill="#fbf9f6">집중한 시간만큼, 차곡차곡.</text><text x="195" y="873" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#9e8871">작은 집중도, 소중한 한 층.</text></svg>`;
      const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      try {
        const img = new Image();
        img.src = svgUrl;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 780; canvas.height = 1830;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('이미지 변환 실패')), 'image/png'));
        const file = new File([blob], `chagok-tower-${data.month}${data.preview ? '-preview' : ''}.png`, { type: 'image/png' });
        pendingExport = { blob, file, data };
        if (exportPreviewUrl) URL.revokeObjectURL(exportPreviewUrl);
        exportPreviewUrl = URL.createObjectURL(blob);
        openSheet('share', '한 장에 담은 나의 집중', `<p class="sheet-copy">${formatMonth(data.month)} · 쿠키 ${num(data.cookies)}개 · ${num(data.height)}m${data.preview ? '<br>미리보기 타워 이미지예요.' : ''}</p><img src="${exportPreviewUrl}" alt="저장할 쿠키 타워 이미지" style="display:block;max-height:310px;max-width:100%;border-radius:13px;margin:0 auto 22px;box-shadow:0 5px 25px #4e392518"><button class="primary-button" data-action="save-png">이미지 저장하기　↓</button>${navigator.canShare?.({ files: [file] }) ? '<button class="secondary-button" data-action="share-png">다른 앱으로 공유하기　↗</button>' : ''}`);
      } finally { URL.revokeObjectURL(svgUrl); }
    } catch (error) { console.error(error); notify('이미지를 저장하지 못했어요. 다시 시도해주세요.'); }
    finally { button.disabled = false; }
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('파일을 저장했어요');
  }
  document.addEventListener('click', async event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.mode) {
      mode = target.dataset.mode; selectedHistory = null;
      render();
      return;
    }
    if (target.dataset.rate) {
      previewRate = Number(target.dataset.rate); renderControls(); return;
    }
    if (target.dataset.landscape) {
      const samples = { forest: 6, mountain: 54, cloud: 250, space: 1050 };
      previewCount = samples[target.dataset.landscape];
      mode = 'preview'; selectedHistory = null; render();
      if (sheetType === 'stages' || sheetType === 'controls') closeSheet();
      return;
    }
    if (target.dataset.record) {
      const record = store.history().find(row => row.month === target.dataset.record);
      if (!record) return;
      selectedHistory = record; closeSheet(); render(); return;
    }
    switch (target.dataset.action) {
      case 'add-preview':
        if (Date.now() < animationUntil) return;
        selectedHistory = null; previewCount += previewRate;
        if (sheetType === 'controls') closeSheet();
        render(previewRate); showReward(previewRate); break;
      case 'controls': openSheet('controls', '나의 쿠키 타워', ''); renderControls(); break;
      case 'focus': showFocus(); break;
      case 'history': tick(true); openSheet('history', '차곡차곡, 월별 기록', historyMarkup()); break;
      case 'stages': openSheet('stages', '다음 풍경이 기다려요', stagesMarkup()); break;
      case 'gap':
        openSheet('gap', '공강도 나를 위한 시간', `<span class="sheet-tag">공강 집중 · 시간당 쿠키 2개</span><p class="sheet-copy">수업 사이의 빈 시간을 차곡차곡 채워보세요.<br>독립 실행 화면에서는 직접 공강 여부를 선택해요. 기존 앱에 연결하면 시간표 정보를 전달할 수 있어요.</p><div class="record-summary"><span>한 시간을 온전히 집중하면</span><strong>2 <small>개의 쿠키 · 20m</small></strong><p>5번째 연속 집중 시간부터는 시간당 5개</p></div><button class="primary-button" data-action="gap-focus">공강 집중 시작하기　↗</button>`); break;
      case 'gap-focus': focusContext = true; showFocus(); break;
      case 'start-focus':
        try {
          store.start(focusContext); mode = 'real'; selectedHistory = null;
          render(); if ($('#sheet').open) showFocus();
          notify('집중을 시작했어요. 첫 쿠키까지 한 시간!');
        } catch (error) { notify('집중 기록을 저장하지 못했어요.'); }
        break;
      case 'stop-focus':
        try {
          const { result } = store.stop(); render(result.cookies);
          if ($('#sheet').open) showFocus();
          notify('집중을 마쳤어요. 쌓은 쿠키는 이번 달 타워에 남아요.');
        } catch (error) { notify('기록을 저장하지 못했어요. 다시 시도해주세요.'); }
        break;
      case 'return-current': selectedHistory = null; render(); break;
      case 'share': await exportTower(); break;
      case 'save-png': if (pendingExport) download(pendingExport.blob, pendingExport.file.name); break;
      case 'share-png':
        if (pendingExport) {
          try { await navigator.share({ files: [pendingExport.file], title: '차곡 · 나의 쿠키 타워', text: `이번 달 쿠키 ${num(pendingExport.data.cookies)}개, ${num(pendingExport.data.height)}m의 집중!` }); }
          catch (error) { if (error.name !== 'AbortError') { download(pendingExport.blob, pendingExport.file.name); } }
        }
        break;
      case 'export-data': download(new Blob([store.exportData()], { type: 'application/json' }), `chagok-tower-records-${Core.monthKey()}.json`); break;
      case 'settings':
        openSheet('settings', '내 타워 관리', `<p class="sheet-copy">매달 새롭게 도전하고,<br>집중한 시간은 오래 간직해요.</p><div class="settings-info"><span>쿠키 한 개의 높이</span><strong>10m</strong></div><div class="settings-info"><span>새 타워 시작</span><strong>매월 1일 00:00</strong></div><div class="settings-info"><span>기록 기준 시간</span><strong>한국 시간 (Asia/Seoul)</strong></div><div class="settings-info"><span>기록 저장</span><strong>${storageAvailable ? '이 기기의 브라우저' : '임시 저장 · 이번 방문만'}</strong></div><p class="sheet-copy">브라우저 데이터를 지우면 기록도 사라질 수 있어요. 소중한 기록을 JSON 파일로 보관해두세요.</p><button class="primary-button" data-action="export-data">월별 기록 파일로 저장하기　↓</button><button class="secondary-button" data-action="history">월별 기록 보기</button>`); break;
      case 'news':
        openSheet('news', '타워에서 온 소식', `<span class="sheet-tag">한 달에 하나, 나만의 타워</span><div class="record-summary"><span>이번 달의 작은 성취</span><strong>${num(store.summary().cookies)} <small>개의 쿠키</small></strong><p>${storageAvailable ? '집중한 기록은 이 브라우저에 안전하게 남아 있어요.' : '현재 기록은 이번 방문 중에만 유지돼요.'}</p></div><div class="earning-guide" style="margin-top:0;border-top:0;padding-top:0">${$('.earning-guide').innerHTML}</div><p class="sheet-copy">휴식하거나 집중을 마치면 연속 시간이 다시 시작돼요. 쿠키가 많아지면 화면에는 최근 쿠키를 대표해서 보여줘요.</p><button class="primary-button" data-action="controls">타워 둘러보기　↗</button>`); break;
    }
  });
  document.addEventListener('change', event => { if (event.target.matches('[data-gap-toggle]')) { focusContext = event.target.checked; renderControls(); if (sheetType === 'focus') showFocus(); } });
  $('#close-sheet').addEventListener('click', closeSheet);
  $('#sheet').addEventListener('click', event => {
    if (event.target === $('#sheet')) {
      const rect = $('#sheet').getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeSheet();
    }
  });
  $('#sheet').addEventListener('close', () => {
    sheetType = null;
    if (exportPreviewUrl) { URL.revokeObjectURL(exportPreviewUrl); exportPreviewUrl = null; pendingExport = null; }
    if (lastOpener?.isConnected) lastOpener.focus();
  });
  window.addEventListener('storage', event => { if (event.key === Core.STORAGE_KEY) { tick(); render(); if (sheetType === 'focus') showFocus(); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { tick(true); render(); } else tick(true); });
  window.addEventListener('pagehide', () => tick(true));
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => renderScene(0, true), 100); });
  window.CookieTower = Object.freeze({
    getSummary: () => store.summary(),
    getHistory: () => store.history(),
    recordFocus(input) {
      const result = store.syncSession(input).result;
      monthlyOverview();
      if (mode === 'real' && !selectedHistory) { render(result.cookies); if (result.cookies) showReward(result.cookies); }
      window.dispatchEvent(new CustomEvent('cookie-tower:updated', { detail: store.summary() }));
      return result;
    },
    endSession: sessionId => store.endSession(sessionId),
    showMyTower() { mode = 'real'; selectedHistory = null; render(); }
  });
  tick(true); render(); setInterval(tick, 1000);
  if (!storageAvailable) setTimeout(() => notify('기록 저장소를 사용할 수 없어 이번 방문 중에만 유지돼요.'), 800);
})();
