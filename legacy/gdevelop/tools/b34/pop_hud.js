/* ICE WOLF v1.2.0 Build 34 — the pop HUD.
 *
 * The play-test's fifth line: "the status lines on the play screen should read
 * pop and easy to see too". Until Build 34 the play screen's lines were the
 * GDevelop text objects the event sheet writes - white letters with a thin dark
 * outline, all the same size, laid out as a column of sentences. Readable, but
 * flat, and the smallest of them were hard to read on a phone.
 *
 * This block draws the same lines a second time, as the pills and chips a phone
 * game is read in: one rounded chip per fact, a big timer, a hint bar, a toast
 * and a winner banner - each with a gradient, a bright border, a dark floor and
 * the text's own weight. The words are not new: every chip shows the exact
 * string the event sheet just wrote (so all twelve languages, the HUD
 * translation pass and the text-size setting all keep working), and the native
 * text object is made transparent only after its line has been read.
 *
 * What this block may touch: the opacity of the ten HUD text objects, and its
 * own DOM. It never writes a rule, a timer, a role, a switch or a gate, and if
 * anything here fails the native text is left alone and the player sees exactly
 * the HUD they had before.
 */
const vars = runtimeScene.getVariables();
const tr = (key, params) => {
  const i18n = runtimeScene.__iceWolfI18n;
  return i18n && typeof i18n.t === 'function' ? i18n.t(key, params) : key;
};

/* ==== v1.2.0 pop HUD — testable block (tests/pro/v120-build34.test.mjs) ==== */
const ICE_WOLF_HUD_MIRROR = [
  { name: 'RoleText', chip: 'role' },
  { name: 'CountText', chip: 'count' },
  { name: 'SwitchText', chip: 'switch' },
  { name: 'GateText', chip: 'gate' },
  { name: 'FloorText', chip: 'floor' },
  { name: 'TimerText', chip: 'timer' },
  { name: 'StatusText', chip: 'hint' },
  { name: 'ActionFeedbackText', chip: 'toast' },
  { name: 'WinText', chip: 'win' }
];
const ICE_WOLF_HUD_RESERVE = ['BuildText'];
/* ==== end v1.2.0 pop HUD ==== */

const state = runtimeScene.__iceWolfV120PopHud || (runtimeScene.__iceWolfV120PopHud = {
  ready: false, failed: false, css: false, root: null, chips: {}, last: {}, opacityOk: false,
  rescuePill: null, rescueWasVisible: false, toastAt: 0
});

