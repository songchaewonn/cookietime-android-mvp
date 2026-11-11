/* Figma PNG inspired presentation layer. Business state and existing handlers remain in app.js. */
const originalSchedulePage = schedulePage;
const originalStatsPage = statsPage;
const originalRender = render;
const originalFocusAction = focusAction;
let cookieUiTick = null;
let designLastPage=page;

function designOnboardingPage(){
  return `<section class="permission-onboarding"><button class="design-back" data-onboarding="skip" aria-label="뒤로">‹</button><h1>원활한 서비스 제공을 위해<br/>다음 권한이 필요해요</h1><div class="permission-list">
    <article><i>⌁</i><div><strong>앱 사용 기록 접근</strong><p>앱별 사용 시간을 분석해 스마트폰 사용 패턴을 확인합니다.</p></div></article>
    <article><i>▱</i><div><strong>다른 앱 위에 표시</strong><p>다른 앱을 사용하는 중에도 집중 타이머를 표시합니다.</p></div></article>
    <article><i>♧</i><div><strong>알림 권한</strong><p>집중 시간 종료 및 휴식 시간 등 주요 알림을 제공합니다.</p></div></article>
    <article><i>◴</i><div><strong>정확한 알람 권한</strong><p>설정한 집중 시간이 종료되는 시점에 맞춰 알람을 제공합니다.</p></div></article>
  </div><div class="permission-privacy">♙　수집된 활동 데이터는 이 기기에 저장됩니다. 계정 동기화 전까지 외부로 전송되지 않습니다.</div><p class="permission-note">권한은 기기 설정에서 언제든지 변경할 수 있어요</p><button class="button full" data-onboarding="settings">권한 허용하기　›</button><button class="text-link full" data-onboarding="skip">권한 없이 둘러보기</button></section>`
}

function designHomePage(){
  const list=sortedTasks().filter(t=>!t.done).slice(0,2);
  return `<div class="chagok-home"><div class="home-date">${today.getMonth()+1}월 ${today.getDate()}일 · ${weekdays[today.getDay()]}요일</div><h1>오늘도 가볍게 시작해요</h1><p class="home-subtitle">작은 시작이 하루의 리듬을 바꿔요.</p>
  <section class="oven-home"><div class="oven-slot"></div><div class="oven-cookie"><img src="public/assets/chagok-mascot.png" alt="차곡 쿠키 캐릭터"/></div><div class="oven-gauge" aria-label="집중 모드 선택"><span class="oven-dial"><i></i><b></b></span></div><button class="oven-bake" data-focus-mode-picker>굽기　▶</button></section>
  <h2>빠른 메뉴</h2><div class="chagok-quick"><button data-go="tasks"><span class="quick-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h10.5L19 8v11.5H5z"/><path d="M15 4.5V8h4M8 12h7M8 15.5h5"/><path d="m14.5 17.5 4.7-4.7 1.5 1.5-4.7 4.7-2.2.7z"/></svg></span><strong>메모 추가하기</strong><small>중요한 메모를 남기세요.</small></button><button data-go="game"><span>✦</span><strong>집중 게임하기</strong><small>잠깐 휴식을 취해보세요.</small></button><button data-go="stats"><span>▤</span><strong>오늘의 기록 보기</strong><small>오늘의 기록을 확인하세요.</small></button><button data-go="focus"><span>◷</span><strong>집중시간 설정하기</strong><small>집중 시간을 정해보세요.</small></button></div>
  <div class="chagok-section-title"><h2>오늘의 할 일</h2><button class="text-link" data-go="tasks">모두 보기 ›</button></div>${list.length?`<div class="chagok-task-list">${list.map(t=>`<div class="chagok-task"><button class="check" data-done="${t.id}"></button><strong>${esc(t.title)}</strong><small>${remain(t.due)}</small></div>`).join('')}</div>`:'<div class="chagok-task-list empty">오늘의 할 일을 모두 마쳤어요 🍪</div>'}</div>`
}

