import copy
import json
import uuid
from pathlib import Path

PATH = Path('game.json')
with PATH.open(encoding='utf-8') as f:
    data = json.load(f)

layout = next(x for x in data['layouts'] if x.get('name') == 'FROST LAB')


def find_object(name):
    return next(x for x in layout['objects'] if x.get('name') == name)


def find_instance(name):
    return next(x for x in layout['instances'] if x.get('name') == name)


def walk_events(events):
    for event in events:
        yield event
        for child in event.get('events', []):
            yield from walk_events([child])


def is_button_click_event(event, button_name):
    for cond in event.get('conditions', []):
        t = cond.get('type', {}).get('value')
        p = cond.get('parameters', [])
        if t == 'ButtonStates::ButtonFSM::IsClicked' and p and p[0] == button_name:
            return True
    return False


def text_action(value):
    return {
        'type': {'value': 'TextContainerCapability::TextContainerBehavior::SetValue'},
        'parameters': ['StatusText', 'Text', '=', json.dumps(value, ensure_ascii=False)]
    }

# Preconditions: this patch is for the validated v0.6.0 branch only.
build = find_object('BuildText')
if build.get('string') not in ('開発版 v0.6.0', '開発版 v0.6.0-DIAG'):
    raise SystemExit(f"Unexpected BuildText: {build.get('string')!r}")

# 1) Scene variable.
if not any(v.get('name') == 'CpuWolfDiagPhase' for v in layout['variables']):
    layout['variables'].append({'name': 'CpuWolfDiagPhase', 'type': 'number', 'value': 0})

# 2) Visible dev-only diagnostic button.
if not any(o.get('name') == 'CpuWolfTestButton' for o in layout['objects']):
    button = copy.deepcopy(find_object('TestRoleButton'))
    button['name'] = 'CpuWolfTestButton'
    button['persistentUuid'] = str(uuid.uuid4())
    button['string'] = 'CPU人狼テスト'
    button['characterSize'] = 22
    button['content']['text'] = 'CPU人狼テスト'
    button['content']['characterSize'] = 22
    layout['objects'].append(button)

if not any(i.get('name') == 'CpuWolfTestButton' for i in layout['instances']):
    inst = copy.deepcopy(find_instance('TestRoleButton'))
    inst['name'] = 'CpuWolfTestButton'
    inst['persistentUuid'] = str(uuid.uuid4())
    inst['x'] = 850
    inst['y'] = 625
    inst['width'] = 240
    inst['height'] = 44
    layout['instances'].append(inst)

root_children = layout['objectsFolderStructure'].setdefault('children', [])
if not any(x.get('objectName') == 'CpuWolfTestButton' for x in root_children):
    root_children.append({'objectName': 'CpuWolfTestButton'})

# Make the Safari build unmistakable and wide enough to render fully.
build['string'] = '開発版 v0.6.0-DIAG'
build['content']['text'] = '開発版 v0.6.0-DIAG'
build_inst = find_instance('BuildText')
build_inst['x'] = 1000
build_inst['width'] = 260

# 3) Cancel diagnostics whenever the ordinary dev role-toggle is used.
role_event = next(e for e in walk_events(layout['events']) if is_button_click_event(e, 'TestRoleButton'))
role_js = next(e for e in role_event.get('events', []) if e.get('type') == 'BuiltinCommonInstructions::JsCode')
role_lines = role_js['inlineCode']
if not any('CpuWolfDiagPhase' in line for line in role_lines):
    marker = "const players = runtimeScene.getObjects('Player');"
    idx = role_lines.index(marker)
    cancel = [
        "runtimeScene.getVariables().get('CpuWolfDiagPhase').setNumber(0);",
        "for (const actor of runtimeScene.getObjects('Actor')) {",
        "  actor.__iceWolfDiagnosticTargetPlayer = false;",
        "  actor.__iceWolfDiagnosticHoldLeft = 0;",
        "}",
    ]
    role_js['inlineCode'] = role_lines[:idx] + cancel + role_lines[idx:]

