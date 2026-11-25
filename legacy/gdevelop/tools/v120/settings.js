/* ICE WOLF v1.2.0 — the display and control settings.
 *
 * Three things the brief asks for, all of them in SETTINGS and all of them
 * remembered between launches:
 *
 *   1. TEXT SIZE (標準 / 大 / 特大). The menu sheets are scaled as a whole
 *      (`zoom` on the card, with the card's own width capped so it still fits
 *      the phone), and the GDevelop text objects on the ice are re-sized from
 *      the size they shipped with. The head bubbles follow through
 *      `PlayerTextScale`.
 *   2. VIBRATION (ON / OFF). A freeze, a wolf mode, a switch, a gate and a
 *      rescue each give one short buzz, through the Capacitor Haptics plugin
 *      when the native shell provides it, otherwise through navigator.vibrate.
 *   3. CONTROL (スティック / 直接タッチ). The shipped virtual stick stays exactly
 *      as it was; the second mode is the DOROKEI control: touch anywhere on the
 *      ice and drag from the finger — the vector that the stick would have
 *      written is written from the drag instead.
 *
 * Nothing here writes a rule, a timer, a role or a position: it writes the
 * three preference variables and the movement vector the existing movement
 * block already reads.
 */
const vars = runtimeScene.getVariables();
const tr = (key, params) => {
  const i18n = runtimeScene.__iceWolfI18n;
  return i18n && typeof i18n.t === 'function' ? i18n.t(key, params) : key;
};
const safeGet = (key, fallback) => {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const value = localStorage.getItem(key);
    return value === null ? fallback : String(value);
  } catch (error) { return fallback; }
};
const safeSet = (key, value) => {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, String(value)); } catch (error) { /* private mode */ }
};

/* ------------------------------------------------------------------ the state */
/* ==== v1.2.0 display settings — testable block (tests/pro/v120-build32.test.mjs) ==== */
const ICE_WOLF_TEXT_SIZES = [
  { id: 'standard', scale: 1.0 },
  { id: 'large', scale: 1.12 },
  { id: 'xlarge', scale: 1.26 }
];
const iceWolfTextScale = (id) => {
  for (const entry of ICE_WOLF_TEXT_SIZES) if (entry.id === id) return entry.scale;
  return 1.0;
};
const ICE_WOLF_CONTROL_MODES = ['stick', 'touch'];
const iceWolfControlMode = (value) => (String(value) === 'touch' ? 'touch' : 'stick');
/* ==== end v1.2.0 display settings ==== */
const TEXT_SIZES = ICE_WOLF_TEXT_SIZES.map((entry) => ({ id: entry.id, scale: entry.scale, label: 'display.' + entry.id }));
const scaleOf = iceWolfTextScale;
const state = runtimeScene.__iceWolfV120Settings || (runtimeScene.__iceWolfV120Settings = {
  built: false, touchBuilt: false, cssReady: false,
  textSize: '', vibration: null, control: '', signature: ''
});
if (!state.textSize) {
  const saved = safeGet('iceWolfTextSize', 'standard');
  state.textSize = scaleOf(saved) === scaleOf('standard') && saved !== 'standard' ? 'standard' : saved;
  if (['standard', 'large', 'xlarge'].indexOf(state.textSize) < 0) state.textSize = 'standard';
}
if (state.vibration === null) state.vibration = safeGet('iceWolfVibration', '1') !== '0';
if (!state.control) {
  const saved = safeGet('iceWolfControlMode', 'stick');
  state.control = iceWolfControlMode(saved);
}
const scale = scaleOf(state.textSize);
vars.get('PlayerTextSize').setString(state.textSize);
vars.get('PlayerTextScale').setNumber(scale);
vars.get('PlayerUiZoom').setNumber(scale);
vars.get('PlayerVibrationEnabled').setBoolean(state.vibration === true);
vars.get('PlayerControlMode').setString(state.control);
vars.get('PlayerDisplaySettingsReady').setBoolean(true);
vars.get('PlayerTextSizes').setNumber(TEXT_SIZES.length);