function designSchedulePage(){
  const date=new Date(today);date.setDate(1);date.setMonth(date.getMonth()+(window.chagokMonthOffset||0));
  const year=date.getFullYear(),month=date.getMonth(),firstDay=date.getDay(),last=new Date(year,month+1,0).getDate();
  const cells=Array.from({length:firstDay},()=>'<span></span>');
  for(let n=1;n<=last;n++){
    const d=new Date(year,month,n),key=dayKey(d),has=state.classes.some(c=>c.day===d.getDay()),chosen=n===selectedDayDate();
    cells.push(`<button class="month-day ${d.toDateString()===new Date().toDateString()?'today':''} ${chosen?'selected':''}" data-month-day="${n}" data-day="${d.getDay()}">${n}${has?'<i></i>':''}</button>`)
  }
  const chosenDate=new Date(year,month,selectedDayDate()),day=chosenDate.getDay(),classes=state.classes.filter(c=>c.day===day).sort((a,b)=>a.start.localeCompare(b.start));
  const overview=`<div class="chagok-month-head"><h1>${year}년 ${month+1}월</h1><button data-month-shift="-1" aria-label="이전 달">‹</button><button data-month-shift="1" aria-label="다음 달">›</button><button class="month-add" data-modal="class" aria-label="수업 추가">＋</button></div><section class="month-calendar"><div class="month-week">${weekdays.map((w,i)=>`<b class="${i===0?'sunday':''}">${w}</b>`).join('')}</div><div class="month-days">${cells.join('')}</div></section><button class="today-schedule-card" data-toggle-timeline><span>◷</span><div><strong>${month+1}월 ${selectedDayDate()}일의 일정</strong><small>수업 ${classes.length}개 · 일정과 공강 시간 보기</small></div><b>›</b></button>`;
  return `${overview}<section class="schedule-timeline-wrap"><div class="section-head"><h2>${month+1}월 ${selectedDayDate()}일 ${dayLabel(day)}</h2><button class="button secondary" data-modal="class">＋ 수업 추가</button></div><div class="schedule-day-content">${originalSchedulePage()}</div></section>`;
}
function selectedDayDate(){return window.chagokSelectedDate||today.getDate()}
function selectDesignDate(year,month,day){const chosen=new Date(year,month,day),base=new Date(today.getFullYear(),today.getMonth(),today.getDate());base.setDate(base.getDate()-base.getDay());const chosenWeek=new Date(chosen.getFullYear(),chosen.getMonth(),chosen.getDate());chosenWeek.setDate(chosenWeek.getDate()-chosenWeek.getDay());window.chagokSelectedDate=day;window.chagokMonthAnchorDay=day;selectedDay=chosen.getDay();weekOffset=Math.round((chosenWeek-base)/604800000)}
function shiftDesignMonth(amount){const offset=(Number(window.chagokMonthOffset)||0)+amount,target=new Date(today.getFullYear(),today.getMonth()+offset,1),anchor=Number(window.chagokMonthAnchorDay)||selectedDayDate(),lastDay=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();window.chagokMonthOffset=offset;selectDesignDate(target.getFullYear(),target.getMonth(),Math.min(anchor,lastDay));window.chagokMonthAnchorDay=anchor;render()}

function designFocusPage(){
  const f=state.focus,elapsed=Math.max(0,Number(f.sessionSeconds)||0),mode=state.settings.focusMode||'timer',target=Math.max(1,Number(state.settings.focusTimerMinutes)||25)*60,display=mode==='timer'?Math.max(0,target-elapsed):elapsed,total=Math.max(0,Number(f.seconds)||0),rest=liveRestSeconds(),clock=value=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
  return `<section class="bake-page"><div class="bake-label">${mode==='timer'?'설정한 집중 시간':'연속 집중 시간'}</div><strong class="bake-status">${f.deviation?'잠깐 쉬는 중':mode==='timer'?'타이머 집중 중':'스톱워치 집중 중'}</strong><div class="oven-focus oven-machine"><img class="oven-machine-art" src="public/assets/chagok-oven.png" alt="쿠키가 구워지는 오븐"/><div class="oven-display"><strong class="focus-timer">${clock(display)}</strong><button class="oven-pause" data-action="deviation" aria-label="${f.deviation?'집중으로 돌아오기':'잠깐 쉬기'}">${f.deviation?'▶':'Ⅱ'}</button></div></div><div class="focus-mini-stats"><span>오늘 누적 집중 <b class="focus-total-timer">${clock(total)}</b></span><span id="focus-break-time">휴식 ${clock(rest)}</span></div><div class="focus-controls bake-actions">${f.active?'<button class="button secondary" data-action="stop-focus">집중 그만하기</button>':'<button class="button secondary" data-action="start-focus">집중 시작하기</button>'}</div><p class="bake-message">${f.active?(f.deviation?'휴식 중에는 집중 타이머가 멈춰 있어요.':'집중 시간이 기록되고 있어요.'):'굽기를 눌러 스톱워치 또는 타이머를 선택해요.'}</p></section>`
}

