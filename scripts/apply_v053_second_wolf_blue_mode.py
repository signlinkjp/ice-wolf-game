import json
from pathlib import Path

path = Path('game.json')
data = json.loads(path.read_text(encoding='utf-8'))
layout = next(x for x in data['layouts'] if x.get('name') == 'FROST LAB')

# Visual-only follow-up on the v0.5.2 gameplay branch.
# Preserve hidden identity outside WOLF MODE and preserve Frozen/Candidate red parity.
build = next(o for o in layout['objects'] if o.get('name') == 'BuildText')
if build.get('string') != 'DEV v0.5.2':
    raise RuntimeError(f'expected DEV v0.5.2 base, got {build.get("string")!r}')
build['string'] = 'DEV v0.5.3'
build.setdefault('content', {})['text'] = 'DEV v0.5.3'

visual_group = next(e for e in layout['events'] if e.get('name') == 'v0.3.4 guaranteed solid-state visuals')
visual_js = next(e for e in visual_group['events'] if e.get('type') == 'BuiltinCommonInstructions::JsCode')
lines = list(visual_js.get('inlineCode', []))

# Locate the awakened Actor-Wolf WOLF MODE branch structurally rather than
# depending on one exact formatting style. Replace only the dark-red color
# associated with `role === 'Wolf' && aiWolfModeLeft > 0`.
condition_indexes = [
    i for i, line in enumerate(lines)
    if "role === 'Wolf'" in line and 'aiWolfModeLeft > 0' in line
]
if len(condition_indexes) != 1:
    raise RuntimeError(f'expected exactly one awakened-Wolf visual condition, got {condition_indexes}')
ci = condition_indexes[0]

replacement_indexes = []
for i in range(ci, min(ci + 4, len(lines))):
    if '0x8b0000' in lines[i]:
        replacement_indexes.append(i)
if len(replacement_indexes) != 1:
    raise RuntimeError(f'expected one dark-red assignment near awakened-Wolf condition, got {replacement_indexes}')
ri = replacement_indexes[0]
lines[ri] = lines[ri].replace('0x8b0000', '0x0077ff', 1)
visual_js['inlineCode'] = lines

# No AI/movement/state/rule changes in this patch.
path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'v0.5.3 applied: awakened Actor Wolf WOLF MODE = #0077FF blue at visual line {ri}; gameplay unchanged')
