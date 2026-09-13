from __future__ import annotations

import json
from pathlib import Path

# One-time branch-only transformer. The workflow removes this helper after validation.
PROJECT = Path('game.json')
data = json.loads(PROJECT.read_text(encoding='utf-8'))
frost = next((x for x in data.get('layouts', []) if x.get('name') == 'FROST LAB'), None)
if frost is None:
    raise SystemExit('FROST LAB not found')


def clicked(event: dict, object_name: str) -> bool:
    for condition in event.get('conditions', []):
        if condition.get('type', {}).get('value') != 'ButtonStates::ButtonFSM::IsClicked':
            continue
        params = condition.get('parameters', [])
        if params and params[0] == object_name:
            return True
    return False

wolf_actions = next((e for e in frost.get('events', []) if e.get('name') == 'Wolf actions'), None)
if wolf_actions is None:
    raise SystemExit('Wolf actions not found')

toggle = next((e for e in wolf_actions.get('events', []) if clicked(e, 'TestRoleButton')), None)
if toggle is None:
    raise SystemExit('TestRoleButton event not found')

role_js = next(
    (
        e for e in toggle.get('events', [])
        if e.get('type') == 'BuiltinCommonInstructions::JsCode'
        and any('__iceWolfPrimaryCPUWolf' in line for line in e.get('inlineCode', []))
    ),
    None,
)
if role_js is None:
    raise SystemExit('v0.6.0 role setup JS not found')

old_source = '\n'.join(role_js.get('inlineCode', []))
if "av.get('State').setString('Active')" not in old_source:
    raise SystemExit('expected pre-fix role setup not found; refusing to patch')

role_js['inlineCode'] = [
    "const players = runtimeScene.getObjects('Player');",
    "const actors = runtimeScene.getObjects('Actor');",
    "const player = players.length ? players[0] : null;",
    "if (player) {",
    "  const role = player.getVariables().get('Role').getAsString();",
    "",
    "  // Remove only the temporary primary CPU Wolf created by this dev role toggle.",
    "  // Preserve every Actor State so frozen/infected match state is never erased.",
    "  for (const actor of actors) {",
    "    if (!actor.__iceWolfPrimaryCPUWolf) continue;",
    "    const av = actor.getVariables();",
    "    if (av.get('Role').getAsString() === 'Wolf') av.get('Role').setString('Human');",
    "    av.get('AIWolfModeLeft').setNumber(0);",
    "    av.get('AIWolfCooldownLeft').setNumber(0);",
    "    actor.__iceWolfPrimaryCPUWolf = false;",
    "  }",
    "",
    "  if (role === 'Human') {",
    "    // If an awakened/infected Actor Wolf already exists, reuse it rather than",
    "    // spawning an additional primary Wolf. Otherwise promote one Active Human.",
    "    const existingWolf = actors.find(actor => {",
    "      const av = actor.getVariables();",
    "      return av.get('Role').getAsString() === 'Wolf' && av.get('State').getAsString() === 'Active';",
    "    });",
    "    if (!existingWolf) {",
    "      const candidates = actors.filter(actor => {",
    "        const av = actor.getVariables();",
    "        return av.get('Role').getAsString() === 'Human' && av.get('State').getAsString() === 'Active';",
    "      });",
    "      if (candidates.length > 0) {",
    "        const wolf = candidates[Math.floor(Math.random() * candidates.length)];",
    "        const wv = wolf.getVariables();",
    "        wv.get('Role').setString('Wolf');",
    "        wv.get('AIWolfModeLeft').setNumber(0);",
    "        wv.get('AIWolfCooldownLeft').setNumber(1.5);",
    "        wolf.__iceWolfPrimaryCPUWolf = true;",
    "      }",
    "    }",
    "  }",
    "}",
]

PROJECT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('Applied v0.6.0 role-toggle state-preservation fix')