/* ------------------------------------------------------- the sheets: the scale */
if (typeof document !== 'undefined' && document.body && !state.cssReady) {
  state.cssReady = true;
  const style = document.createElement('style');
  style.setAttribute('data-ice-wolf-v120-display-style', '1');
  style.textContent = [
    ':root{--iw-ui-zoom:1}',
    'html[data-iw-text="large"]{--iw-ui-zoom:1.12}',
    'html[data-iw-text="xlarge"]{--iw-ui-zoom:1.26}',
    /* the whole card scales, and its own width/height are divided by the zoom so
     * that "特大" still fits inside the phone instead of running off the edge */
    '.iw-card,.iw-modal,.iwl-card,.iws-card,.iwp-card,.iwo-card{zoom:var(--iw-ui-zoom,1)}',
    'html[data-iw-text="large"] .iw-card,html[data-iw-text="xlarge"] .iw-card{min-height:auto}',
    '.iw-card{max-width:calc(96vw / var(--iw-ui-zoom,1))!important;max-height:calc((100dvh - 24px) / var(--iw-ui-zoom,1))!important}',
    '.iw-modal{max-width:calc(92vw / var(--iw-ui-zoom,1))!important;max-height:calc((100dvh - 24px) / var(--iw-ui-zoom,1))!important}',
    '.iwl-card{max-width:calc(100vw / var(--iw-ui-zoom,1))!important}',
    '.iws-card,.iwo-card{max-width:calc(96vw / var(--iw-ui-zoom,1))!important}',
    '.iwp-card{max-width:calc(92vw / var(--iw-ui-zoom,1))!important}',
    /* SETTINGS reads as compact columns on a landscape phone, so the rows the
     * game now has (players, wolves, switches, correct, role, time, trap, sound,
     * Pro, language, camera, movement, text size, vibration) are reachable
     * without hunting through a long scroll. A row is its label over its chips,
     * which is what fits in a 46vw column. */
    '[data-screen="settings"] .iw-modal{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-flow:row dense;column-gap:12px;align-content:start;width:min(1000px,96vw);padding:14px 16px}',
    '[data-screen="settings"] .iw-modal>h2{grid-column:1 / -1;font-size:clamp(20px,3vw,30px);margin:0 0 5px;text-align:left}',
    '[data-screen="settings"] .iw-modal>.iw-back{grid-column:1 / -1;min-height:38px;margin-top:6px;font-size:15px}',
    '[data-screen="settings"] .iw-small{font-size:10.5px!important;margin:4px 0 0;line-height:1.3;color:#93b4c7!important}',
    '[data-screen="settings"] .iw-setting{display:grid;grid-template-columns:1fr;gap:4px;align-items:stretch;margin:3px 0;padding:6px 9px;border-radius:12px}',
    '[data-screen="settings"] .iw-setting>span{font-size:12.5px;font-weight:800;color:#b6d5e6;letter-spacing:.4px}',
    '[data-screen="settings"] .iw-chips{flex:1 1 auto;gap:5px;flex-wrap:nowrap;justify-content:stretch}',
    '[data-screen="settings"] .iw-chip{flex:1 1 0;max-width:none;min-height:32px;padding:0 5px;border-radius:10px;font-size:12.5px;letter-spacing:0}',
    '[data-screen="settings"] .iw-setting>button{width:auto!important;min-height:32px!important;font-size:12.5px!important}',
    /* a landscape phone is 390px high: the rows come first, the explanations
     * stay reachable in portrait or by scrolling a taller sheet */
    '@media (max-height:560px){[data-screen="settings"] .iw-small,[data-screen="settings"] .iws-hint{display:none}}',
    '[data-screen="settings"] [data-ice-wolf-v110-match]{display:contents}',
    '[data-screen="settings"] [data-ice-wolf-v110-match] .iws-row{display:grid;grid-template-columns:1fr;gap:5px;margin:4px 0;padding:7px 10px;border-radius:12px}',
    '[data-screen="settings"] [data-ice-wolf-v110-match] .iws-row>span{font-size:12.5px;font-weight:800;color:#b6d5e6}',
    '[data-screen="settings"] [data-ice-wolf-v110-match] .iws-chips{gap:5px;flex-wrap:nowrap}',
    '[data-screen="settings"] [data-ice-wolf-v110-match] .iws-chip{flex:1 1 0!important;max-width:none!important;min-height:32px!important;padding:0 5px!important;font-size:12.5px!important}',
    '[data-screen="settings"] [data-ice-wolf-v110-match] .iws-hint{font-size:10.5px;margin:4px 0 0;line-height:1.3}',
    '@media (min-width:800px){[data-screen="settings"] .iw-modal{grid-template-columns:repeat(3,minmax(0,1fr))}}',
    '@media (max-width:720px){[data-screen="settings"] .iw-modal{grid-template-columns:1fr}}',
    /* the bubble, the stage name and the small print keep their own scale */
    '[data-ice-wolf-v065-production] .iw-stage-now{font-size:.5em}'
  ].join('\n');
  document.head.appendChild(style);
}
if (typeof document !== 'undefined' && document.documentElement) {
  document.documentElement.setAttribute('data-iw-text', state.textSize);
}

