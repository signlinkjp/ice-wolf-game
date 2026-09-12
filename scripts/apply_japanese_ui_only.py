import json
from pathlib import Path

path = Path('game.json')
data = json.loads(path.read_text(encoding='utf-8'))
layout = next(x for x in data['layouts'] if x.get('name') == 'FROST LAB')

# Visible object labels only. Internal Role/State values and gameplay logic stay English/unchanged.
object_text = {
    'RoleText': ('YOU: WOLF', 'あなた：人狼'),
    'WolfButton': ('[ WOLF MODE ]', '[ 人狼モード ]'),
    'RescueButton': ('[ RESCUE ]', '[ 救助 ]'),
    'InfectButton': ('[ INFECT ]', '[ 感染 ]'),
    'TestRoleButton': ('TEST ROLE', '役割切替'),
    'TestResetButton': ('TEST RESET', 'リセット'),
    'StatusText': ('WOLF MODE READY', '人狼モード 準備OK'),
    'BuildText': ('DEV v0.5.1', '開発版 v0.5.1'),
}

for name, (old, new) in object_text.items():
    obj = next(o for o in layout['objects'] if o.get('name') == name)
    if obj.get('string') != old:
        raise RuntimeError(f'{name}.string expected {old!r}, got {obj.get("string")!r}')
    if obj.get('content', {}).get('text') != old:
        raise RuntimeError(f'{name}.content.text expected {old!r}, got {obj.get("content", {}).get("text")!r}')
    obj['string'] = new
    obj.setdefault('content', {})['text'] = new

# Dynamic visible text actions only. These are display expressions, not internal state values.
replacements = {
    'RoleText': {
        '\"YOU: WOLF\"': '\"あなた：人狼\"',
        '\"YOU: HUMAN\"': '\"あなた：人間\"',
        '\"YOU: HUMAN | FROZEN\"': '\"あなた：人間｜凍結\"',
        '\"YOU: WOLF | FROZEN\"': '\"あなた：人狼｜凍結\"',
    },
    'StatusText': {
        '\"YOU ARE FROZEN\"': '\"あなたは凍結中\"',
        '\"WOLF MODE ACTIVE\"': '\"人狼モード 発動中\"',
        '\"WOLF COOLDOWN: \" + ToString(ceil(CooldownLeft))': '\"人狼モード 待機：\" + ToString(ceil(CooldownLeft))',
        '\"WOLF MODE READY\"': '\"人狼モード 準備OK\"',
        '\"HUMAN: RESCUE FROZEN ALLIES\"': '\"人間：凍った仲間を救助\"',
    },
    'ActionFeedbackText': {
        '\"WOLF MODE ON!\"': '\"人狼モード！\"',
        '\"HUMAN FROZEN!\"': '\"人間を凍らせた！\"',
        '\"TRAP! YOU ARE FROZEN\"': '\"罠だ！あなたは凍結！\"',
        '\"RESCUED!\"': '\"救助成功！\"',
        '\"INFECTED - HIDDEN\"': '\"感染させた\"',
    },
    'WinText': {
        '\"WOLF WIN\"': '\"人狼の勝利！\"',
        '\"HUMAN WIN\"': '\"人間の勝利！\"',
    },
}

counts = {(obj, old): 0 for obj, pairs in replacements.items() for old in pairs}

def walk_events(events):
    for event in events:
        for action in event.get('actions', []):
            if action.get('type', {}).get('value') != 'TextContainerCapability::TextContainerBehavior::SetValue':
                continue
            params = action.get('parameters', [])
            if len(params) < 4:
                continue
            target = params[0]
            expr = params[3]
            if target in replacements and expr in replacements[target]:
                params[3] = replacements[target][expr]
                counts[(target, expr)] += 1
        walk_events(event.get('events', []))

walk_events(layout.get('events', []))

missing = [(k, v) for k, v in counts.items() if v == 0]
if missing:
    raise RuntimeError(f'expected visible dynamic text replacements not found: {missing}')

# Keep embedded gameplay tests aligned with the new visible labels only.
# No test flow, input, state, or gameplay assertion is changed.
test_replacements = {
    "=== 'YOU: WOLF'": "=== 'あなた：人狼'",
    "=== 'WOLF WIN'": "=== '人狼の勝利！'",
    "=== 'HUMAN WIN'": "=== '人間の勝利！'",
    "=== '[ WOLF MODE ]'": "=== '[ 人狼モード ]'",
    "=== '[ RESCUE ]'": "=== '[ 救助 ]'",
    "=== '[ INFECT ]'": "=== '[ 感染 ]'",
    "=== 'WOLF MODE READY'": "=== '人狼モード 準備OK'",
}
for test in data.get('tests', []):
    source = test.get('source', [])
    test['source'] = [
        next((line.replace(old, new) for old, new in test_replacements.items() if old in line), line)
        for line in source
    ]

path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('Japanese UI-only strings applied')
