import json

PATH = 'game.json'
with open(PATH, encoding='utf-8') as f:
    data = json.load(f)
frost = next(x for x in data['layouts'] if x.get('name') == 'FROST LAB')

def group(name):
    found = [x for x in frost['events'] if x.get('name') == name]
    assert len(found) == 1, (name, len(found))
    return found[0]

joystick = group('v0.6.4 Compact Mobile Virtual Joystick UI')
lines = joystick['events'][0]['inlineCode']

replacements = {
    "    base.style.left = '28px';": "    base.style.left = '39px';",
    "    base.style.top = '28px';": "    base.style.top = '39px';",
    "    base.style.width = '118px';": "    base.style.width = '96px';",
    "    base.style.height = '118px';": "    base.style.height = '96px';",
    "    thumb.style.left = '60px';": "    thumb.style.left = '65px';",
    "    thumb.style.top = '60px';": "    thumb.style.top = '65px';",
    "    thumb.style.width = '54px';": "    thumb.style.width = '44px';",
    "    thumb.style.height = '54px';": "    thumb.style.height = '44px';",
    "    const VISUAL_RANGE = 32;": "    const VISUAL_RANGE = 26;",
}
for old, new in replacements.items():
    hits = [i for i, line in enumerate(lines) if line == old]
    assert len(hits) == 1, (old, hits)
    lines[hits[0]] = new

for old in (
    "    base.style.backdropFilter = 'blur(3px)';",
    "    base.style.webkitBackdropFilter = 'blur(3px)';",
):
    hits = [i for i, line in enumerate(lines) if line == old]
    assert len(hits) == 1, (old, hits)
    lines.pop(hits[0])

release_start = lines.index("    const release = (event) => {")
release_expected = [
    "    const release = (event) => {",
    "      if (pointerId !== null && event && event.pointerId !== pointerId) return;",
    "      pointerId = null;",
    "      thumb.style.transform = 'translate(0px, 0px)';",
    "      resetInput();",
    "    };",
]
assert lines[release_start:release_start + len(release_expected)] == release_expected
release_new = [
    "    const release = (event) => {",
    "      if (pointerId !== null && event && event.pointerId !== pointerId) return;",
    "      const capturedId = pointerId;",
    "      pointerId = null;",
    "      if (capturedId !== null) {",
    "        try { if (root.hasPointerCapture(capturedId)) root.releasePointerCapture(capturedId); } catch (_) {}",
    "      }",
    "      thumb.style.transform = 'translate(0px, 0px)';",
    "      resetInput();",
    "    };",
]
lines[release_start:release_start + len(release_expected)] = release_new

down_start = lines.index("    root.addEventListener('pointerdown', (event) => {")
down_expected = [
    "    root.addEventListener('pointerdown', (event) => {",
    "      if (pointerId !== null) return;",
    "      pointerId = event.pointerId;",
]
assert lines[down_start:down_start + 3] == down_expected
down_new = [
    "    root.addEventListener('pointerdown', (event) => {",
    "      // Recover if iOS Safari lost the previous pointerup/cancel.",
    "      if (pointerId !== null && pointerId !== event.pointerId) release(null);",
    "      if (pointerId !== null) return;",
    "      pointerId = event.pointerId;",
]
lines[down_start:down_start + 3] = down_new

up_line = "    root.addEventListener('pointerup', release, { passive: false });"
cancel_line = "    root.addEventListener('pointercancel', release, { passive: false });"
up_i = lines.index(up_line)
assert lines[up_i + 1] == cancel_line
lines[up_i + 2:up_i + 2] = [
    "    root.addEventListener('lostpointercapture', release, { passive: true });",
    "    window.addEventListener('pointerup', release, { passive: true });",
    "    window.addEventListener('pointercancel', release, { passive: true });",
]
blur_i = lines.index("    window.addEventListener('blur', () => release(null));")
lines.insert(blur_i + 1, "    window.addEventListener('pagehide', () => release(null));")
joystick['name'] = 'v0.6.4 Device-Tuned Mobile Virtual Joystick UI'