# 4) Reset must also clear all diagnostic-only state/timers.
reset_event = next(e for e in walk_events(layout['events']) if is_button_click_event(e, 'TestResetButton'))
if not any(e.get('type') == 'BuiltinCommonInstructions::JsCode' and any('CpuWolfDiagPhase' in l for l in e.get('inlineCode', [])) for e in reset_event.get('events', [])):
    reset_event.setdefault('events', []).append({
        'type': 'BuiltinCommonInstructions::JsCode',
        'inlineCode': [
            "runtimeScene.getVariables().get('CpuWolfDiagPhase').setNumber(0);",
            "for (const actor of runtimeScene.getObjects('Actor')) {",
            "  const av = actor.getVariables();",
            "  av.get('AIWolfModeLeft').setNumber(0);",
            "  av.get('AIWolfCooldownLeft').setNumber(0);",
            "  actor.__iceWolfDiagnosticTargetPlayer = false;",
            "  actor.__iceWolfDiagnosticHoldLeft = 0;",
            "  actor.__iceWolfPrimaryCPUWolf = false;",
            "}",
        ],
        'parameterObjects': '',
        'useStrict': True,
        'eventsSheetExpanded': False,
        'actions': [],
    })

# 5) Deterministic device diagnostic mini-scenario.
if not any(is_button_click_event(e, 'CpuWolfTestButton') for e in walk_events(layout['events'])):
    diag_setup = {
        'type': 'BuiltinCommonInstructions::Standard',
        'conditions': [{
            'type': {'value': 'ButtonStates::ButtonFSM::IsClicked'},
            'parameters': ['CpuWolfTestButton', 'ButtonFSM', '']
        }],
        'actions': [],
        'events': [{
            'type': 'BuiltinCommonInstructions::JsCode',
            'inlineCode': [
                "const vars = runtimeScene.getVariables();",
                "const players = runtimeScene.getObjects('Player');",
                "const actors = runtimeScene.getObjects('Actor');",
                "const player = players.length ? players[0] : null;",
                "if (player && actors.length >= 6) {",
                "  vars.get('GameOver').setBoolean(false);",
                "  vars.get('MatchTimeLeft').setNumber(vars.get('MatchDuration').getAsNumber());",
                "  vars.get('WolfModeLeft').setNumber(0);",
                "  vars.get('CooldownLeft').setNumber(0);",
                "  vars.get('InfectionUsed').setBoolean(false);",
                "  vars.get('CpuWolfDiagPhase').setNumber(1);",
                "  const pv = player.getVariables();",
                "  pv.get('Role').setString('Human');",
                "  pv.get('State').setString('Active');",
                "  player.setX(0);",
                "  player.setY(350);",
                "  const positions = [[180,350],[-520,-520],[520,-520],[-520,500],[520,500],[0,-520]];",
                "  for (let i = 0; i < actors.length; i++) {",
                "    const actor = actors[i];",
                "    const av = actor.getVariables();",
                "    av.get('Role').setString('Human');",
                "    av.get('State').setString('Active');",
                "    av.get('AIWolfModeLeft').setNumber(0);",
                "    av.get('AIWolfCooldownLeft').setNumber(0);",
                "    actor.__iceWolfDiagnosticTargetPlayer = false;",
                "    actor.__iceWolfDiagnosticHoldLeft = 0;",
                "    actor.__iceWolfPrimaryCPUWolf = false;",
                "    actor.__iceWolfAIRescueCooldown = 0;",
                "    const pos = positions[i] || [0,-520];",
                "    actor.setX(pos[0]);",
                "    actor.setY(pos[1]);",
                "  }",
                "  const wolf = actors[0];",
                "  const wv = wolf.getVariables();",
                "  wv.get('Role').setString('Wolf');",
                "  wv.get('AIWolfModeLeft').setNumber(20);",
                "  wv.get('AIWolfCooldownLeft').setNumber(0);",
                "  wolf.__iceWolfPrimaryCPUWolf = true;",
                "  wolf.__iceWolfDiagnosticTargetPlayer = true;",
                "  wolf.__iceWolfDiagnosticHoldLeft = 0;",
                "}",
            ],
            'parameterObjects': '',
            'useStrict': True,
            'eventsSheetExpanded': False,
            'actions': [],
        }],
    }
    # Place before the reset/role-support feedback groups, but exact location is not semantically important.
    layout['events'].append(diag_setup)

