import json
from pathlib import Path

path = Path('game.json')
data = json.loads(path.read_text(encoding='utf-8'))
layout = next(x for x in data['layouts'] if x.get('name') == 'FROST LAB')

build = next(o for o in layout['objects'] if o.get('name') == 'BuildText')
if build.get('string') != 'DEV v0.5.3':
    raise RuntimeError(f'expected DEV v0.5.3 base, got {build.get("string")!r}')
build['string'] = 'DEV v0.5.4'
build.setdefault('content', {})['text'] = 'DEV v0.5.4'

ai_group = next(e for e in layout['events'] if e.get('name') == 'v0.5.2 CPU5 Rescue AI + Repeat Wolf Cycle')
ai_js = next(e for e in ai_group['events'] if e.get('type') == 'BuiltinCommonInstructions::JsCode')
lines = list(ai_js.get('inlineCode', []))

# Add only second-Wolf movement recovery. Human AI, rules, colors and timing stay unchanged.
const_anchor = '    const aiWolfFreezeDistance = 30;'
if lines.count(const_anchor) != 1:
    raise RuntimeError('aiWolfFreezeDistance anchor mismatch')
ci = lines.index(const_anchor) + 1
movement_constants = [
    '    const aiWolfBlockedRatio = 0.28;',
    '    const aiWolfBlockedTrigger = 0.14;',
    '    const aiWolfDetourDuration = 0.75;',
]
lines[ci:ci] = movement_constants

pos_anchor = '      const wy = wolf.getCenterYInScene();'
if lines.count(pos_anchor) != 1:
    raise RuntimeError('wolf position anchor mismatch')
pi = lines.index(pos_anchor) + 1
stuck_tracker = [
    '      const prevActualX = wolf.__iceWolfAIWolfPrevActualX;',
    '      const prevActualY = wolf.__iceWolfAIWolfPrevActualY;',
    '      const lastExpectedMove = Number.isFinite(wolf.__iceWolfAIWolfLastExpectedMove) ? wolf.__iceWolfAIWolfLastExpectedMove : 0;',
    '      const hadPreviousActual = Number.isFinite(prevActualX) && Number.isFinite(prevActualY);',
    '      if (hadPreviousActual && lastExpectedMove > 0.4) {',
    '        const actualMove = Math.hypot(wx - prevActualX, wy - prevActualY);',
    '        const blocked = actualMove < Math.max(0.35, lastExpectedMove * aiWolfBlockedRatio);',
    '        const blockedFor = Number.isFinite(wolf.__iceWolfAIWolfBlockedFor) ? wolf.__iceWolfAIWolfBlockedFor : 0;',
    '        wolf.__iceWolfAIWolfBlockedFor = blocked ? blockedFor + dt : Math.max(0, blockedFor - dt * 2);',
    '      } else {',
    '        wolf.__iceWolfAIWolfBlockedFor = 0;',
    '      }',
    '      wolf.__iceWolfAIWolfPrevActualX = wx;',
    '      wolf.__iceWolfAIWolfPrevActualY = wy;',
    '      wolf.__iceWolfAIWolfDetourLeft = Math.max(0, (Number.isFinite(wolf.__iceWolfAIWolfDetourLeft) ? wolf.__iceWolfAIWolfDetourLeft : 0) - dt);',
]
lines[pi:pi] = stuck_tracker

# Clear recovery state after a successful freeze so the next chase starts cleanly.
freeze_anchor = "          wv.get('AIWolfCooldownLeft').setNumber(aiWolfCooldownDuration);"
if lines.count(freeze_anchor) != 1:
    raise RuntimeError('freeze cooldown anchor mismatch')
fi = lines.index(freeze_anchor) + 1
lines[fi:fi] = [
    '          wolf.__iceWolfAIWolfLastExpectedMove = 0;',
    '          wolf.__iceWolfAIWolfBlockedFor = 0;',
    '          wolf.__iceWolfAIWolfDetourLeft = 0;',
]

move_anchor = '      wolf.setX(Math.max(-708, Math.min(692, wolf.getX() + vx * speed * dt)));'
if lines.count(move_anchor) != 1:
    raise RuntimeError('wolf move anchor mismatch')
mi = lines.index(move_anchor)
recovery = [
    '      if (target && wolf.__iceWolfAIWolfBlockedFor >= aiWolfBlockedTrigger && wolf.__iceWolfAIWolfDetourLeft <= 0) {',
    '        const previousSign = Number.isFinite(wolf.__iceWolfAIWolfDetourSign) ? wolf.__iceWolfAIWolfDetourSign : 0;',
    '        wolf.__iceWolfAIWolfDetourSign = previousSign === 0 ? (Math.random() < 0.5 ? -1 : 1) : -previousSign;',
    '        wolf.__iceWolfAIWolfDetourLeft = aiWolfDetourDuration;',
    '        wolf.__iceWolfAIWolfBlockedFor = 0;',
    '      }',
    '      if (target && wolf.__iceWolfAIWolfDetourLeft > 0) {',
    '        const ddx = target.getCenterXInScene() - wx;',
    '        const ddy = target.getCenterYInScene() - wy;',
    '        const dd = Math.max(Math.hypot(ddx, ddy), 1);',
    '        const fx = ddx / dd;',
    '        const fy = ddy / dd;',
    '        const sign = wolf.__iceWolfAIWolfDetourSign || 1;',
    '        let dvx = fx * 0.35 + (-fy * sign) * 0.95;',
    '        let dvy = fy * 0.35 + (fx * sign) * 0.95;',
    '        if (wx < -640) dvx += 0.85;',
    '        else if (wx > 640) dvx -= 0.85;',
    '        if (wy < -640) dvy += 0.85;',
    '        else if (wy > 640) dvy -= 0.85;',
    '        const dm = Math.max(Math.hypot(dvx, dvy), 1);',
    '        vx = dvx / dm;',
    '        vy = dvy / dm;',
    '        speed = modeLeft > 0 ? aiWolfChaseSpeed : aiWolfStalkSpeed;',
    '      }',
    '      wolf.__iceWolfAIWolfLastExpectedMove = Math.max(0, speed * dt);',
]
lines[mi:mi] = recovery

ai_js['inlineCode'] = lines
path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('v0.5.4 applied: second Wolf stuck detection + alternating tangent detour; gameplay rules unchanged')
