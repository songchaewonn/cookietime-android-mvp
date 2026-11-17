(function (root) {
  'use strict';
  const PALETTES = [
    { top: '#f7cf93', edge: '#c8a178', chip: '#c5533b' },
    { top: '#f9b968', edge: '#da984c', chip: '#3e2723' },
    { top: '#f9ba6c', edge: '#d9964b', chip: '#ffebbc' },
    { top: '#b96f27', edge: '#905a23', chip: '#ffebbc' },
    { top: '#a5b650', edge: '#73852a', chip: '#7d8c2c' },
    { top: '#f7cf93', edge: '#c8a178', chip: '#3e2723' }
  ];
  const POSITIONS = [
    [142, -2], [159, 10], [110, -7], [140, 7], [119, -4], [133, 5],
    [111, -8], [137, 5], [125, -3], [109, -5], [150, 6], [133, 3]
  ];
  function cookie(index, x, y, options = {}) {
    const p = PALETTES[index % PALETTES.length], angle = options.angle ?? POSITIONS[index % 12][1];
    return `<g transform="translate(${x} ${y}) rotate(${angle} 62 34)"><g class="cookie-piece${options.fresh ? ' is-new' : ''}" style="--delay:${options.delay || 0}ms"><g transform="scale(.886)">
      <path d="M1 35C-2 53 25 70 66 72c42 3 75-9 74-27l-1-12C129 15 11 9 1 35Z" fill="${p.edge}"/>
      <path d="M1 34C1 15 31 0 68 0c38 0 69 16 72 34 5 21-24 29-66 26C33 59-1 52 1 34Z" fill="${p.top}"/>
      <g fill="${p.chip}"><rect x="30" y="37" width="9" height="10" rx="1.5" transform="rotate(-9 34 42)"/><rect x="60" y="16" width="7" height="8" rx="1.4" transform="rotate(25 64 20)"/><rect x="84" y="14" width="12" height="12" rx="2" transform="rotate(39 90 20)"/><rect x="94" y="37" width="12" height="12" rx="2" transform="rotate(16 100 43)"/></g>
    </g></g></g>`;
  }
  function cloud(x, y, scale = 1, opacity = 1) {
    return `<g transform="translate(${x} ${y}) scale(${scale})" opacity="${opacity}"><path d="M4 31C-8 13 21 1 46 3c9-26 43-30 57-11 24-1 40 12 38 27 21-1 22 20 8 23H80C48 55 12 49 4 31Z" fill="#fff"/></g>`;
  }
  function mountainScene(h, stage) {
    const cloudStage = stage === 'cloud', forest = stage === 'forest';
    return `<rect width="390" height="${h}" fill="url(#${cloudStage ? 'cloud-sky' : 'day-sky'})"/>
      <ellipse cx="244" cy="45" rx="135" ry="109" fill="url(#sun-glow)"/>
      <g fill="#e7b574" opacity=".75"><circle cx="52" cy="123" r="2.5"/><circle cx="90" cy="163" r="3"/><circle cx="315" cy="113" r="3.5"/><circle cx="345" cy="143" r="2"/><path d="m315 119 2 5-2 8-2-6Z"/></g>
      <g class="cloud-drift">${cloud(228, 170, 1.05)}${cloud(8, h * .381, .93)}${cloudStage ? cloud(140, h * .44, 1.3, .75) + cloud(245, h * .57, 1.05, .6) : ''}</g>
      <g transform="translate(0 ${h - 460})">
      <path d="M-12 133 44 66 78 95 128 25 173 79 221 7 269 71 312 19 361 77 410 29V300H-12Z" fill="${forest ? '#c0c7a0' : '#e2e2e2'}"/>
      <g fill="${forest ? '#d8ddbd' : '#fff'}"><path d="m116 40 12-15 12 15Z"/><path d="m208 24 13-17 13 17Z"/><path d="m300 33 12-14 12 14Z"/></g>
      <path d="M-8 139Q62 93 113 117t70 16l42-38 46 12 32-24q54 22 103 7V310H-8Z" fill="${forest ? '#e0e4c7' : '#fff'}"/>
      <g fill="${forest ? '#7c8e5b' : '#725044'}"><path d="m44 130 3-10 3 10Zm8-2 3-12 3 12Zm7 1 3-10 3 10Zm55 11 3-10 3 10Zm6-3 3-10 3 10Zm140-30 3-11 3 11Zm6-2 3-12 3 12Zm8 3 3-10 3 10Z"/></g>
      <path d="M-8 198Q63 155 132 167t88 17q82 5 160-46l23 10v190H-8Z" fill="${forest ? '#bac68a' : '#f5f3f0'}"/>
      <path d="M-10 261Q52 227 112 234t87 17q89 27 186-44l23 8v400H-10Z" fill="${forest ? '#d4ddaf' : '#e9dec9'}"/>
      </g>
      ${forest ? `<g fill="#92a96d" opacity=".9"><path d="M-20 ${h - 290} 30 ${h - 380} 80 ${h - 290}Zm20 0 30-50 30 50Z"/><path d="m317 ${h - 278} 45-97 45 97Zm8-38 37-75 37 75Z"/></g>` : ''}
      ${cloudStage ? `<g opacity=".9">${cloud(-15, h - 280, 1.5)}${cloud(210, h - 345, 1.5)}${cloud(35, h - 220, 2.3, .6)}</g>` : ''}
      <g stroke="#b2a29b" stroke-width="1.6" fill="none" opacity=".7" transform="translate(305 ${h * .4})"><path d="M0 3q5-5 10 0 5-5 10 0"/><path d="m19 17q4-4 8 0 4-4 8 0" stroke-width="1.4" opacity=".8"/></g>`;
  }
  function spaceScene(h) {
    let stars = '';
    const points = [[34, 70, 4.5], [70, 132, 5.5], [307, 30, 4.5], [363, 89, 3], [53, 283, 1.8], [330, 238, 1.4], [286, 166, 1.1], [97, 415, 1.2], [350, 430, 1.5], [24, 480, 1], [272, 362, 1.3], [186, 220, 1], [109, 90, 1.2], [304, 488, 1.1]];
    points.forEach((p, i) => { stars += `<circle class="star-blink" style="--delay:${i % 4}s" cx="${p[0]}" cy="${p[1]}" r="${p[2]}" fill="${i % 3 ? '#d9d2a5' : '#ebd983'}" opacity="${i < 4 ? '.8' : '.4'}"/>`; });
    return `<rect width="390" height="${h}" fill="url(#space-sky)"/>${stars}
      <path d="m338 45 2.2 6 6.5 1.8-6.5 1.7-2.2 6-1.5-6-6.5-1.7 6.5-1.8Z" fill="#ffe78b" class="star-blink"/>
      <g transform="translate(326 ${h * .37}) rotate(-17)"><ellipse rx="35" ry="10" fill="none" stroke="#f2cf8d" stroke-width="2.7" stroke-dasharray="3 2"/><circle r="17" fill="#f5e4b7"/><path d="M-8-14C9-15 16 0 11 12 23-1 10-22-8-14Z" fill="#fffae7"/><g fill="#d9ba85"><circle cx="-5" cy="-2" r="1.6"/><circle cx="2" cy="5" r="2.2"/></g><path d="M-35 0Q-33 16 4 11t31-10" fill="none" stroke="#f3ce86" stroke-width="2.7"/></g>
      <g transform="translate(90 ${h * .49})"><circle r="19" fill="#ecdfb7"/><ellipse cx="-3" cy="-3" rx="17" ry="18" fill="#f5edce"/><g fill="#dfce9e"><circle cx="5" cy="-5" r="3"/><circle cx="-6" cy="4" r="2.2"/><circle cx="3" cy="6" r="1.7"/></g></g>
      <g transform="translate(342 ${h - 267})"><circle r="20" fill="#b4afcf"/><ellipse cx="-4" cy="-3" rx="17" ry="18" fill="#cdc5dd"/><circle cx="4" cy="-7" r="2.3" fill="#b3a0c3"/><path d="M-19 1Q0 13 18-1" stroke="#a0a7cb" stroke-width="2" fill="none"/></g>
      <ellipse cx="195" cy="${h + 105}" rx="293" ry="327" fill="url(#earth-gradient)"/>
      <path d="M-40 ${h - 130}Q195 ${h - 300} 430 ${h - 130}" stroke="#377db0" stroke-opacity=".2" stroke-width="25" fill="none"/>`;
  }
  function scene(options) {
    const { count, height, stage } = options, h = options.viewHeight || 851;
    const isSpace = stage.id === 'space';
    const visibleCount = Math.min(count, height >= 1000 ? 12 : 6);
    const maxStep = visibleCount > 6 ? Math.min(33, (h - 470) / Math.max(1, visibleCount - 1)) : 33;
    const baseY = h - 267;
    let cookies = '';
    for (let n = 0; n < visibleCount; n++) {
      const [x] = POSITIONS[n % 12];
      cookies += cookie(n, x, baseY - n * maxStep, { fresh: options.animate && n >= visibleCount - Math.min(options.animate, visibleCount), delay: Math.max(0, n - (visibleCount - options.animate)) * 160 });
    }
    let ruler = '';
    const rulerBottom = h - 267;
    const rulerTop = rulerBottom - Math.max(0, visibleCount - 1) * maxStep;
    const rulerStep = (rulerBottom - rulerTop) / 5;
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((height * (5 - i)) / 5);
      const label = value >= 1000 ? `${Number((value / 1000).toFixed(1))}km` : `${value}m`;
      const y = rulerTop + i * rulerStep;
      ruler += `<path d="M12 ${y}h12" stroke="currentColor" stroke-width="1"/><text x="30" y="${y + 4}" font-size="10.5" fill="currentColor" font-family="Arial, sans-serif" font-weight="600">${label}</text>`;
      if (i < 5) ruler += `<path d="M16 ${y + rulerStep / 2}h6" stroke="currentColor" stroke-width=".85" opacity=".6"/>`;
    }
    return `<defs>
      <linearGradient id="day-sky" x2="0" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#dbf0ff"/></linearGradient>
      <linearGradient id="cloud-sky" x2="0" y2="1"><stop stop-color="#dcecf9"/><stop offset=".65" stop-color="#e6f2fb"/><stop offset="1" stop-color="#faf6ee"/></linearGradient>
      <radialGradient id="sun-glow"><stop stop-color="#fff0c3" stop-opacity=".8"/><stop offset="1" stop-color="#fff0c3" stop-opacity="0"/></radialGradient>
      <linearGradient id="space-sky" x2="0" y2="1"><stop stop-color="#090b1c"/><stop offset=".65" stop-color="#141e42"/><stop offset="1" stop-color="#2b6798"/></linearGradient>
      <linearGradient id="earth-gradient"><stop stop-color="#1a4977"/><stop offset="1" stop-color="#08172f"/></linearGradient>
    </defs>
    <g class="scene-background">${isSpace ? spaceScene(h) : mountainScene(h, stage.id)}</g>
    <g color="${isSpace ? '#bec7d8' : '#9e8b7e'}">${ruler}</g>
    <g class="tower-stack${options.animate ? ' landed' : ''}">
      <ellipse cx="199" cy="${h - 176}" rx="109" ry="4" fill="#6d5032" opacity=".05"/>
      <path d="m81 ${h - 184} 30-37q4-3 18-3h143q12 0 16 4l33 37q4 6-6 6H87q-11 0-6-7Z" fill="#3e2723"/>
      <path d="m95 ${h - 186} 27-31q4-3 11-3h133q10 0 14 4l25 29q3 4-4 4H99q-7 0-4-3Z" fill="#805d49"/>
      ${cookies}
    </g>`;
  }
  function thumbnail(id) {
    if (id === 'space') return `<svg viewBox="0 0 70 48" aria-hidden="true"><rect width="70" height="48" fill="#151b36"/><g fill="#f1dd99"><circle cx="13" cy="12" r="1.1"/><circle cx="56" cy="8" r="1.3"/><path d="m48 20 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/></g><path d="M-10 54Q31 13 81 55" fill="#31517b"/><circle cx="27" cy="20" r="5" fill="#eee1b6"/><ellipse cx="27" cy="20" rx="9" ry="2" fill="none" stroke="#dfc280" stroke-width="1"/></svg>`;
    if (id === 'cloud') return `<svg viewBox="0 0 70 48" aria-hidden="true"><rect width="70" height="48" fill="#d8e8f5"/><circle cx="51" cy="9" r="9" fill="#f3e7c2"/><g fill="#fff"><ellipse cx="16" cy="34" rx="28" ry="12"/><ellipse cx="52" cy="24" rx="24" ry="10"/><ellipse cx="43" cy="43" rx="37" ry="11"/></g></svg>`;
    if (id === 'forest') return `<svg viewBox="0 0 70 48" aria-hidden="true"><rect width="70" height="48" fill="#e8ecdb"/><circle cx="52" cy="11" r="7" fill="#f2dca9"/><path d="M-5 45Q35 4 77 47" fill="#becb95"/><path d="M-5 48Q28 22 78 44v4" fill="#8d9f65"/><g fill="#748b56"><path d="m7 35 8-21 8 21Zm38 4 9-23 9 23Z"/></g></svg>`;
    return `<svg viewBox="0 0 70 48" aria-hidden="true"><rect width="70" height="48" fill="#e7f2fa"/><circle cx="53" cy="10" r="8" fill="#f7e6b9"/><path d="m-5 48 27-33 20 22 12-24 26 35" fill="#d1d4d1"/><g fill="#fff"><path d="m16 22 6-7 6 7Zm33-1 5-8 6 8Z"/><path d="M-3 46q20-15 39-6t39-6v14H-3Z"/></g></svg>`;
  }
  root.CookieTowerArt = { scene, cookie, thumbnail };
})(globalThis);