# 6) Patch the existing Actor-Wolf AI only behind diagnostic-only flags.
ai_js = None
for e in walk_events(layout['events']):
    if e.get('type') != 'BuiltinCommonInstructions::JsCode':
        continue
    joined = '\n'.join(e.get('inlineCode', []))
    if "const aiWolfTriggerRadius = 420;" in joined and "activeHumanTargets" in joined:
        ai_js = e
        break
if ai_js is None:
    raise SystemExit('CPU Wolf AI JsCode not found')
code = '\n'.join(ai_js['inlineCode'])

old = """      wv.get('AIWolfModeLeft').setNumber(modeLeft);\n      wv.get('AIWolfCooldownLeft').setNumber(cooldownLeft);\n      const wx = wolf.getCenterXInScene();"""
new = """      wv.get('AIWolfModeLeft').setNumber(modeLeft);\n      wv.get('AIWolfCooldownLeft').setNumber(cooldownLeft);\n      wolf.__iceWolfDiagnosticHoldLeft = Math.max(0, (Number.isFinite(wolf.__iceWolfDiagnosticHoldLeft) ? wolf.__iceWolfDiagnosticHoldLeft : 0) - dt);\n      if (wolf.__iceWolfDiagnosticHoldLeft > 0) {\n        wolf.__iceWolfAIWolfLastExpectedMove = 0;\n        continue;\n      }\n      const wx = wolf.getCenterXInScene();"""
if old in code:
    code = code.replace(old, new, 1)
elif '__iceWolfDiagnosticHoldLeft > 0' not in code:
    raise SystemExit('AI hold insertion marker not found')

old = """      let target = null;\n      let targetDist = Infinity;\n      for (const human of activeHumanTargets(wolf)) {\n        const d = Math.hypot(human.getCenterXInScene() - wx, human.getCenterYInScene() - wy);\n        if (d < targetDist) { target = human; targetDist = d; }\n      }"""
new = """      let target = null;\n      let targetDist = Infinity;\n      const diagPhase = vars.get('CpuWolfDiagPhase').getAsNumber();\n      const forceDiagnosticPlayerTarget = wolf.__iceWolfDiagnosticTargetPlayer === true && diagPhase === 1 && pRole === 'Human' && pState === 'Active';\n      if (forceDiagnosticPlayerTarget) {\n        target = player;\n        targetDist = Math.hypot(player.getCenterXInScene() - wx, player.getCenterYInScene() - wy);\n      } else {\n        for (const human of activeHumanTargets(wolf)) {\n          const d = Math.hypot(human.getCenterXInScene() - wx, human.getCenterYInScene() - wy);\n          if (d < targetDist) { target = human; targetDist = d; }\n        }\n      }"""
if old in code:
    code = code.replace(old, new, 1)
elif 'forceDiagnosticPlayerTarget' not in code:
    raise SystemExit('AI target insertion marker not found')

