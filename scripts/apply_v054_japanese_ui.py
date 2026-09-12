import json
from pathlib import Path

path = Path('game.json')
data = json.loads(path.read_text(encoding='utf-8'))

# User-visible UI text only. Internal Role/State/AI identifiers remain English.
REPLACEMENTS = [
    ('YOU: HUMAN | FROZEN', 'あなた：人間｜凍結'),
    ('YOU: WOLF | FROZEN', 'あなた：人狼｜凍結'),
    ('HUMAN: RESCUE FROZEN ALLIES', '人間：凍った仲間を救助しよう'),
    ('TRAP! YOU ARE FROZEN', '罠だ！あなたは凍結！'),
    ('INFECTED - HIDDEN', '感染させた（正体は秘密）'),
    ('WOLF COOLDOWN: ', '人狼モード再使用まで：'),
    ('WOLF MODE ACTIVE', '人狼モード発動中'),
    ('WOLF MODE READY', '人狼モード使用可能'),
    ('WOLF MODE ON!', '人狼モード発動！'),
    ('HUMAN FROZEN!', '人間を凍らせた！'),
    ('YOU ARE FROZEN', 'あなたは凍結中'),
    ('[ WOLF MODE ]', '[ 人狼モード ]'),
    ('[ RESCUE ]', '[ 救助 ]'),
    ('[ INFECT ]', '[ 感染 ]'),
    ('YOU: WOLF', 'あなた：人狼'),
    ('YOU: HUMAN', 'あなた：人間'),
    ('WOLF WIN', '人狼の勝利'),
    ('HUMAN WIN', '人間の勝利'),
    ('RESCUED!', '救助成功！'),
    ('TEST ROLE', '役割切替'),
    ('TEST RESET', 'リセット'),
    ('DEV v0.5.4', '開発版 v0.5.4'),
]

def translate_string(value: str) -> str:
    out = value
    for old, new in REPLACEMENTS:
        out = out.replace(old, new)
    return out

def walk(value):
    if isinstance(value, dict):
        return {k: walk(v) for k, v in value.items()}
    if isinstance(value, list):
        return [walk(v) for v in value]
    if isinstance(value, str):
        return translate_string(value)
    return value

before = data
after = walk(data)

layout = next(x for x in after['layouts'] if x.get('name') == 'FROST LAB')
build = next(o for o in layout['objects'] if o.get('name') == 'BuildText')
if build.get('string') != '開発版 v0.5.4':
    raise RuntimeError(f'BuildText translation failed: {build.get("string")!r}')

# Safety: verify every changed leaf is a string changed only by the approved translation table.
changed = []
def verify(a, b, p=''):
    if type(a) is not type(b):
        raise RuntimeError(f'type changed at {p}: {type(a)} -> {type(b)}')
    if isinstance(a, dict):
        if list(a.keys()) != list(b.keys()):
            raise RuntimeError(f'keys changed at {p}')
        for k in a:
            verify(a[k], b[k], f'{p}/{k}')
    elif isinstance(a, list):
        if len(a) != len(b):
            raise RuntimeError(f'length changed at {p}')
        for i, (x, y) in enumerate(zip(a, b)):
            verify(x, y, f'{p}/{i}')
    elif a != b:
        if not isinstance(a, str) or b != translate_string(a):
            raise RuntimeError(f'unapproved change at {p}: {a!r} -> {b!r}')
        changed.append((p, a, b))

verify(before, after)
if not changed:
    raise RuntimeError('no Japanese UI changes were applied')

path.write_text(json.dumps(after, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'v0.5.4 Japanese UI overlay applied: {len(changed)} text leaves changed; gameplay data untouched')