const CSS = [
  '[data-ice-wolf-b34-hud]{position:fixed;inset:0;pointer-events:none;z-index:2147482400;',
  '  font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP","Segoe UI",sans-serif;',
  '  --s:1;--pad:calc(env(safe-area-inset-left,0px) + 10px);--padt:calc(env(safe-area-inset-top,0px) + 8px);',
  '  -webkit-font-smoothing:antialiased}',
  /* a chip: one fact, rounded, with a bright rim and a dark floor so the words
   * read over ice, water, snow or neon */
  '[data-ice-wolf-b34-hud] .hud-chip{display:flex;align-items:center;gap:6px;border-radius:999px;',
  '  padding:calc(4px * var(--s)) calc(12px * var(--s));font-size:calc(15px * var(--s));line-height:1.15;',
  '  font-weight:900;letter-spacing:.02em;color:#fff;white-space:nowrap;',
  '  background:linear-gradient(180deg,rgba(96,196,255,.42),rgba(10,42,72,.82));',
  '  border:2px solid rgba(190,240,255,.72);box-shadow:0 3px 0 rgba(6,26,46,.55),0 6px 16px rgba(4,20,38,.45);',
  '  text-shadow:0 2px 0 rgba(6,26,46,.55),0 0 10px rgba(120,222,255,.35)}',
  '[data-ice-wolf-b34-hud] .hud-chip.pop{animation:hud-pop .34s cubic-bezier(.2,1.5,.35,1) both}',
  '@keyframes hud-pop{0%{transform:scale(.62);opacity:.2}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}',
  '[data-ice-wolf-b34-hud] .hud-left{position:absolute;left:var(--pad);top:var(--padt);display:flex;flex-direction:column;',
  '  align-items:flex-start;gap:calc(5px * var(--s));max-width:58vw}',
  '[data-ice-wolf-b34-hud] .hud-role{background:linear-gradient(180deg,#ffdf7a,#e9a01e);color:#2a1a00;',
  '  border-color:rgba(255,247,210,.95);text-shadow:0 1px 0 rgba(255,255,255,.45);',
  '  box-shadow:0 3px 0 rgba(120,70,0,.55),0 6px 16px rgba(80,40,0,.4)}',
  '[data-ice-wolf-b34-hud] .hud-role.wolf{background:linear-gradient(180deg,#ff8f7a,#c11d2e);color:#fff;',
  '  border-color:rgba(255,214,204,.95);text-shadow:0 2px 0 rgba(60,0,10,.6)}',
  '[data-ice-wolf-b34-hud] .hud-role.frozen{background:linear-gradient(180deg,#d8f6ff,#6fc7ef);color:#06283c;',
  '  border-color:rgba(255,255,255,.95)}',
  '[data-ice-wolf-b34-hud] .hud-count{background:linear-gradient(180deg,rgba(130,232,255,.5),rgba(8,54,88,.85))}',
  '[data-ice-wolf-b34-hud] .hud-switch{background:linear-gradient(180deg,rgba(198,160,255,.55),rgba(46,22,86,.86));',
  '  border-color:rgba(226,206,255,.8)}',
  '[data-ice-wolf-b34-hud] .hud-gate{background:linear-gradient(180deg,rgba(255,170,170,.5),rgba(84,20,30,.86));',
  '  border-color:rgba(255,206,206,.8)}',
  '[data-ice-wolf-b34-hud] .hud-gate.open{background:linear-gradient(180deg,rgba(150,255,190,.55),rgba(10,72,44,.86));',
  '  border-color:rgba(206,255,220,.85)}',
  '[data-ice-wolf-b34-hud] .hud-floor{font-size:calc(13px * var(--s));padding:calc(2px * var(--s)) calc(10px * var(--s));',
  '  background:linear-gradient(180deg,#9fe8ff,#2f8fc4);color:#04202e;border-color:rgba(255,255,255,.85);',
  '  text-shadow:0 1px 0 rgba(255,255,255,.5)}',
  /* the timer: the one number a player glances at */
  '[data-ice-wolf-b34-hud] .hud-timer{position:absolute;left:50%;top:var(--padt);transform:translateX(-50%);',
  '  display:flex;align-items:center;gap:8px;border-radius:999px;padding:calc(2px * var(--s)) calc(18px * var(--s));',
  '  font-size:calc(30px * var(--s));font-weight:900;letter-spacing:.02em;color:#fff;font-variant-numeric:tabular-nums;',
  '  background:linear-gradient(180deg,rgba(20,60,96,.55),rgba(4,20,38,.8));border:2px solid rgba(190,240,255,.75);',
  '  box-shadow:0 3px 0 rgba(4,18,34,.6),0 0 22px rgba(90,210,255,.35);text-shadow:0 2px 0 rgba(4,18,34,.6)}',
  '[data-ice-wolf-b34-hud] .hud-timer.hot{background:linear-gradient(180deg,rgba(255,120,90,.7),rgba(96,10,20,.9));',
  '  border-color:rgba(255,224,214,.9);animation:hud-pulse 1s ease-in-out infinite}',
  '@keyframes hud-pulse{0%,100%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-50%) scale(1.07)}}',
  /* the hint: the line that tells a player what to do next */
  '[data-ice-wolf-b34-hud] .hud-hint{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);',
  '  transform:translateX(-50%);max-width:min(74vw,760px);text-align:center;border-radius:999px;',
  '  padding:calc(5px * var(--s)) calc(18px * var(--s));font-size:calc(15px * var(--s));font-weight:900;color:#fff;',
  '  background:linear-gradient(180deg,rgba(16,56,88,.78),rgba(4,22,40,.9));border:2px solid rgba(150,232,255,.6);',
  '  box-shadow:0 4px 18px rgba(2,14,28,.5);text-shadow:0 2px 0 rgba(4,18,34,.6)}',
  /* the toast: a thing that just happened */
  '[data-ice-wolf-b34-hud] .hud-toast{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%) scale(.9);',
  '  border-radius:999px;padding:calc(8px * var(--s)) calc(26px * var(--s));font-size:calc(26px * var(--s));',
  '  font-weight:900;color:#fff;max-width:82vw;text-align:center;',
  '  background:linear-gradient(180deg,rgba(120,236,255,.92),rgba(16,110,168,.94));',
  '  border:3px solid rgba(255,255,255,.9);box-shadow:0 6px 0 rgba(6,34,56,.55),0 0 30px rgba(110,232,255,.6);',
  '  text-shadow:0 2px 0 rgba(6,34,56,.55)}',
  '[data-ice-wolf-b34-hud] .hud-toast.warm{background:linear-gradient(180deg,rgba(255,214,120,.95),rgba(190,86,16,.95))}',
  '[data-ice-wolf-b34-hud] .hud-toast.show{animation:hud-toast-in .42s cubic-bezier(.18,1.6,.3,1) both}',
  '@keyframes hud-toast-in{0%{transform:translate(-50%,-50%) scale(.5);opacity:0}',
  '  55%{transform:translate(-50%,-50%) scale(1.12);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}',
  /* the winner's banner */
  '[data-ice-wolf-b34-hud] .hud-win{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);',
  '  border-radius:28px;padding:calc(12px * var(--s)) calc(34px * var(--s));font-size:calc(40px * var(--s));',
  '  font-weight:900;color:#fff;max-width:88vw;text-align:center;letter-spacing:.04em;',
  '  background:linear-gradient(180deg,rgba(30,120,180,.92),rgba(6,30,54,.95));',
  '  border:4px solid rgba(220,248,255,.9);box-shadow:0 8px 0 rgba(4,18,34,.55),0 0 46px rgba(120,224,255,.55);',
  '  text-shadow:0 3px 0 rgba(4,18,34,.6),0 0 22px rgba(150,236,255,.65);animation:hud-pop .5s cubic-bezier(.2,1.5,.35,1) both}',
  /* the rescue button's own pill, drawn under the GDevelop text */
  '[data-ice-wolf-b34-hud] .hud-rescue{position:absolute;border-radius:999px;pointer-events:none;',
  '  background:linear-gradient(180deg,rgba(90,255,214,.55),rgba(6,84,72,.55));',
  '  border:2px solid rgba(190,255,238,.75);box-shadow:0 0 24px rgba(90,255,214,.45);',
  '  display:none;transform:translate(-50%,-50%)}',
  '[data-ice-wolf-b34-hud] .hud-rescue.show{display:block;animation:hud-pop .3s cubic-bezier(.2,1.5,.35,1) both}',
  '@media (max-height:430px){[data-ice-wolf-b34-hud] .hud-toast{top:26%}}'
].join('\n');