function openFocusModePicker(){
  const modal=document.querySelector('#modal-root'),selected=state.settings.focusMode||'timer',minutes=Number(state.settings.focusTimerMinutes)||25;
  modal.innerHTML=`<div class="modal-backdrop"><section class="modal focus-mode-modal" role="dialog" aria-modal="true" aria-labelledby="focus-mode-title"><div class="modal-top"><h2 id="focus-mode-title">집중 방식을 선택해요</h2><button type="button" class="close" data-mode-cancel aria-label="닫기">×</button></div><form id="focus-mode-form"><label class="focus-mode-choice"><input type="radio" name="focus-mode" value="stopwatch" ${selected==='stopwatch'?'checked':''}/><span><strong>스톱워치 모드</strong><small>원하는 만큼 집중 시간을 기록해요.</small></span></label><label class="focus-mode-choice"><input type="radio" name="focus-mode" value="timer" ${selected==='timer'?'checked':''}/><span><strong>타이머 모드</strong><small>정한 시간이 끝나면 집중을 마쳐요.</small></span></label><div class="focus-duration-field"><label class="field-label" for="focus-timer-minutes">집중 시간 (분)</label><input class="input" id="focus-timer-minutes" type="number" min="1" max="600" step="1" value="${minutes}"/></div><div class="modal-actions"><button type="button" class="button ghost" data-mode-cancel>취소</button><button class="button" type="submit">집중 시작하기</button></div></form></section></div>`;
  const form=modal.querySelector('#focus-mode-form'),duration=modal.querySelector('#focus-timer-minutes'),durationField=modal.querySelector('.focus-duration-field'),syncDuration=()=>{const showDuration=form.elements['focus-mode'].value==='timer';duration.disabled=!showDuration;durationField.hidden=!showDuration};
  form.querySelectorAll('input[name="focus-mode"]').forEach(input=>input.addEventListener('change',syncDuration));syncDuration();
  modal.querySelectorAll('[data-mode-cancel]').forEach(button=>button.addEventListener('click',()=>modal.replaceChildren()));
  form.addEventListener('submit',event=>{event.preventDefault();const mode=form.elements['focus-mode'].value;state.settings.focusMode=mode;if(mode==='timer')state.settings.focusTimerMinutes=Math.min(600,Math.max(1,Number(duration.value)||25));save();modal.replaceChildren();page='focus';if(!state.focus.active)focusAction('start-focus');else render()});
}

function focusCompletePage(){const f=state.focus,clock=value=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;return `<section class="bake-complete"><p>쿠키가 다 구워졌어요</p><h1>집중 완료!</h1><div class="complete-oven oven-machine"><img class="oven-machine-art" src="public/assets/chagok-oven.png" alt="완성된 쿠키가 든 오븐"/><div class="complete-display">${clock(0)}</div><img class="complete-cookie-slide" src="public/assets/tower-cookie-reference.png" alt="오븐에서 나온 쿠키"/></div><p class="complete-summary">이번 연속 집중 ${clock(f.sessionSeconds||0)} · 오늘 누적 ${clock(f.seconds||0)}</p><button class="button full" data-unload-cookie>쿠키 꺼내기</button><button class="button secondary full" data-bake-again>한 판 더 굽기</button></section>`}

function getTowerFlavors(count){const stackPattern=[3,4,2,1,4,3,0,1,2,4,3];let flavors=[];try{flavors=JSON.parse(localStorage.getItem('chagokTowerFlavors')||'[]')}catch{};try{if(localStorage.getItem('chagokTowerPattern')!=='ui-stack-v2'){flavors=[];localStorage.setItem('chagokTowerPattern','ui-stack-v2')}}catch{};while(flavors.length<count)flavors.push(stackPattern[flavors.length%stackPattern.length]);flavors=flavors.slice(0,count);try{localStorage.setItem('chagokTowerFlavors',JSON.stringify(flavors))}catch{};return flavors}

function designStatsPage(){
  const count=state.cookieRewards.loose+state.cookieRewards.boxes*10;
  const flavors=getTowerFlavors(Math.min(11,count));
  return `<section class="tower-page ${count>=60?'space-tower':''}"><div class="tower-sky"><span class="tower-status">●　${count>=60?'우주':count>0?'산 정상':'등반 준비'}</span><div class="tower-height"><small>현재 고도</small><strong>${count*10}<em>m</em></strong></div><div class="tower-mountains" aria-hidden="true"></div><div class="tower-stack"><div class="tower-pile">${flavors.map((flavor,i)=>`<i class="tower-cookie flavor-${flavor}" style="--i:${i};--layer-bottom:${i*45}px;--layer-delay:${i*70}ms;--layer-z:${20-i}"></i>`).join('')}</div><span class="tower-base" aria-hidden="true"></span></div></div><button class="tower-share" data-cookie-share>♧　쿠키 타워 이미지 저장 및 공유</button><details class="tower-record-details"><summary>집중 기록과 스트릭 달력</summary>${originalStatsPage()}</details></section>`
}

