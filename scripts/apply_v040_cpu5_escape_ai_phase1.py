import json
from pathlib import Path

path = Path('game.json')
data = json.loads(path.read_text(encoding='utf-8'))
layout = next(x for x in data['layouts'] if x.get('name') == 'FROST LAB')

# Version label.
build = next(o for o in layout['objects'] if o.get('name') == 'BuildText')
build['string'] = 'DEV v0.4.0'
build.setdefault('content', {})['text'] = 'DEV v0.4.0'

GROUP_NAME = 'v0.4.0 CPU5 Escape AI Phase 1'
layout['events'] = [e for e in layout.get('events', []) if e.get('name') != GROUP_NAME]

js_lines = [
    "const dt = gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(runtimeScene);",
    "const vars = runtimeScene.getVariables();",
    "const gameOver = vars.get('GameOver').getAsBoolean();",
    "if (!gameOver) {",
    "  const players = runtimeScene.getObjects('Player');",
    "  const player = players.length ? players[0] : null;",
    "  if (player) {",
    "    const pRole = player.getVariables().get('Role').getAsString();",
    "    const pState = player.getVariables().get('State').getAsString();",
    "    const wolfModeLeft = vars.get('WolfModeLeft').getAsNumber();",
    "    const px = player.getCenterXInScene();",
    "    const py = player.getCenterYInScene();",
    "    const fleeVisible = pRole === 'Wolf' && pState === 'Active' && wolfModeLeft > 0;",
    "    const fleeRadius = 360;",
    "    const fleeSpeed = 155;",
    "    const wanderSpeed = 65;",
    "    for (const actor of runtimeScene.getObjects('Actor')) {",
    "      const role = actor.getVariables().get('Role').getAsString();",
    "      const state = actor.getVariables().get('State').getAsString();",
    "      if (role !== 'Human' || state !== 'Active') continue;",
    "      const ax = actor.getCenterXInScene();",
    "      const ay = actor.getCenterYInScene();",
    "      const dx = ax - px;",
    "      const dy = ay - py;",
    "      const dist = Math.hypot(dx, dy);",
    "      let vx = 0;",
    "      let vy = 0;",
    "      let speed = wanderSpeed;",
    "      if (fleeVisible && dist < fleeRadius) {",
    "        const safeDist = Math.max(dist, 1);",
    "        vx = dx / safeDist;",
    "        vy = dy / safeDist;",
    "        speed = fleeSpeed;",
    "        actor.__iceWolfAITurnLeft = 0;",
    "      } else {",
    "        if (!Number.isFinite(actor.__iceWolfAITurnLeft) || actor.__iceWolfAITurnLeft <= 0 || !Number.isFinite(actor.__iceWolfAIDirX) || !Number.isFinite(actor.__iceWolfAIDirY)) {",
    "          const angle = Math.random() * Math.PI * 2;",
    "          actor.__iceWolfAIDirX = Math.cos(angle);",
    "          actor.__iceWolfAIDirY = Math.sin(angle);",
    "          actor.__iceWolfAITurnLeft = 0.65 + Math.random() * 0.9;",
    "        }",
    "        actor.__iceWolfAITurnLeft -= dt;",
    "        vx = actor.__iceWolfAIDirX;",
    "        vy = actor.__iceWolfAIDirY;",
    "      }",
    "      actor.setX(Math.max(-708, Math.min(692, actor.getX() + vx * speed * dt)));",
    "      actor.setY(Math.max(-708, Math.min(692, actor.getY() + vy * speed * dt)));",
    "    }",
    "  }",
    "}",
]

ai_group = {
    'colorB': 228,
    'colorG': 176,
    'colorR': 74,
    'creationTime': 0,
    'name': GROUP_NAME,
    'source': '',
    'type': 'BuiltinCommonInstructions::Group',
    'events': [
        {
            'type': 'BuiltinCommonInstructions::JsCode',
            'inlineCode': js_lines,
            'parameterObjects': '',
            'useStrict': True,
            'eventsSheetExpanded': False,
            'actions': [],
        },
        {
            'type': 'BuiltinCommonInstructions::ForEach',
            'object': 'Actor',
            'conditions': [
                {'type': {'value': 'BooleanVariable'}, 'parameters': ['GameOver', 'False', '']},
                {'type': {'value': 'StringObjectVariable'}, 'parameters': ['Actor', 'Role', '=', '\"Human\"']},
                {'type': {'value': 'StringObjectVariable'}, 'parameters': ['Actor', 'State', '=', '\"Active\"']},
            ],
            'actions': [
                {'type': {'value': 'SeparateFromObjects'}, 'parameters': ['Actor', 'Wall', '']},
                {'type': {'value': 'SeparateFromObjects'}, 'parameters': ['Actor', 'Barrier', '']},
            ],
            'events': [
                {'type': 'BuiltinCommonInstructions::Standard', 'conditions': [{'type': {'value': 'PosX'}, 'parameters': ['Actor', '<', '-708']}], 'actions': [{'type': {'value': 'SetX'}, 'parameters': ['Actor', '=', '-708']}]},
                {'type': 'BuiltinCommonInstructions::Standard', 'conditions': [{'type': {'value': 'PosX'}, 'parameters': ['Actor', '>', '692']}], 'actions': [{'type': {'value': 'SetX'}, 'parameters': ['Actor', '=', '692']}]},
                {'type': 'BuiltinCommonInstructions::Standard', 'conditions': [{'type': {'value': 'PosY'}, 'parameters': ['Actor', '<', '-708']}], 'actions': [{'type': {'value': 'SetY'}, 'parameters': ['Actor', '=', '-708']}]},
                {'type': 'BuiltinCommonInstructions::Standard', 'conditions': [{'type': {'value': 'PosY'}, 'parameters': ['Actor', '>', '692']}], 'actions': [{'type': {'value': 'SetY'}, 'parameters': ['Actor', '=', '692']}]},
            ],
        },
    ],
    'parameters': [],
    'actions': [],
}

# Place AI after the existing core actions so a freshly frozen actor stops in the same frame.
layout['events'].append(ai_group)

path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('v0.4.0 CPU5 Escape AI Phase 1 applied')
