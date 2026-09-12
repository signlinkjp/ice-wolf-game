import json
from pathlib import Path

path = Path('game.json')
data = json.loads(path.read_text(encoding='utf-8'))
layout = next(x for x in data['layouts'] if x.get('name') == 'FROST LAB')

build = next(o for o in layout['objects'] if o.get('name') == 'BuildText')
build['string'] = 'DEV v0.5.0'
build.setdefault('content', {})['text'] = 'DEV v0.5.0'

OLD_GROUP = 'v0.4.0 CPU5 Escape AI Phase 1'
NEW_GROUP = 'v0.5.0 CPU5 Rescue AI Phase 2'
groups = [e for e in layout.get('events', []) if e.get('name') == OLD_GROUP]
if len(groups) != 1:
    raise RuntimeError(f'expected exactly one {OLD_GROUP!r}, got {len(groups)}')
group = groups[0]
group['name'] = NEW_GROUP

js = next(e for e in group['events'] if e.get('type') == 'BuiltinCommonInstructions::JsCode')
js['inlineCode'] = [
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
    "    const wolfVisible = pRole === 'Wolf' && pState === 'Active' && wolfModeLeft > 0;",
    "    const fleeRadius = 360;",
    "    const fleeSpeed = 155;",
    "    const wanderSpeed = 65;",
    "    const rescueSearchRadius = 520;",
    "    const rescueSpeed = 95;",
    "    const rescueDistance = 34;",
    "    const rescueDangerRadius = 360;",
    "    const actors = runtimeScene.getObjects('Actor');",
    "    for (const actor of actors) {",
    "      const actorVars = actor.getVariables();",
    "      const role = actorVars.get('Role').getAsString();",
    "      const state = actorVars.get('State').getAsString();",
    "      if (role !== 'Human' || state !== 'Active') continue;",
    "      actor.__iceWolfAIRescueCooldown = Math.max(0, (Number.isFinite(actor.__iceWolfAIRescueCooldown) ? actor.__iceWolfAIRescueCooldown : 0) - dt);",
    "      const ax = actor.getCenterXInScene();",
    "      const ay = actor.getCenterYInScene();",
    "      const dx = ax - px;",
    "      const dy = ay - py;",
    "      const dist = Math.hypot(dx, dy);",
    "      let vx = 0;",
    "      let vy = 0;",
    "      let speed = wanderSpeed;",
    "      let hasIntent = false;",
    "      if (wolfVisible && dist < fleeRadius) {",
    "        const safeDist = Math.max(dist, 1);",
    "        vx = dx / safeDist;",
    "        vy = dy / safeDist;",
    "        speed = fleeSpeed;",
    "        hasIntent = true;",
    "        actor.__iceWolfAITurnLeft = 0;",
    "      } else if (actor.__iceWolfAIRescueCooldown <= 0) {",
    "        let rescueTarget = null;",
    "        let rescueTargetDist = Infinity;",
    "        for (const target of actors) {",
    "          if (target === actor) continue;",
    "          const targetState = target.getVariables().get('State').getAsString();",
    "          if (targetState !== 'Frozen' && targetState !== 'FrozenWolfCandidate') continue;",
    "          const tx = target.getCenterXInScene();",
    "          const ty = target.getCenterYInScene();",
    "          const td = Math.hypot(tx - ax, ty - ay);",
    "          if (td < rescueTargetDist && td <= rescueSearchRadius) {",
    "            rescueTarget = target;",
    "            rescueTargetDist = td;",
    "          }",
    "        }",
    "        if (rescueTarget) {",
    "          const tx = rescueTarget.getCenterXInScene();",
    "          const ty = rescueTarget.getCenterYInScene();",
    "          const targetDanger = wolfVisible && Math.hypot(tx - px, ty - py) < rescueDangerRadius;",
    "          if (!targetDanger) {",
    "            if (rescueTargetDist <= rescueDistance) {",
    "              const targetVars = rescueTarget.getVariables();",
    "              const targetState = targetVars.get('State').getAsString();",
    "              if (targetState === 'FrozenWolfCandidate') {",
    "                targetVars.get('Role').setString('Wolf');",
    "                targetVars.get('State').setString('Active');",
    "                actorVars.get('State').setString('Frozen');",
    "              } else if (targetState === 'Frozen') {",
    "                targetVars.get('State').setString('Active');",
    "                actor.__iceWolfAIRescueCooldown = 1.0;",
    "                rescueTarget.__iceWolfAIRescueCooldown = 1.2;",
    "              }",
    "              continue;",
    "            }",
    "            const safeRescueDist = Math.max(rescueTargetDist, 1);",
    "            vx = (tx - ax) / safeRescueDist;",
    "            vy = (ty - ay) / safeRescueDist;",
    "            speed = rescueSpeed;",
    "            hasIntent = true;",
    "            actor.__iceWolfAITurnLeft = 0;",
    "          }",
    "        }",
    "      }",
    "      if (!hasIntent) {",
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

path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('v0.5.0 CPU5 Rescue AI Phase 2 applied')