/* ---------------------------------------------------- the rows in SETTINGS */
const production = runtimeScene.__iceWolfV065ProductionUi;
const buildRows = () => {
  if (state.built) return true;
  if (typeof document === 'undefined' || !production || !production.root) return false;
  const screen = production.root.querySelector('[data-screen="settings"]');
  if (!screen) return false;
  const movementRow = screen.querySelector('[data-i18n="settings.movement"]');
  const row = movementRow && movementRow.closest ? movementRow.closest('.iw-setting') : null;
  if (!row || !row.parentNode) return false;
  const makeChipRow = (labelKey, action, chips) => {
    const wrap = document.createElement('div');
    wrap.className = 'iw-setting';
    wrap.setAttribute('data-ice-wolf-v120-row', action);
    const name = document.createElement('span');
    name.setAttribute('data-v120-label', action);
    name.textContent = tr(labelKey);
    const box = document.createElement('div');
    box.className = 'iw-chips';
    wrap.appendChild(name);
    wrap.appendChild(box);
    const buttons = {};
    for (const chip of chips) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'iw-btn iw-chip';
      button.setAttribute('data-v120-pick', action + ':' + chip.id);
      if (chip.width) button.style.maxWidth = chip.width;
      button.textContent = tr(chip.label);
      button.addEventListener('pointerdown', (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        if (action === 'textSize') {
          state.textSize = chip.id;
          safeSet('iceWolfTextSize', chip.id);
        } else if (action === 'control') {
          state.control = chip.id;
          safeSet('iceWolfControlMode', chip.id);
        }
        applyDisplay();
      }, { passive: false });
      box.appendChild(button);
      buttons[chip.id] = button;
    }
    row.parentNode.insertBefore(wrap, row);
    return { wrap: wrap, name: name, buttons: buttons };
  };
  const textRow = makeChipRow('settings.textSize', 'textSize', TEXT_SIZES);
  /* the movement row the game already had becomes the control chooser, so the
   * sheet carries ONE control row and not a second one beside it */
  const movementValue = row.querySelector('[data-i18n="settings.movementValue"]');
  if (movementValue && movementValue.parentNode) movementValue.parentNode.removeChild(movementValue);
  const movementChips = document.createElement('div');
  movementChips.className = 'iw-chips';
  const stickButton = document.createElement('button');
  stickButton.type = 'button';
  stickButton.className = 'iw-btn iw-chip';
  stickButton.setAttribute('data-v120-pick', 'control:stick');
  stickButton.textContent = tr('control.stick');
  stickButton.addEventListener('pointerdown', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    state.control = 'stick';
    safeSet('iceWolfControlMode', 'stick');
    applyDisplay();
  }, { passive: false });
  const touchButton = document.createElement('button');
  touchButton.type = 'button';
  touchButton.className = 'iw-btn iw-chip';
  touchButton.setAttribute('data-v120-pick', 'control:touch');
  touchButton.textContent = tr('control.touch');
  touchButton.addEventListener('pointerdown', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    state.control = 'touch';
    safeSet('iceWolfControlMode', 'touch');
    applyDisplay();
  }, { passive: false });
  movementChips.appendChild(stickButton);
  movementChips.appendChild(touchButton);
  row.appendChild(movementChips);
  /* vibration: one ON/OFF button, in the shape of the sound row */
  const vibrationRow = document.createElement('div');
  vibrationRow.className = 'iw-setting';
  vibrationRow.setAttribute('data-ice-wolf-v120-row', 'vibration');
  const vibrationLabel = document.createElement('span');
  vibrationLabel.setAttribute('data-v120-label', 'vibration');
  vibrationLabel.textContent = tr('settings.vibration');
  const vibrationButton = document.createElement('button');
  vibrationButton.type = 'button';
  vibrationButton.className = 'iw-btn';
  vibrationButton.style.width = '120px';
  vibrationButton.style.minHeight = '50px';
  vibrationButton.setAttribute('data-v120-pick', 'vibration');
  vibrationButton.addEventListener('pointerdown', (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    state.vibration = !state.vibration;
    safeSet('iceWolfVibration', state.vibration ? '1' : '0');
    if (state.vibration) buzz(30);
    applyDisplay();
  }, { passive: false });
  vibrationRow.appendChild(vibrationLabel);
  vibrationRow.appendChild(vibrationButton);
  textRow.wrap.parentNode.insertBefore(vibrationRow, textRow.wrap);
  const note = document.createElement('p');
  note.className = 'iw-small';
  note.setAttribute('data-v120-note', '1');
  row.parentNode.insertBefore(note, row.nextSibling);
  state.rows = {
    text: textRow, vibration: vibrationRow,
    vibrationButton: vibrationButton, movementChips: movementChips,
    stickButton: stickButton, touchButton: touchButton, note: note
  };
  state.built = true;
  if (runtimeScene.__iceWolfI18n && typeof runtimeScene.__iceWolfI18n.onChange === 'function') {
    runtimeScene.__iceWolfI18n.onChange(() => { state.built = false; });
  }
  return true;
};
buildRows();