old = """        if (targetDist <= aiWolfFreezeDistance) {\n          target.getVariables().get('State').setString('Frozen');\n          wv.get('AIWolfModeLeft').setNumber(0);\n          wv.get('AIWolfCooldownLeft').setNumber(aiWolfCooldownDuration);\n          wolf.__iceWolfAIWolfLastExpectedMove = 0;\n          wolf.__iceWolfAIWolfBlockedFor = 0;\n          wolf.__iceWolfAIWolfDetourLeft = 0;\n          continue;\n        }"""
new = """        if (targetDist <= aiWolfFreezeDistance) {\n          const diagnosticPlayerFreeze = wolf.__iceWolfDiagnosticTargetPlayer === true && vars.get('CpuWolfDiagPhase').getAsNumber() === 1 && target === player;\n          target.getVariables().get('State').setString('Frozen');\n          wv.get('AIWolfModeLeft').setNumber(0);\n          wv.get('AIWolfCooldownLeft').setNumber(diagnosticPlayerFreeze ? 30 : aiWolfCooldownDuration);\n          wolf.__iceWolfAIWolfLastExpectedMove = 0;\n          wolf.__iceWolfAIWolfBlockedFor = 0;\n          wolf.__iceWolfAIWolfDetourLeft = 0;\n          if (diagnosticPlayerFreeze) {\n            vars.get('CpuWolfDiagPhase').setNumber(2);\n            wolf.__iceWolfDiagnosticTargetPlayer = false;\n            wolf.__iceWolfDiagnosticHoldLeft = 8;\n            wolf.setX(-620);\n            wolf.setY(-620);\n            const rescuer = actors.find(candidate => candidate !== wolf && candidate.getVariables().get('Role').getAsString() === 'Human' && candidate.getVariables().get('State').getAsString() === 'Active');\n            if (rescuer) {\n              rescuer.setX(player.getCenterXInScene() + 90);\n              rescuer.setY(player.getCenterYInScene());\n              rescuer.__iceWolfAIRescueCooldown = 0;\n              rescuer.__iceWolfAITurnLeft = 0;\n            }\n          }\n          continue;\n        }"""
if old in code:
    code = code.replace(old, new, 1)
elif 'diagnosticPlayerFreeze' not in code:
    raise SystemExit('AI freeze insertion marker not found')

old = """              } else if (targetState === 'Frozen') {\n                targetVars.get('State').setString('Active');\n                actor.__iceWolfAIRescueCooldown = 1.0;\n                rescueTarget.__iceWolfAIRescueCooldown = 1.2;\n              }\n              continue;"""
new = """              } else if (targetState === 'Frozen') {\n                targetVars.get('State').setString('Active');\n                actor.__iceWolfAIRescueCooldown = 1.0;\n                rescueTarget.__iceWolfAIRescueCooldown = 1.2;\n                if (rescueTarget === player && vars.get('CpuWolfDiagPhase').getAsNumber() === 2) {\n                  vars.get('CpuWolfDiagPhase').setNumber(3);\n                }\n              }\n              continue;"""
if old in code:
    code = code.replace(old, new, 1)
elif "vars.get('CpuWolfDiagPhase').getAsNumber() === 2" not in code:
    raise SystemExit('AI rescue insertion marker not found')

ai_js['inlineCode'] = code.split('\n')

# 7) Diagnostic status is appended last so it visibly overrides ordinary HUD status.
if not any(e.get('name') == 'v0.6.0 CPU Wolf device diagnostic status' for e in layout['events']):
    layout['events'].append({
        'colorB': 228, 'colorG': 176, 'colorR': 74, 'creationTime': 0,
        'name': 'v0.6.0 CPU Wolf device diagnostic status',
        'source': '', 'type': 'BuiltinCommonInstructions::Group',
        'events': [
            {
                'type': 'BuiltinCommonInstructions::Standard',
                'conditions': [{'type': {'value': 'NumberVariable'}, 'parameters': ['CpuWolfDiagPhase', '=', '1']}],
                'actions': [text_action('診断1/3：青いCPU人狼があなたを追跡中')]
            },
            {
                'type': 'BuiltinCommonInstructions::Standard',
                'conditions': [{'type': {'value': 'NumberVariable'}, 'parameters': ['CpuWolfDiagPhase', '=', '2']}],
                'actions': [text_action('診断2/3：凍結成功 → CPU救助待機')]
            },
            {
                'type': 'BuiltinCommonInstructions::Standard',
                'conditions': [{'type': {'value': 'NumberVariable'}, 'parameters': ['CpuWolfDiagPhase', '=', '3']}],
                'actions': [text_action('診断PASS：追跡 → 凍結 → 救助')]
            },
        ],
        'parameters': [], 'actions': []
    })

