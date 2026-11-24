/* ICE WOLF v1.2.0 — the opening: a 1.9 second chase.
 *
 * The icon's world, drawn with the same run cycles the ice uses: the red-horned
 * wolf bursts in from the left, the two humans run ahead of it, snow crosses the
 * frame and the title lands. It is CSS animation on three pictures and nothing
 * else — no canvas, no per-frame script, no WebGL work while the game is still
 * building its first frame.
 *
 * Rules the brief sets, and how they are met:
 *   - about 1.5-2 seconds: 1.9s, then a 0.3s fade;
 *   - tap anywhere to skip: a pointerdown finishes it at once;
 *   - no DOM left behind and no stray click: the whole overlay is removed from
 *     the document, and the skip gesture is consumed (stopPropagation) so the
 *     menu button underneath never sees it.
 */
const tr = (key, params) => {
  const i18n = runtimeScene.__iceWolfI18n;
  return i18n && typeof i18n.t === 'function' ? i18n.t(key, params) : key;
};
const vars = runtimeScene.getVariables();
if (typeof document === 'undefined' || !document.body) {
  vars.get('PlayerOpeningState').setString('unavailable');
} else if (!runtimeScene.__iceWolfV120Opening) {
  const state = { root: null, timer: null, done: false };
  runtimeScene.__iceWolfV120Opening = state;
  const root = document.createElement('div');
  root.setAttribute('data-ice-wolf-v120-opening', '1');
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <style>
      [data-ice-wolf-v120-opening="1"]{position:fixed;inset:0;z-index:2147483646;overflow:hidden;pointer-events:auto;
        background:radial-gradient(circle at 50% 118%,rgba(120,214,255,.30),transparent 60%),linear-gradient(160deg,#03101f,#062a45 46%,#0a3d5e 72%,#031018);
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;touch-action:manipulation;
        transition:opacity .3s ease;opacity:1}
      [data-ice-wolf-v120-opening="1"].iw120-out{opacity:0}
      .iw120-snow{position:absolute;inset:-20%;background-image:
        radial-gradient(circle,rgba(255,255,255,.85) 1.4px,transparent 1.6px),
        radial-gradient(circle,rgba(200,240,255,.55) 1.1px,transparent 1.3px);
        background-size:64px 64px,41px 41px;background-position:0 0,17px 23px;
        animation:iw120snow 2.2s linear infinite;opacity:.55}
      @keyframes iw120snow{from{transform:translate3d(0,-24px,0)}to{transform:translate3d(-18px,24px,0)}}
      .iw120-ice{position:absolute;left:-4%;right:-4%;bottom:-8%;height:42%;
        background:linear-gradient(180deg,rgba(186,240,255,.10),rgba(120,200,235,.42) 60%,rgba(220,248,255,.62));
        clip-path:polygon(0 62%,8% 40%,15% 58%,24% 26%,33% 52%,42% 34%,52% 58%,61% 30%,71% 52%,80% 36%,90% 58%,100% 42%,100% 100%,0 100%);
        animation:iw120shake .5s ease-out both}
      @keyframes iw120shake{from{transform:translateY(26px)}to{transform:translateY(0)}}
      .iw120-stage{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;padding:0 0 8%}
      .iw120-line{display:flex;align-items:flex-end;gap:2vw;width:min(96vw,980px);justify-content:center}
      .iw120-fig{width:22vw;max-width:150px;aspect-ratio:1/1;background-repeat:no-repeat;background-size:400% 100%;
        background-position:0 0;filter:drop-shadow(0 10px 14px rgba(0,0,0,.45));animation:iw120run .44s step-end infinite}
      .iw120-fig.iw120-wolf{width:28vw;max-width:188px;animation-delay:-.11s}
      .iw120-fig.a{animation-delay:-.05s}
      .iw120-fig.b{animation-delay:-.16s}
      @keyframes iw120run{0%,24%{background-position:0 0}25%,49%{background-position:33.34% 0}50%,74%{background-position:66.67% 0}75%,100%{background-position:100% 0}}
      .iw120-bob{animation:iw120bob .32s ease-in-out infinite alternate}
      @keyframes iw120bob{from{transform:translateY(0)}to{transform:translateY(-4px)}}
      .iw120-title{position:absolute;left:0;right:0;top:14%;text-align:center;pointer-events:none;
        animation:iw120title .55s cubic-bezier(.2,1.2,.3,1) both}
      .iw120-name{font-size:clamp(46px,11vw,96px);font-weight:950;letter-spacing:3px;line-height:.9;
        background:linear-gradient(#f2fdff,#7ad9ff 58%,#bff0ff);-webkit-background-clip:text;background-clip:text;color:transparent;
        text-shadow:0 0 26px rgba(59,196,255,.35),0 0 44px rgba(255,79,96,.28)}
      .iw120-tag{margin:8px 0 0;font-size:clamp(12px,2.2vw,20px);font-weight:800;color:#dff4ff;text-shadow:0 0 14px rgba(60,180,255,.4);opacity:.95}
      @keyframes iw120title{from{opacity:0;transform:translateY(-14px) scale(.96)}to{opacity:1;transform:none}}
      .iw120-skip{position:absolute;right:14px;bottom:12px;font-size:12px;font-weight:900;letter-spacing:1.4px;color:rgba(226,246,255,.72)}
      @media (prefers-reduced-motion:reduce){[data-ice-wolf-v120-opening="1"] *{animation:none!important}}
    </style>
    <div class="iw120-snow"></div>
    <div class="iw120-ice"></div>
    <div class="iw120-title"><div class="iw120-name">ICE WOLF</div><p class="iw120-tag"></p></div>
    <div class="iw120-stage"><div class="iw120-line">
      <div class="iw120-bob"><div class="iw120-fig iw120-wolf" data-fig="w1"></div></div>
      <div class="iw120-bob"><div class="iw120-fig a" data-fig="h1"></div></div>
      <div class="iw120-bob"><div class="iw120-fig b" data-fig="h2"></div></div>
    </div></div>
    <div class="iw120-skip">TAP</div>`;
  document.body.appendChild(root);
  state.root = root;
  const tag = root.querySelector('.iw120-tag');
  if (tag) tag.textContent = tr('menu.tagline');
  let base = '';
  try {
    const game = runtimeScene.getGame();
    base = game && typeof game.getAssetPath === 'function' ? (game.getAssetPath() || '') : '';
  } catch (error) { base = ''; }
  const pictures = { w1: 'chr_w1_classic.png', h1: 'chr_h1_classic.png', h2: 'chr_h2_classic.png' };
  for (const fig of root.querySelectorAll('[data-fig]')) {
    const name = pictures[fig.getAttribute('data-fig')];
    if (!name) continue;
    fig.style.backgroundImage = 'url("' + base + name + '")';
  }
  const finish = () => {
    if (state.done) return;
    state.done = true;
    if (state.timer) clearTimeout(state.timer);
    root.classList.add('iw120-out');
    const remove = () => {
      if (root.parentNode) root.parentNode.removeChild(root);
      vars.get('PlayerOpeningState').setString('closed');
    };
    setTimeout(remove, 320);
  };
  const onSkip = (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    finish();
  };
  root.addEventListener('pointerdown', onSkip, { passive: false });
  root.addEventListener('click', onSkip, { passive: false });
  state.timer = setTimeout(finish, 1900);
  vars.get('PlayerOpeningState').setString('playing');
  vars.get('PlayerOpeningSeconds').setNumber(1.9);
}
