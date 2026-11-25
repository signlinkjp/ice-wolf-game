/* ------------------------------------------------------ the direct-touch pad
 *
 * Build 33 put a full-screen <div> over the canvas and started the stick from
 * its pointerdown. That div also sat over every button GDevelop draws, so the
 * play-test's [ 救助 ] button lit up and did nothing: the pointer never reached
 * the canvas, and the button's own IsPressed never saw a finger. The rescue was
 * gone in the direct-touch mode.
 *
 * Build 34 keeps the gesture but takes the div out of the way:
 *
 *   1. the div is decoration only (pointer-events: none). Nothing is blocked.
 *   2. the gesture is read at the window, in the capture phase, and only when
 *      the touch actually landed on the game's canvas - a DOM button (MENU, CAM,
 *      a sheet) is left completely alone.
 *   3. before a touch becomes movement, the point is tested against every HUD
 *      button that is on screen right then (the rescue, the wolf and the infect
 *      buttons, the debug set and the d-pad), using the same camera conversion
 *      GDevelop uses for its own hit test. A touch on a button is not movement:
 *      it is handed straight to the canvas, which is exactly what the button
 *      needs.
 *   4. everything else is movement, as before: the ring appears under the thumb
 *      and the vector the old stick would have written is written from the drag.
 *
 * The stick mode is untouched: that pad is its own 174px element in the corner
 * and never covered anything.
 */
const phaseNow = () => vars.get('RoundPhase').getAsString();
const playingNow = () => (phaseNow() === 'Active' || runtimeScene.__iceWolfV065TestMode === true) && !vars.get('GameOver').getAsBoolean();
/* Every object a finger is meant to press. All of them carry the ButtonFSM
 * behaviour the event sheet's "is clicked / is pressed" conditions read. */
const HUD_TOUCH_OBJECTS = [
  'WolfButton', 'RescueButton', 'InfectButton',
  'TestRoleButton', 'TestResetButton', 'CpuWolfTestButton',
  'Dpad_N', 'Dpad_NE', 'Dpad_E', 'Dpad_SE', 'Dpad_S', 'Dpad_SW', 'Dpad_W', 'Dpad_NW'
];
const touchCanvas = () => {
  try {
    const renderer = runtimeScene.getGame().getRenderer();
    if (renderer && typeof renderer.getCanvas === 'function') return renderer.getCanvas();
  } catch (error) { /* no canvas yet */ }
  try {
    return typeof document !== 'undefined' ? document.querySelector('canvas') : null;
  } catch (error) { return null; }
};
/* Does a screen point land on a HUD control? Uses the layer's own camera
 * conversion (the same one GDevelop's cursor test uses), plus a few pixels of
 * slack, so a thumb on the edge of the button still counts as the button. */
const onHudControl = (clientX, clientY) => {
  const canvas = touchCanvas();
  if (!canvas || typeof canvas.getBoundingClientRect !== 'function') return false;
  let rect = null;
  try { rect = canvas.getBoundingClientRect(); } catch (error) { return false; }
  if (!rect || !rect.width || !rect.height) return false;
  let gw = 0;
  let gh = 0;
  try {
    const game = runtimeScene.getGame();
    gw = game.getGameResolutionWidth();
    gh = game.getGameResolutionHeight();
  } catch (error) { return false; }
  if (!(gw > 0) || !(gh > 0)) return false;
  const gx = ((clientX - rect.left) / rect.width) * gw;
  const gy = ((clientY - rect.top) / rect.height) * gh;
  for (const name of HUD_TOUCH_OBJECTS) {
    const list = runtimeScene.getObjects(name);
    for (const obj of list) {
      let visible = false;
      try { visible = obj.isVisible() === true; } catch (error) { continue; }
      if (!visible) continue;
      let a = null;
      let b = null;
      try {
        const layer = runtimeScene.getLayer(obj.getLayer());
        if (!layer || typeof layer.convertInverseCoords !== 'function') continue;
        const x = obj.getX();
        const y = obj.getY();
        const w = obj.getWidth();
        const h = obj.getHeight();
        a = layer.convertInverseCoords(x, y, 0);
        b = layer.convertInverseCoords(x + w, y + h, 0);
      } catch (error) { continue; }
      if (!a || !b) continue;
      const left = Math.min(a[0], b[0]) - 12;
      const right = Math.max(a[0], b[0]) + 12;
      const top = Math.min(a[1], b[1]) - 12;
      const bottom = Math.max(a[1], b[1]) + 16;
      if (gx >= left && gx <= right && gy >= top && gy <= bottom) return true;
    }
  }
  return false;
};
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
  /* Build 34: the overlay never takes a touch. It is the ring, nothing else. */
  root.style.pointerEvents = 'none';
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
  const pad = {
    root: root, ring: ring, knob: knob, pointer: null, anchorX: 0, anchorY: 0,
    showing: false, blocked: 0, claimed: 0
  };
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
  /* The gesture is read before the canvas: a touch that becomes movement must
   * not also reach the game's own click. A touch on a HUD control is the other
   * way round - this block steps aside and the button gets its press. */
  const onDown = (event) => {
    if (!pad.showing) return;
    if (pad.pointer !== null) return;
    const canvas = touchCanvas();
    if (!canvas) return;
    if (event.target !== canvas && !(canvas.contains && canvas.contains(event.target))) return;
    if (onHudControl(event.clientX, event.clientY)) {
      pad.blocked += 1;
      vars.get('PlayerHudTapGuard').setNumber(pad.blocked);
      return;
    }
    event.preventDefault();
    pad.pointer = event.pointerId;
    pad.claimed += 1;
    pad.anchorX = event.clientX;
    pad.anchorY = event.clientY;
    ring.style.left = event.clientX + 'px';
    ring.style.top = event.clientY + 'px';
    ring.style.opacity = '1';
    track(event.clientX, event.clientY);
  };
  const onMove = (event) => {
    if (pad.pointer === null || event.pointerId !== pad.pointer) return;
    if (event.cancelable) event.preventDefault();
    track(event.clientX, event.clientY);
  };
  const onUp = (event) => {
    if (pad.pointer === null) return;
    if (event.pointerId !== pad.pointer) return;
    clear();
  };
  window.addEventListener('pointerdown', onDown, { capture: true, passive: false });
  window.addEventListener('pointermove', onMove, { capture: true, passive: false });
  window.addEventListener('pointerup', onUp, { capture: true, passive: true });
  window.addEventListener('pointercancel', onUp, { capture: true, passive: true });
  window.addEventListener('blur', clear);
  window.addEventListener('pagehide', clear);
  runtimeScene.__iceWolfV120Touch = pad;
  return pad;
};
const pad = buildTouch();
const touchOn = state.control === 'touch';
if (pad) {
  const showPad = touchOn && playingNow();
  pad.showing = showPad;
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
  vars.get('PlayerTouchPadReady').setBoolean(true);
}
