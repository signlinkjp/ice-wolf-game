import json
from pathlib import Path

path = Path('game.json')
data = json.loads(path.read_text(encoding='utf-8'))
layout = next(x for x in data['layouts'] if x.get('name') == 'FROST LAB')

# Version label.
build = next(o for o in layout['objects'] if o.get('name') == 'BuildText')
build['string'] = 'DEV v0.3.5'
build.setdefault('content', {})['text'] = 'DEV v0.3.5'

# The real bug: Actor instances already have the same custom dimensions as Player
# (17 x 17 x 32). Setting Actor Scale = 1.0 resets the rendered cube to its
# 100-unit base object size, making Humans/Frozen actors look huge. Remove every
# Actor Scale action and let the custom instance dimensions control rendering.
removed = 0

def walk(events):
    global removed
    for event in events:
        actions = event.get('actions', [])
        kept = []
        for action in actions:
            t = action.get('type', {})
            value = t.get('value') if isinstance(t, dict) else None
            params = action.get('parameters', [])
            if (
                value == 'ScalableCapability::ScalableBehavior::SetValue'
                and len(params) >= 2
                and params[0] == 'Actor'
                and params[1] == 'Scale'
            ):
                removed += 1
                continue
            kept.append(action)
        event['actions'] = kept
        walk(event.get('events', []))

walk(layout.get('events', []))
if removed < 3:
    raise SystemExit(f'Expected to remove at least 3 Actor Scale actions, removed {removed}')

# Rename the old visibility group so the intent is explicit, while retaining
# the red/white state-color enforcement only (no size mutation).
for event in layout.get('events', []):
    if event.get('name') == 'v0.3.2 Frozen visibility enforcement':
        event['name'] = 'v0.3.5 actor size parity + frozen color enforcement'

# Assert scene-instance size parity remains exact.
player = next(i for i in layout['instances'] if i.get('name') == 'Player')
actors = [i for i in layout['instances'] if i.get('name') == 'Actor']
if len(actors) != 5:
    raise SystemExit(f'Expected 5 Actor instances, got {len(actors)}')
for actor in actors:
    for key in ('width', 'height', 'depth'):
        actor[key] = player[key]
    actor['customSize'] = True

path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'v0.3.5 applied; removed {removed} Actor Scale actions; actor dimensions = {player["width"]}x{player["height"]}x{player["depth"]}')