/* The explanatory notes belong under the row they explain, not in a grid cell
 * of their own: folding them in keeps every row on one line of the sheet. */
const tidyHints = () => {
  if (typeof document === 'undefined' || !production || !production.root) return;
  const screen = production.root.querySelector('[data-screen="settings"]');
  if (!screen) return;
  for (const note of screen.querySelectorAll('p.iw-small, p.iws-hint')) {
    const previous = note.previousElementSibling;
    if (!previous) continue;
    if (!previous.classList) continue;
    if (!previous.classList.contains('iw-setting') && !previous.classList.contains('iws-row')) continue;
    if (note.parentNode === previous) continue;
    previous.appendChild(note);
    note.style.margin = '5px 0 0';
    note.style.gridColumn = 'auto';
  }
};
tidyHints();

const applyDisplay = () => {
  vars.get('PlayerTextScale').setNumber(scaleOf(state.textSize));
  vars.get('PlayerTextSize').setString(state.textSize);
  vars.get('PlayerVibrationEnabled').setBoolean(state.vibration === true);
  vars.get('PlayerControlMode').setString(state.control);
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-iw-text', state.textSize);
  }
  const rows = state.rows;
  if (!rows) return;
  const light = (button, on) => {
    if (!button) return;
    if (button.classList) button.classList.toggle('iw-on', on === true);
    button.setAttribute('aria-pressed', on === true ? 'true' : 'false');
  };
  for (const entry of TEXT_SIZES) light(rows.text.buttons[entry.id], state.textSize === entry.id);
  light(rows.stickButton, state.control !== 'touch');
  light(rows.touchButton, state.control === 'touch');
  rows.vibrationButton.textContent = state.vibration ? tr('vibration.on') : tr('vibration.off');
  light(rows.vibrationButton, state.vibration === true);
  rows.note.textContent = tr('display.note');
};
applyDisplay();

/* The rows are rebuilt when the language changes; the labels follow it. */
if (typeof document !== 'undefined' && state.rows) {
  const relabel = () => {
    const rows = state.rows;
    if (!rows) return;
    const setLabel = (node, key) => { if (node) node.textContent = tr(key); };
    setLabel(rows.text.name, 'settings.textSize');
    setLabel(rows.vibration.querySelector('[data-v120-label]'), 'settings.vibration');
    let i = 0;
    for (const entry of TEXT_SIZES) {
      setLabel(rows.text.buttons[entry.id], entry.label);
      i += 1;
    }
    setLabel(rows.stickButton, 'control.stick');
    setLabel(rows.touchButton, 'control.touch');
    applyDisplay();
  };
  if (runtimeScene.__iceWolfI18n && typeof runtimeScene.__iceWolfI18n.onChange === 'function' && !state.relabelled) {
    state.relabelled = true;
    runtimeScene.__iceWolfI18n.onChange(relabel);
  }
}

