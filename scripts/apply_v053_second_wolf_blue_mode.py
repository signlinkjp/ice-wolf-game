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
code = '\n'.join(visual_js.get('inlineCode', []))

# v0.5.1/v0.5.2 used the same dark-red visible WOLF MODE color for the awakened
# Actor Wolf and the original Player Wolf. Change ONLY the awakened Actor Wolf
# WOLF MODE color to electric blue so the original Wolf can identify its teammate.
old = "    const actorColor = (state === 'Frozen' || state === 'FrozenWolfCandidate') ? 0xff0000 : (role === 'Wolf' && aiWolfModeLeft > 0 ? 0x8b0000 : 0xffffff);"
new = "    const actorColor = (state === 'Frozen' || state === 'FrozenWolfCandidate') ? 0xff0000 : (role === 'Wolf' && aiWolfModeLeft > 0 ? 0x0077ff : 0xffffff);"
if code.count(old) != 1:
    raise RuntimeError(f'expected exactly one awakened-Wolf color line, got {code.count(old)}')
code = code.replace(old, new)
visual_js['inlineCode'] = code.split('\n')

# No AI/movement/state/rule changes in this patch.
path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('v0.5.3 applied: awakened Actor Wolf WOLF MODE = #0077FF blue; gameplay unchanged')