# 8) A short, deterministic gameplay test for the actual device-diagnostic route.
if not any(t.get('name') == 'v0.6.0 CPU Wolf device diagnostic test' for t in data.get('tests', [])):
    data.setdefault('tests', []).append({
        'description': 'Visible diagnostic route: forced Player targeting, freeze, Human CPU rescue, PASS status',
        'lastRunAt': 0,
        'lastRunDurationMs': 0,
        'lastRunFramesExecuted': 0,
        'lastRunStatus': 'not-run',
        'name': 'v0.6.0 CPU Wolf device diagnostic test',
        'type': 'gameplay',
        'source': [
            "await harness.goToScene('FROST LAB');",
            "await harness.stepFrames(30);",
            "async function click(x, y) {",
            "  harness.setMousePosition(x, y, 'UI');",
            "  await harness.stepFrames(2);",
            "  harness.setMouseButtonPressed(true);",
            "  await harness.stepFrames(2);",
            "  harness.setMouseButtonPressed(false);",
            "  await harness.stepFrames(3);",
            "}",
            "const actors = () => harness.getObjects('Actor');",
            "const pvar = (n) => harness.getObjectVariable('Player', n)?.value;",
            "const avar = (id, n) => harness.getObjectVariable(id, n)?.value;",
            "await click(970, 647);",
            "harness.assert(pvar('Role') === 'Human' && pvar('State') === 'Active', 'diagnostic starts Player Human/Active');",
            "harness.assert(harness.getSceneVariable('CpuWolfDiagPhase')?.value === 1, 'diagnostic phase 1');",
            "let wolves = actors().filter(a => avar(a.id,'Role') === 'Wolf' && avar(a.id,'State') === 'Active');",
            "harness.assert(wolves.length === 1, `one diagnostic CPU Wolf, got ${wolves.length}`);",
            "harness.assert((avar(wolves[0].id,'AIWolfModeLeft') ?? 0) > 0, 'diagnostic CPU Wolf starts in WOLF MODE');",
            "for (let i = 0; i < 5 && pvar('State') !== 'Frozen'; i++) await harness.stepFrames(15);",
            "harness.assert(pvar('State') === 'Frozen', 'diagnostic CPU Wolf naturally reaches/freezes Player');",
            "harness.assert(harness.getSceneVariable('CpuWolfDiagPhase')?.value === 2, 'diagnostic phase 2 after freeze');",
            "for (let i = 0; i < 6 && pvar('State') !== 'Active'; i++) await harness.stepFrames(15);",
            "harness.assert(pvar('State') === 'Active', 'Human CPU naturally rescues frozen Player');",
            "harness.assert(harness.getSceneVariable('CpuWolfDiagPhase')?.value === 3, 'diagnostic phase 3 PASS');",
            "harness.assert(harness.getObjects('StatusText')[0].text.includes('診断PASS'), `PASS status visible: ${harness.getObjects('StatusText')[0].text}`);",
            ""
        ]
    })

# Final static safety assertions.
assert sum(1 for i in layout['instances'] if i.get('name') == 'Actor') == 6
assert next(v for v in layout['variables'] if v.get('name') == 'MatchDuration')['value'] == 210
assert find_object('BuildText')['string'] == '開発版 v0.6.0-DIAG'
assert find_object('CpuWolfTestButton')['string'] == 'CPU人狼テスト'
assert sum(1 for o in layout['objects'] if o.get('name') == 'CpuWolfTestButton') == 1
assert sum(1 for i in layout['instances'] if i.get('name') == 'CpuWolfTestButton') == 1
assert sum(1 for t in data['tests'] if t.get('name') == 'v0.6.0 CPU Wolf device diagnostic test') == 1
final_ai = '\n'.join(ai_js['inlineCode'])
for marker in ['forceDiagnosticPlayerTarget', 'diagnosticPlayerFreeze', '__iceWolfDiagnosticHoldLeft', "CpuWolfDiagPhase').setNumber(3"]:
    assert marker in final_ai, marker

with PATH.open('w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

print('v0.6.0 CPU Wolf device diagnostic patch applied successfully')