/* ------------------------------------------------- the HUD text objects' size */
const HUD_TEXT = ['RoleText', 'StatusText', 'TimerText', 'CountText', 'SwitchText', 'GateText',
  'FloorText', 'WinText', 'ActionFeedbackText', 'BuildText'];
const HUD_BUTTONS = ['WolfButton', 'RescueButton', 'InfectButton'];
const resizeText = (names, factor) => {
  for (const name of names) {
    for (const obj of runtimeScene.getObjects(name)) {
      if (!obj || typeof obj.setCharacterSize !== 'function' || typeof obj.getCharacterSize !== 'function') continue;
      let base = obj.__iceWolfV120BaseSize;
      if (!base) {
        base = obj.getCharacterSize();
        obj.__iceWolfV120BaseSize = base;
      }
      const wanted = Math.max(8, Math.round(base * factor));
      if (wanted !== obj.getCharacterSize()) obj.setCharacterSize(wanted);
    }
  }
};
resizeText(HUD_TEXT, scale);
resizeText(HUD_BUTTONS, 1 + (scale - 1) * 0.55);

/* ------------------------------------------------------ the direct-touch pad */
const phaseNow = () => vars.get('RoundPhase').getAsString();
const playingNow = () => (phaseNow() === 'Active' || runtimeScene.__iceWolfV065TestMode === true) && !vars.get('GameOver').getAsBoolean();
const buildTouch = () => {
  if (state.touchBuilt) return runtimeScene.__iceWolfV120Touch;
  if (typeof document === 'undefined' || !document.body) return null;
  state.touchBuilt = true;
  const root = document.createElement('div');
  root.setAttribute('data-ice-wolf-v120-touch', '1');
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.zIndex = '2147482480';
  root.style.display = 'none';
  root.style.touchAction = 'none';
  root.style.userSelect = 'none';
  root.style.webkitUserSelect = 'none';
  root.style.webkitTapHighlightColor = 'transparent';
  const ring = document.createElement('div');
  ring.style.position = 'fixed';
  ring.style.width = '104px';
  ring.style.height = '104px';
  ring.style.marginLeft = '-52px';
  ring.style.marginTop = '-52px';
  ring.style.borderRadius = '50%';
  ring.style.border = '2px solid rgba(158,236,255,0.55)';
  ring.style.background = 'radial-gradient(circle, rgba(158,236,255,0.10), rgba(10,40,64,0.16) 70%, rgba(10,40,64,0))';
  ring.style.boxShadow = '0 0 18px rgba(95,224,255,0.22)';
  ring.style.pointerEvents = 'none';
  ring.style.opacity = '0';
  ring.style.transition = 'opacity .18s ease';
  const knob = document.createElement('div');
  knob.style.position = 'absolute';
  knob.style.left = '50%';
  knob.style.top = '50%';
  knob.style.width = '36px';
  knob.style.height = '36px';
  knob.style.marginLeft = '-18px';
  knob.style.marginTop = '-18px';
  knob.style.borderRadius = '50%';
  knob.style.background = 'radial-gradient(circle at 36% 30%, rgba(255,255,255,0.98), rgba(140,226,255,0.95) 60%, rgba(24,120,168,0.95))';
  knob.style.boxShadow = '0 3px 10px rgba(0,0,0,0.35)';
  ring.appendChild(knob);
  root.appendChild(ring);
  document.body.appendChild(root);
  const pad = { root: root, ring: ring, knob: knob, pointer: null, anchorX: 0, anchorY: 0 };
  const DEAD = 10;
  const RANGE = 52;
  const clear = () => {
    pad.pointer = null;
    vars.get('JoystickActive').setBoolean(false);
    vars.get('JoystickX').setNumber(0);
    vars.get('JoystickY').setNumber(0);
    ring.style.opacity = '0';
    knob.style.transform = 'translate(0px,0px)';
  };
  const track = (clientX, clientY) => {
    const dx = clientX - pad.anchorX;
    const dy = clientY - pad.anchorY;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < DEAD) {
      vars.get('JoystickActive').setBoolean(false);
      knob.style.transform = 'translate(0px,0px)';
      return;
    }
    const ux = dx / length;
    const uy = dy / length;
    vars.get('JoystickActive').setBoolean(true);
    vars.get('JoystickX').setNumber(ux);
    vars.get('JoystickY').setNumber(uy);
    const visual = Math.min(length, RANGE * 0.62);
    knob.style.transform = 'translate(' + ux * visual + 'px,' + uy * visual + 'px)';
  };
  root.addEventListener('pointerdown', (event) => {
    if (!playingNow()) return;
    if (pad.pointer !== null) return;
    event.preventDefault();
    pad.pointer = event.pointerId;
    pad.anchorX = event.clientX;
    pad.anchorY = event.clientY;
    ring.style.left = event.clientX + 'px';
    ring.style.top = event.clientY + 'px';
    ring.style.opacity = '1';
    try { root.setPointerCapture(event.pointerId); } catch (error) { /* older WebViews */ }
    track(event.clientX, event.clientY);
  }, { passive: false });
  root.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pad.pointer) return;
    event.preventDefault();
    track(event.clientX, event.clientY);
  }, { passive: false });
  root.addEventListener('pointerup', (event) => { if (event.pointerId === pad.pointer) clear(); }, { passive: true });
  root.addEventListener('pointercancel', (event) => { if (event.pointerId === pad.pointer) clear(); }, { passive: true });
  window.addEventListener('blur', clear);
  window.addEventListener('pagehide', clear);
  runtimeScene.__iceWolfV120Touch = pad;
  return pad;
};
const pad = buildTouch();
const touchOn = state.control === 'touch';
if (pad) {
  const showPad = touchOn && playingNow();
  pad.root.style.display = showPad ? 'block' : 'none';
  if (!showPad && pad.pointer !== null) {
    pad.pointer = null;
    vars.get('JoystickActive').setBoolean(false);
    vars.get('JoystickX').setNumber(0);
    vars.get('JoystickY').setNumber(0);
    pad.ring.style.opacity = '0';
  }
  const joystick = runtimeScene.__iceWolfV063JoystickUi;
  if (joystick && joystick.root) {
    /* The stick block shows its own pad while a round runs; in touch mode the
     * pad is this block's, so this line (which runs later) keeps it off. */
    if (touchOn) joystick.root.style.display = 'none';
  }
}