camera = group('v0.6.4 Overview Camera Toggle UI')
clines = camera['events'][0]['inlineCode']
create_i = clines.index("    runtimeScene.__iceWolfV064CameraUi = { button };")
clines[create_i] = "    runtimeScene.__iceWolfV064CameraUi = { button, positioned: false, lastLayoutAt: -10000, lastEnabled: null };"
ui_i = clines.index("  const ui = runtimeScene.__iceWolfV064CameraUi;")
old_tail = [
    "  const ui = runtimeScene.__iceWolfV064CameraUi;",
    "  const canvas = document.querySelector('canvas');",
    "  if (ui && ui.button && canvas) {",
    "    const rect = canvas.getBoundingClientRect();",
    "    ui.button.style.left = `${Math.max(rect.left + 8, rect.right - 72)}px`;",
    "    ui.button.style.top = `${rect.top + 108}px`;",
    "    const enabled = vars.get('OverviewCameraEnabled').getAsBoolean();",
    "    ui.button.textContent = enabled ? 'TOP' : 'CAM';",
    "    ui.button.style.background = enabled ? 'rgba(40,100,145,0.88)' : 'rgba(18,24,32,0.82)';",
    "    vars.get('OverviewCameraReady').setBoolean(true);",
    "  } else {",
    "    vars.get('OverviewCameraReady').setBoolean(false);",
    "  }",
]
assert clines[ui_i:ui_i + len(old_tail)] == old_tail
new_tail = [
    "  const ui = runtimeScene.__iceWolfV064CameraUi;",
    "  if (ui && ui.button) {",
    "    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();",
    "    if (!ui.positioned || now - ui.lastLayoutAt >= 1000) {",
    "      const canvas = document.querySelector('canvas');",
    "      if (canvas) {",
    "        const rect = canvas.getBoundingClientRect();",
    "        ui.button.style.left = `${Math.max(rect.left + 8, rect.right - 72)}px`;",
    "        ui.button.style.top = `${rect.top + 108}px`;",
    "        ui.positioned = true;",
    "      }",
    "      ui.lastLayoutAt = now;",
    "    }",
    "    const enabled = vars.get('OverviewCameraEnabled').getAsBoolean();",
    "    if (ui.lastEnabled !== enabled) {",
    "      ui.button.textContent = enabled ? 'TOP' : 'CAM';",
    "      ui.button.style.background = enabled ? 'rgba(40,100,145,0.88)' : 'rgba(18,24,32,0.82)';",
    "      ui.lastEnabled = enabled;",
    "    }",
    "    vars.get('OverviewCameraReady').setBoolean(ui.positioned === true);",
    "  } else {",
    "    vars.get('OverviewCameraReady').setBoolean(false);",
    "  }",
]
clines[ui_i:ui_i + len(old_tail)] = new_tail

test_name = 'v0.6.4 Device Tuning liveness test'
assert not any(t.get('name') == test_name for t in data['tests'])
data['tests'].append({
    'description': 'Short deterministic liveness check; long-duration Safari validation remains an iPhone device test',
    'lastRunAt': 0,
    'lastRunDurationMs': 0,
    'lastRunFramesExecuted': 0,
    'lastRunStatus': 'not-run',
    'name': test_name,
    'type': 'gameplay',
    'source': [
        "await harness.goToScene('FROST LAB');",
        "await harness.stepFrames(12);",
        "harness.assert(harness.getSceneVariable('VirtualJoystickReady')?.value === true, 'virtual joystick ready');",
        "harness.assert(harness.getSceneVariable('OverviewCameraReady')?.value === true, 'camera UI ready');",
        "const startTimer = harness.getSceneVariable('MatchTimeLeft')?.value ?? 0;",
        "const dirs = [[1,0],[0,1],[-1,0],[0,-1],[0.70710678,0.70710678]];",
        "for (let i=0;i<5;i++) {",
        "  const [x,y] = dirs[i];",
        "  harness.setSceneVariable('JoystickX', x);",
        "  harness.setSceneVariable('JoystickY', y);",
        "  harness.setSceneVariable('JoystickActive', true);",
        "  harness.setSceneVariable('OverviewCameraEnabled', i % 2 === 1);",
        "  await harness.stepFrames(40);",
        "  const p = harness.getObjects('Player')[0];",
        "  harness.assert(Number.isFinite(p.centerX) && Number.isFinite(p.centerY), `finite player position at cycle ${i}`);",
        "  harness.assert(harness.getSceneVariable('VirtualJoystickReady')?.value === true, `joystick live at cycle ${i}`);",
        "  harness.assert(harness.getSceneVariable('OverviewCameraReady')?.value === true, `camera UI live at cycle ${i}`);",
        "}",
        "harness.setSceneVariable('JoystickActive', false);",
        "harness.setSceneVariable('JoystickX', 0);",
        "harness.setSceneVariable('JoystickY', 0);",
        "harness.setSceneVariable('OverviewCameraEnabled', false);",
        "const endTimer = harness.getSceneVariable('MatchTimeLeft')?.value ?? startTimer;",
        "harness.assert(endTimer < startTimer - 2, `game loop remained live: ${startTimer} -> ${endTimer}`);",
        "",
    ],
})

with open(PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
print('v0.6.4 Device Tuning R3 applied.')
