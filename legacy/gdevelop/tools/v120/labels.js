/* ICE WOLF v1.2.0 — the head bubbles.
 *
 * Same job as v0.6.2 (a colour-independent id over every body, YOU first), with
 * the readability the brief asks for: a rounder, larger bubble with a little
 * tail pointing at the head, a stage-safe font size that follows the SETTINGS
 * text size, and a simple pass that lifts a bubble over the one in front of it
 * so two letters in a crowd never sit on each other.
 *
 * Still read-only: the bubble shows `LabelText` (a name typed in the room) or
 * `DisplayId` (the roster letter), and nothing here writes a game value.
 */
const vars = runtimeScene.getVariables();
const players = runtimeScene.getObjects('Player');
const actors = runtimeScene.getObjects('Actor');
const player = players.length ? players[0] : null;
const participants = [];
for (const actor of actors) {
  if (actor.getVariables().get('State').getAsString() === 'Out') continue;
  participants.push(actor);
}
const targets = player ? [player].concat(participants) : participants.slice();
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const expectedIds = ['YOU'];
for (let i = 0; i < participants.length && i < LETTERS.length; i += 1) expectedIds.push(LETTERS[i]);
const textScale = (() => {
  const value = vars.get('PlayerTextScale').getAsNumber();
  return value >= 1 ? Math.min(1.3, value) : 1;
})();
const LABEL_FONT_SIZE = Math.round(12 * textScale);
const LABEL_LINE_HEIGHT = Math.round(15 * textScale);
const LABEL_MIN_WIDTH = Math.round(30 * textScale);
const LABEL_MIN_WIDTH_YOU = Math.round(42 * textScale);
const LABEL_PADDING_X = Math.round(7 * textScale);
const LABEL_PADDING_Y = Math.round(2 * textScale);
const LABEL_RADIUS = Math.round(9 * textScale);
const LABEL_BORDER_WIDTH = 1;
const LABEL_OFFSET_Y = Math.round(9 * textScale);
const LABEL_GAP_Y = Math.round(18 * textScale);
const LABEL_GAP_X = Math.round(30 * textScale);
vars.get('ActorIdLabelFontSize').setNumber(LABEL_FONT_SIZE);
vars.get('ActorIdLabelLineHeight').setNumber(LABEL_LINE_HEIGHT);
vars.get('ActorIdLabelMinWidth').setNumber(LABEL_MIN_WIDTH);
vars.get('ActorIdLabelMinWidthYou').setNumber(LABEL_MIN_WIDTH_YOU);
vars.get('ActorIdLabelPaddingX').setNumber(LABEL_PADDING_X);
vars.get('ActorIdLabelRadius').setNumber(LABEL_RADIUS);
vars.get('ActorIdLabelBorderWidth').setNumber(LABEL_BORDER_WIDTH);
vars.get('ActorIdLabelOffsetY').setNumber(LABEL_OFFSET_Y);
vars.get('ActorIdLabelOverlaps').setNumber(0);
const idsAreValid = targets.length === expectedIds.length && targets.every((obj, index) => obj.getVariables().get('DisplayId').getAsString() === expectedIds[index]);
vars.get('ActorIdLabelCount').setNumber(targets.length);
if (!idsAreValid) {
  vars.get('ActorIdLabelsReady').setBoolean(false);
} else if (typeof document !== 'undefined' && typeof THREE !== 'undefined') {
  const canvas = document.querySelector('canvas');
  const baseLayer = player && typeof player.getInstanceContainer === 'function'
    ? player.getInstanceContainer().getLayer(player.getLayer()) : null;
  const layerRenderer = baseLayer && baseLayer.getRenderer ? baseLayer.getRenderer() : null;
  const camera = layerRenderer && layerRenderer.getThreeCamera ? layerRenderer.getThreeCamera() : null;
  if (canvas && camera) {
    if (!runtimeScene.__iceWolfV062IdLabels) {
      for (const old of document.querySelectorAll('[data-ice-wolf-v062-id-label="1"]')) old.remove();
      runtimeScene.__iceWolfV062IdLabels = new Map();
    }
    const labels = runtimeScene.__iceWolfV062IdLabels;
    for (const obj of targets) {
      if (labels.has(obj)) continue;
      const id = obj.getVariables().get('DisplayId').getAsString();
      const el = document.createElement('div');
      el.dataset.iceWolfV062IdLabel = '1';
      el.textContent = id;
      el.style.position = 'fixed';
      el.style.left = '0';
      el.style.top = '0';
      el.style.transform = 'translate(-50%, -100%)';
      el.style.zIndex = '2147483000';
      el.style.pointerEvents = 'none';
      el.style.userSelect = 'none';
      el.style.webkitUserSelect = 'none';
      el.style.boxSizing = 'border-box';
      el.style.whiteSpace = 'nowrap';
      el.style.textAlign = 'center';
      el.style.fontFamily = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
      el.style.fontWeight = '900';
      el.style.letterSpacing = '0.3px';
      el.style.color = '#ffffff';
      el.style.textShadow = '0 1px 2px rgba(0,0,0,0.9)';
      el.style.border = LABEL_BORDER_WIDTH + 'px solid rgba(255,255,255,0.9)';
      el.style.background = 'linear-gradient(180deg,rgba(20,52,78,0.94),rgba(3,20,34,0.96))';
      el.style.boxShadow = '0 3px 10px rgba(0,0,0,0.45),inset 0 1px rgba(255,255,255,0.18)';
      const tail = document.createElement('i');
      tail.style.position = 'absolute';
      tail.style.left = '50%';
      tail.style.bottom = '-5px';
      tail.style.width = '8px';
      tail.style.height = '8px';
      tail.style.marginLeft = '-4px';
      tail.style.transform = 'rotate(45deg)';
      tail.style.background = 'rgba(3,20,34,0.96)';
      tail.style.borderRight = LABEL_BORDER_WIDTH + 'px solid rgba(255,255,255,0.9)';
      tail.style.borderBottom = LABEL_BORDER_WIDTH + 'px solid rgba(255,255,255,0.9)';
      tail.style.pointerEvents = 'none';
      el.appendChild(tail);
      document.body.appendChild(el);
      labels.set(obj, el);
    }
    for (const [obj, el] of labels) {
      if (targets.indexOf(obj) >= 0) continue;
      el.style.display = 'none';
    }
    const rect = canvas.getBoundingClientRect();
    camera.updateMatrixWorld(true);
    const placed = [];
    for (const obj of targets) {
      const el = labels.get(obj);
      const mesh = obj.get3DRendererObject && obj.get3DRendererObject();
      if (!el || !mesh) {
        if (el) el.style.display = 'none';
        continue;
      }
      mesh.updateMatrixWorld(true);
      const projected = new THREE.Vector3();
      mesh.getWorldPosition(projected);
      /* v1.2.0: the bodies are sprites 62px tall, so the head is above the cube
       * centre by more than the cube's own half-height. Raise the sample to the
       * head, then put the bubble a breath above it. */
      projected.z += 46;
      projected.project(camera);
      const visible = projected.z >= -1 && projected.z <= 1 && projected.x >= -1.08 && projected.x <= 1.08 && projected.y >= -1.08 && projected.y <= 1.08;
      if (!visible) {
        el.style.display = 'none';
        continue;
      }
      const labelVar = obj.getVariables().get('LabelText');
      const labelText = labelVar && typeof labelVar.getAsString === 'function' ? labelVar.getAsString() : '';
      const text = labelText || obj.getVariables().get('DisplayId').getAsString();
      if (el.firstChild && el.firstChild.nodeType === 3 && el.firstChild.nodeValue !== text) el.firstChild.nodeValue = text;
      else if (!el.firstChild || el.firstChild.nodeType !== 3) el.insertBefore(document.createTextNode(text), el.firstChild);
      const you = text === 'YOU' || obj === player;
      el.style.fontSize = LABEL_FONT_SIZE + 'px';
      el.style.lineHeight = LABEL_LINE_HEIGHT + 'px';
      el.style.minWidth = (you ? LABEL_MIN_WIDTH_YOU : LABEL_MIN_WIDTH) + 'px';
      el.style.padding = LABEL_PADDING_Y + 'px ' + LABEL_PADDING_X + 'px';
      el.style.borderRadius = LABEL_RADIUS + 'px';
      if (you) {
        el.style.borderColor = 'rgba(255,226,138,0.95)';
        el.style.background = 'linear-gradient(180deg,rgba(255,233,145,0.98),rgba(255,199,62,0.98))';
        el.style.color = '#06233b';
        el.style.textShadow = 'none';
        if (el.lastChild) {
          el.lastChild.style.background = 'rgba(255,199,62,0.98)';
          el.lastChild.style.borderColor = 'rgba(255,226,138,0.95)';
        }
      } else {
        el.style.borderColor = 'rgba(255,255,255,0.9)';
        el.style.background = 'linear-gradient(180deg,rgba(20,52,78,0.94),rgba(3,20,34,0.96))';
        el.style.color = '#ffffff';
        el.style.textShadow = '0 1px 2px rgba(0,0,0,0.9)';
        if (el.lastChild) {
          el.lastChild.style.background = 'rgba(3,20,34,0.96)';
          el.lastChild.style.borderColor = 'rgba(255,255,255,0.9)';
        }
      }
      const screenX = rect.left + (projected.x * 0.5 + 0.5) * rect.width;
      const screenY = rect.top + (-projected.y * 0.5 + 0.5) * rect.height - LABEL_OFFSET_Y;
      el.style.display = 'block';
      placed.push({ el: el, x: screenX, y: screenY, depth: projected.z });
    }
    /* Two bubbles in a crowd: the nearer head keeps its place, the one behind
     * it is lifted until it clears. Cheap (ten bubbles at most) and stable. */
    let overlaps = 0;
    placed.sort((a, b) => a.depth - b.depth);
    for (let i = 0; i < placed.length; i += 1) {
      for (let pass = 0; pass < 3; pass += 1) {
        let lifted = false;
        for (let j = 0; j < i; j += 1) {
          const other = placed[j];
          if (Math.abs(other.x - placed[i].x) > LABEL_GAP_X) continue;
          if (Math.abs(other.y - placed[i].y) > LABEL_GAP_Y) continue;
          placed[i].y = other.y - LABEL_GAP_Y;
          lifted = true;
          overlaps += 1;
        }
        if (!lifted) break;
      }
    }
    for (const entry of placed) {
      entry.el.style.left = entry.x + 'px';
      entry.el.style.top = entry.y + 'px';
    }
    vars.get('ActorIdLabelOverlaps').setNumber(overlaps);
    vars.get('ActorIdLabelsReady').setBoolean(labels.size === targets.length);
  }
}