/* --------------------------------------------------------------- the buzz */
const hapticsPlugin = () => {
  try {
    const capacitor = typeof window !== 'undefined' ? window.Capacitor : null;
    return capacitor && capacitor.Plugins && capacitor.Plugins.Haptics ? capacitor.Plugins.Haptics : null;
  } catch (error) { return null; }
};
const buzz = (pattern) => {
  if (state.vibration !== true) return;
  const plugin = hapticsPlugin();
  if (plugin && typeof plugin.impact === 'function') {
    const strength = pattern >= 60 ? 'HEAVY' : pattern >= 30 ? 'MEDIUM' : 'LIGHT';
    try {
      const answer = plugin.impact({ style: strength });
      if (answer && typeof answer.catch === 'function') answer.catch(() => {});
    } catch (error) { /* fall through to the web vibration */ }
    return;
  }
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch (error) { /* nothing vibrates on this phone */ }
};
/* The last frame's readings, so a buzz fires on the change, never every frame. */
const watch = runtimeScene.__iceWolfV120HapticWatch || (runtimeScene.__iceWolfV120HapticWatch = {
  frozen: null, wolfMode: null, switches: null, gate: null, rescues: null, seen: 0
});
const player = runtimeScene.getObjects('Player')[0] || null;
if (player) {
  const pv = player.getVariables();
  const frozen = pv.get('State').getAsString() === 'Frozen';
  if (watch.frozen !== null && frozen && !watch.frozen) buzz(65);
  watch.frozen = frozen;
}
const wolfMode = vars.get('WolfModeLeft').getAsNumber();
if (watch.wolfMode !== null && wolfMode > 0 && !(watch.wolfMode > 0)) buzz(35);
watch.wolfMode = wolfMode;
const switches = vars.get('SwitchActiveCount').getAsNumber();
if (watch.switches !== null && switches > watch.switches) buzz(25);
watch.switches = switches;
const gate = vars.get('GateUnlocked').getAsBoolean();
if (watch.gate !== null && gate && !watch.gate) buzz(110);
watch.gate = gate;
const rescues = vars.get('RescueHoldCount').getAsNumber();
if (watch.rescues !== null && rescues > watch.rescues) buzz(30);
watch.rescues = rescues;
watch.seen += 1;
vars.get('PlayerHapticTriggers').setNumber(watch.seen);