const build = () => {
  if (state.ready) return true;
  if (typeof document === 'undefined' || !document.body) return false;
  if (!state.css) {
    state.css = true;
    const style = document.createElement('style');
    style.setAttribute('data-ice-wolf-b34-hud-style', '1');
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const root = document.createElement('div');
  root.setAttribute('data-ice-wolf-b34-hud', '1');
  const left = document.createElement('div');
  left.className = 'hud-left';
  const make = (cls, parent) => {
    const el = document.createElement('div');
    el.className = 'hud-chip ' + cls;
    el.style.display = 'none';
    (parent || root).appendChild(el);
    return el;
  };
  const chips = {
    role: make('hud-role', left),
    count: make('hud-count', left),
    switch: make('hud-switch', left),
    gate: make('hud-gate', left),
    floor: make('hud-floor', left),
    timer: make('hud-timer', root),
    hint: make('hud-hint', root),
    toast: make('hud-toast', root),
    win: make('hud-win', root)
  };
  const rescue = document.createElement('div');
  rescue.className = 'hud-rescue';
  root.appendChild(rescue);
  root.appendChild(left);
  document.body.appendChild(root);
  state.root = root;
  state.chips = chips;
  state.rescuePill = rescue;
  state.ready = true;
  return true;
};

/* The one probe that decides whether the native lines may be made transparent:
 * if a text object cannot be faded, the DOM HUD would double every line, so it
 * is not turned on at all. */
const probe = () => {
  if (state.opacityOk) return true;
  for (const entry of ICE_WOLF_HUD_MIRROR) {
    const list = runtimeScene.getObjects(entry.name);
    if (!list.length) continue;
    const obj = list[0];
    if (typeof obj.setOpacity !== 'function' || typeof obj.getOpacity !== 'function') return false;
    try {
      const before = obj.getOpacity();
      obj.setOpacity(0);
      obj.setOpacity(before);
      state.opacityOk = true;
      return true;
    } catch (error) { return false; }
  }
  return false;
};

const setText = (chip, text) => {
  if (!chip) return;
  if (chip.__text !== text) {
    chip.__text = text;
    chip.textContent = text;
  }
};

const show = (chip, on) => {
  if (!chip) return;
  const want = on ? 'flex' : 'none';
  if (chip.style.display !== want) chip.style.display = want;
};

const bump = (chip, cls) => {
  if (!chip) return;
  chip.classList.remove('pop');
  /* force the animation to restart on the next frame */
  void chip.offsetWidth;
  chip.classList.add('pop');
};

if (build() && probe()) {
  const scale = Math.max(0.85, Math.min(1.6, vars.get('PlayerTextScale').getAsNumber() || 1));
  state.root.style.setProperty('--s', String(scale));
  const player = runtimeScene.getObjects('Player')[0] || null;
  let role = 'Human';
  let frozen = false;
  if (player) {
    try {
      role = player.getVariables().get('Role').getAsString();
      frozen = player.getVariables().get('State').getAsString() === 'Frozen';
    } catch (error) { /* keep the defaults */ }
  }
  for (const entry of ICE_WOLF_HUD_MIRROR) {
    const list = runtimeScene.getObjects(entry.name);
    const chip = state.chips[entry.chip];
    if (!list.length || !chip) continue;
    const obj = list[0];
    let text = '';
    let visible = false;
    try {
      text = String(obj.getString() || '');
      visible = obj.isVisible() === true;
    } catch (error) { continue; }
    /* The object's own visibility is the answer every frame: fading a text
     * object does not hide it, so Show/Hide in the event sheet still reaches
     * this block untouched. */
    if (!text) visible = false;
    state.last[entry.chip] = visible;
    if (entry.chip === 'role') {
      chip.classList.toggle('wolf', String(role) === 'Wolf');
      chip.classList.toggle('frozen', frozen === true);
    }
    if (entry.chip === 'gate') {
      let open = false;
      try { open = vars.get('GateUnlocked').getAsBoolean() === true; } catch (error) { open = false; }
      chip.classList.toggle('open', open);
    }
    if (entry.chip === 'timer') {
      let left = 0;
      try { left = vars.get('MatchTimeLeft').getAsNumber(); } catch (error) { left = 0; }
      const hot = left > 0 && left <= 30;
      if (chip.classList.contains('hot') !== hot) chip.classList.toggle('hot', hot);
    }
    if (entry.chip === 'toast') {
      if (visible && chip.__was !== true) {
        chip.classList.remove('show');
        void chip.offsetWidth;
        chip.classList.add('show');
      }
      if (!visible && chip.classList.contains('show')) chip.classList.remove('show');
      chip.__was = visible;
    }
    setText(chip, text);
    show(chip, visible);
    try { obj.setOpacity(0); } catch (error) { /* stays drawn */ }
  }
  /* the rescue button's pill: the same rectangle the GDevelop text occupies,
   * drawn behind it so the button reads as a button */
  const rescuePill = state.rescuePill;
  if (rescuePill) {
    const list = runtimeScene.getObjects('RescueButton');
    const button = list.length ? list[0] : null;
    let shown = false;
    if (button) {
      try {
        shown = button.isVisible() === true;
        if (shown) {
          const layer = runtimeScene.getLayer(button.getLayer());
          const game = runtimeScene.getGame();
          const gw = game.getGameResolutionWidth();
          const gh = game.getGameResolutionHeight();
          const canvas = document.querySelector('canvas');
          const rect = canvas ? canvas.getBoundingClientRect() : null;
          const pos = layer.convertInverseCoords(button.getX(), button.getY(), 0);
          const zoom = typeof layer.getCameraZoom === 'function' ? layer.getCameraZoom(0) : 1;
          if (rect) {
            const sx = rect.left + (pos[0] / gw) * rect.width;
            const sy = rect.top + (pos[1] / gh) * rect.height;
            const sw = (button.getWidth() * zoom / gw) * rect.width + 26;
            const sh = (button.getHeight() * zoom / gh) * rect.height + 18;
            rescuePill.style.left = sx + 'px';
            rescuePill.style.top = sy + 'px';
            rescuePill.style.width = sw + 'px';
            rescuePill.style.height = sh + 'px';
          }
        }
      } catch (error) { shown = false; }
    }
    if (rescuePill.classList.contains('show') !== shown) rescuePill.classList.toggle('show', shown);
    state.rescueWasVisible = shown;
  }
  vars.get('PlayerHudPopReady').setBoolean(true);
  vars.get('PlayerHudPopChips').setNumber(ICE_WOLF_HUD_MIRROR.length);
} else if (!state.failed) {
  state.failed = true;
  vars.get('PlayerHudPopReady').setBoolean(false);
  vars.get('PlayerHudPopChips').setNumber(0);
}