async function shareCookieTower(){
  const total=state.cookieRewards.loose+state.cookieRewards.boxes*10,canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;const ctx=canvas.getContext('2d');
  const sky=ctx.createLinearGradient(0,0,0,1920);sky.addColorStop(0,total>=60?'#09112e':'#fff5dc');sky.addColorStop(.63,total>=60?'#163258':'#eaf7ff');sky.addColorStop(1,'#e7d9c2');ctx.fillStyle=sky;ctx.fillRect(0,0,1080,1920);
  ctx.fillStyle=total>=60?'#ffe887':'#f3c77b';ctx.beginPath();ctx.arc(810,230,120,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=total>=60?'#162c49':'#dfe0dd';ctx.beginPath();ctx.moveTo(0,1110);ctx.lineTo(220,800);ctx.lineTo(410,1080);ctx.lineTo(650,740);ctx.lineTo(870,1060);ctx.lineTo(1080,860);ctx.lineTo(1080,1500);ctx.lineTo(0,1500);ctx.fill();
  ctx.textAlign='center';ctx.fillStyle=total>=60?'#fff':'#4b3022';ctx.font='bold 58px sans-serif';ctx.fillText(total>=60?'우주로 향하는 쿠키 타워':'산을 오르는 쿠키 타워',540,300);ctx.font='34px sans-serif';ctx.fillText(`현재 고도  ${total*10} m`,540,380);
  const colors=['#f1c27e','#9eaa52','#a76527','#efaa55','#efd29c'],layers=Math.min(15,total),baseY=1520;
  ctx.fillStyle='#513a32';ctx.beginPath();ctx.moveTo(260,baseY);ctx.lineTo(820,baseY);ctx.lineTo(900,baseY+70);ctx.lineTo(180,baseY+70);ctx.closePath();ctx.fill();
  for(let i=0;i<layers;i++){const y=baseY-i*62,w=570-(i%3)*34,x=540-w/2;ctx.fillStyle=colors[(total-i)%colors.length];ctx.beginPath();ctx.ellipse(540,y,w/2,58,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0002';ctx.beginPath();ctx.ellipse(540,y+21,w/2,36,0,0,Math.PI);ctx.fill();ctx.fillStyle='#51301f';for(let chip=0;chip<4;chip++){const cx=x+90+chip*100+(i%2)*25,cy=y-15+((chip*17+i*9)%22);ctx.save();ctx.translate(cx,cy);ctx.rotate((chip%2?1:-1)*.3);ctx.fillRect(-11,-11,22,22);ctx.restore()}}
  ctx.fillStyle=total>=60?'#fff':'#4b3022';ctx.font='bold 44px sans-serif';ctx.fillText(`집중 쿠키 ${total}개`,540,1745);ctx.font='28px sans-serif';ctx.fillText('한 시간씩 차곡차곡 쌓아 올렸어요',540,1810);
  canvas.toBlob(async blob=>{if(!blob){showToast('이미지를 만들지 못했어요.');return}const file=new File([blob],'cookietime-cookie-tower.png',{type:'image/png'});if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'나의 쿠키 타워'});return}catch(error){if(error.name==='AbortError')return}}const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='cookietime-cookie-tower.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('쿠키 타워 이미지를 저장했어요.')},'image/png')
}

function designRender(){
  if(page!==designLastPage){designLastPage=page;window.scrollTo(0,0)}
  if(page==='focusDone'){
    const root=document.querySelector('#app');root.innerHTML=focusCompletePage();bindCommon();
    root.querySelector('[data-unload-cookie]')?.addEventListener('click',()=>{showToast('25분 집중을 기록했어요. 쿠키 보상은 1시간 집중 시 쌓여요.');page='stats';render()});
    root.querySelector('[data-bake-again]')?.addEventListener('click',()=>{page='focus';if(!state.focus.active)focusAction('start-focus');else render()});return;
  }
  originalRender();
  const root=document.querySelector('#app');
  if(page==='home')root.classList.add('chagok-page');else root.classList.remove('chagok-page');
  if(page==='focus'){
    root.querySelector('.character-bubble')?.remove();
  }
  if(page==='schedule'){
    root.querySelector('[data-toggle-timeline]')?.addEventListener('click',()=>root.querySelector('.schedule-timeline-wrap')?.classList.toggle('expanded'));
  }
  if(page==='stats')root.querySelector('.tower-page')?.classList.toggle('space-tower',state.cookieRewards.loose+state.cookieRewards.boxes*10>=60);
  if(page==='stats'&&root.firstElementChild?.classList.contains('notice'))root.firstElementChild.remove();
  if(page==='settings'){
    const name=authUser?.displayName||'김쿠키';
    const profile=document.createElement('section');profile.className='my-profile-card';profile.innerHTML=`<span>🍪</span><div><strong>${esc(name)}</strong><small>${esc(state.settings.major||'전공을 설정해 주세요')}</small></div><button data-profile-edit>편집</button>`;root.prepend(profile);if(!authUser){const login=document.createElement('button');login.className='profile-login-link';login.textContent='간편 로그인';login.addEventListener('click',openAccountModal);profile.after(login)}
    profile.querySelector('[data-profile-edit]')?.addEventListener('click',()=>{const major=prompt('전공을 입력해주세요.',state.settings.major||'');if(major!==null){state.settings.major=major.trim();save();render()}});
    const title=root.querySelector('.page-title');if(title)title.textContent='MY';
  }
  root.querySelectorAll('[data-go="focus"]').forEach(button=>button.addEventListener('click',()=>{if(!state.focus.active)focusAction('start-focus')}));
  root.querySelectorAll('[data-focus-mode-picker]').forEach(button=>button.addEventListener('click',openFocusModePicker));
  root.querySelectorAll('[data-go="tasks"]').forEach(button=>{if(button.textContent.includes('메모 추가하기'))button.addEventListener('click',()=>setTimeout(()=>openModal('task'),0))});
}

focusAction=function(action){
  if(action==='stop-focus'&&state.focus.active){page='focusDone';originalFocusAction(action);return}
  originalFocusAction(action);
};

onboardingPage=designOnboardingPage;
homePage=designHomePage;
schedulePage=designSchedulePage;
focusPage=designFocusPage;
statsPage=designStatsPage;
render=designRender;
shareCookieCollection=shareCookieTower;

cookieUiTick=setInterval(()=>{
  if(page!=='focus')return;
  const timerNode=document.querySelector('.focus-timer');
  if(!timerNode)return;
  const elapsed=Math.max(0,Number(state.focus.sessionSeconds)||0),mode=state.settings.focusMode||'timer',target=Math.max(1,Number(state.settings.focusTimerMinutes)||25)*60;
  if(mode==='timer'&&state.focus.active&&!state.focus.deviation&&elapsed>=target){focusAction('stop-focus');return}
  const shown=mode==='timer'?Math.max(0,target-elapsed):elapsed;
  timerNode.textContent=`${String(Math.floor(shown/60)).padStart(2,'0')}:${String(shown%60).padStart(2,'0')}`;
},250);

document.addEventListener('click',event=>{
  const nav=event.target.closest('.nav-item');if(nav){
    const map={home:'home',schedule:'schedule',tasks:'tasks',focus:'focus',game:'game',stats:'stats'};
    if(nav.dataset.page==='stats'){page='stats';render();event.preventDefault()}
    return;
  }
  if(event.target.closest('[data-go="focus"]')&&!state.focus.active)focusAction('start-focus');
});

document.addEventListener('click',event=>{
  const shift=event.target.closest('[data-month-shift]');
  if(shift&&page==='schedule'){event.preventDefault();event.stopPropagation();shiftDesignMonth(Number(shift.dataset.monthShift));return}
  const dayButton=event.target.closest('[data-month-day]');
  if(dayButton&&page==='schedule'){event.preventDefault();event.stopPropagation();const visible=new Date(today.getFullYear(),today.getMonth()+(Number(window.chagokMonthOffset)||0),Number(dayButton.dataset.monthDay));selectDesignDate(visible.getFullYear(),visible.getMonth(),visible.getDate());render()}
},true);

document.addEventListener('DOMContentLoaded',()=>{
  const nav=document.querySelector('.bottom-nav');
  if(nav){nav.innerHTML=`<button data-page="home" class="nav-item active"><span>⌂</span><small>홈</small></button><button data-page="schedule" class="nav-item"><span>▦</span><small>시간표</small></button><button data-page="stats" class="nav-item"><span>▥</span><small>기록</small></button><button data-page="settings" class="nav-item"><span>♙</span><small>MY</small></button>`;nav.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>{page=button.dataset.page;render();nav.querySelectorAll('.nav-item').forEach(item=>item.classList.toggle('active',item===button))}))}
  document.querySelector('.brand')?.addEventListener('click',event=>{event.preventDefault();page='home';render()});
});

render();
