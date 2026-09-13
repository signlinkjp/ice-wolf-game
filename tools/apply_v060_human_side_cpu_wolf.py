from __future__ import annotations

import json
from pathlib import Path

PROJECT = Path("game.json")

data = json.loads(PROJECT.read_text(encoding="utf-8"))
frost = next((layout for layout in data.get("layouts", []) if layout.get("name") == "FROST LAB"), None)
if frost is None:
    raise SystemExit("FROST LAB layout not found")

actor_instances = [i for i in frost.get("instances", []) if i.get("name") == "Actor"]
if len(actor_instances) != 6:
    raise SystemExit(f"expected exact v0.5.4 baseline with 6 Actor instances; got {len(actor_instances)}")

# 1) Version label: gameplay version becomes v0.6.0.
build = next((o for o in frost.get("objects", []) if o.get("name") == "BuildText"), None)
if build is None:
    raise SystemExit("BuildText not found")
if build.get("string") != "開発版 v0.5.4" or build.get("content", {}).get("text") != "開発版 v0.5.4":
    raise SystemExit("unexpected BuildText baseline; refusing to patch")
build["string"] = "開発版 v0.6.0"
build["content"]["text"] = "開発版 v0.6.0"

# Helpers for event lookup.
def condition_is_clicked(event: dict, object_name: str) -> bool:
    for condition in event.get("conditions", []):
        ctype = condition.get("type", {}).get("value")
        params = condition.get("parameters", [])
        if ctype == "ButtonStates::ButtonFSM::IsClicked" and params and params[0] == object_name:
            return True
    return False

# 2) Human-side role setup: switching Player to Human now creates exactly one
# primary CPU Wolf. Switching back to Wolf restores all Actors to Human.
wolf_actions = next((e for e in frost.get("events", []) if e.get("name") == "Wolf actions"), None)
if wolf_actions is None:
    raise SystemExit("Wolf actions group not found")
role_toggle = next((e for e in wolf_actions.get("events", []) if condition_is_clicked(e, "TestRoleButton")), None)
if role_toggle is None:
    raise SystemExit("TestRoleButton event not found")

role_setup_code = [
    "const players = runtimeScene.getObjects('Player');",
    "const actors = runtimeScene.getObjects('Actor');",
    "const player = players.length ? players[0] : null;",
    "if (player) {",
    "  const role = player.getVariables().get('Role').getAsString();",
    "  for (const actor of actors) {",
    "    const av = actor.getVariables();",
    "    av.get('Role').setString('Human');",
    "    av.get('State').setString('Active');",
    "    av.get('AIWolfModeLeft').setNumber(0);",
    "    av.get('AIWolfCooldownLeft').setNumber(0);",
    "    actor.__iceWolfPrimaryCPUWolf = false;",
    "  }",
    "  if (role === 'Human' && actors.length > 0) {",
    "    const chosenIndex = Math.floor(Math.random() * actors.length);",
    "    const wolf = actors[chosenIndex];",
    "    const wv = wolf.getVariables();",
    "    wv.get('Role').setString('Wolf');",
    "    wv.get('State').setString('Active');",
    "    wv.get('AIWolfModeLeft').setNumber(0);",
    "    wv.get('AIWolfCooldownLeft').setNumber(1.5);",
    "    wolf.__iceWolfPrimaryCPUWolf = true;",
    "  }",
    "}",
]

existing_role_marker = any(
    "__iceWolfPrimaryCPUWolf" in line
    for child in role_toggle.get("events", [])
    if child.get("type") == "BuiltinCommonInstructions::JsCode"
    for line in child.get("inlineCode", [])
)
if existing_role_marker:
    raise SystemExit("v0.6.0 role setup already present")

role_toggle.setdefault("events", []).append(
    {
        "type": "BuiltinCommonInstructions::JsCode",
        "inlineCode": role_setup_code,
        "parameterObjects": "",
        "useStrict": True,
        "eventsSheetExpanded": False,
        "actions": [],
    }
)

# 3) Human CPU rescue AI: when the Player is Human + Frozen, CPU Humans may
# treat the Player as a rescue target, using the same safety/radius logic.
ai_group = next(
    (e for e in frost.get("events", []) if e.get("name") == "v0.5.2 CPU5 Rescue AI + Repeat Wolf Cycle"),
    None,
)
if ai_group is None:
    raise SystemExit("CPU AI group not found")
ai_js = next((e for e in ai_group.get("events", []) if e.get("type") == "BuiltinCommonInstructions::JsCode"), None)
if ai_js is None:
    raise SystemExit("CPU AI JavaScript event not found")
lines = ai_js.get("inlineCode", [])
if any("playerStateNow === 'Frozen'" in line for line in lines):
    raise SystemExit("v0.6.0 player rescue patch already present")

# Match by code token rather than exact indentation: GDevelop preserves nested
# indentation in inlineCode and older revisions used a different number of spaces.
needle_index = next(
    (i for i, line in enumerate(lines) if line.strip() == "let rescueTargetDist = Infinity;"),
    None,
)
if needle_index is None:
    raise SystemExit("rescue target insertion point not found")
indent = lines[needle_index][: len(lines[needle_index]) - len(lines[needle_index].lstrip())]
insert_at = needle_index + 1
player_rescue_lines = [
    f"{indent}const playerStateNow = pVars.get('State').getAsString();",
    f"{indent}if (pRole === 'Human' && playerStateNow === 'Frozen') {{",
    f"{indent}  const pd = Math.hypot(px - ax, py - ay);",
    f"{indent}  if (pd <= rescueSearchRadius) {{",
    f"{indent}    rescueTarget = player;",
    f"{indent}    rescueTargetDist = pd;",
    f"{indent}  }}",
    f"{indent}}}",
]
lines[insert_at:insert_at] = player_rescue_lines

# 4) Repair the stale core gameplay test so it matches the actual v0.5.4
# baseline (7 total participants and 210-second match) before extending tests.
step2 = next((t for t in data.get("tests", []) if t.get("name") == "STEP2 core test"), None)
if step2 is None:
    raise SystemExit("STEP2 core test not found")

replacements = {
    "// C1 C2: 6 actors, Wolf1/Human5": "// C1 C2: 7 participants, Player Wolf + 6 Human Actors",
    "harness.assert(actors().length === 5, `C1 5 test actors + player, got ${actors().length}`);": "harness.assert(actors().length === 6, `C1 6 actors + player, got ${actors().length}`);",
    "harness.assert(ttxt.text === '5:00' || ttxt.text === '4:59', `K timer ticking, got ${ttxt.text}`);": "harness.assert(ttxt.text === '3:30' || ttxt.text === '3:29', `K timer ticking, got ${ttxt.text}`);",
    "// L wolf win: freeze 4 via setup, 1 via play": "// L wolf win: freeze 5 via setup, 1 via play",
    "for (let i = 0; i < 4; i++) harness.setObjectVariable(list[i].id, 'State', 'Frozen');": "for (let i = 0; i < 5; i++) harness.setObjectVariable(list[i].id, 'State', 'Frozen');",
    "const last = actors()[4];": "const last = actors()[5];",
}
source = step2.get("source", [])
for old, new in replacements.items():
    if old not in source:
        raise SystemExit(f"STEP2 baseline line not found: {old}")
    source[source.index(old)] = new
step2["lastRunAt"] = 0
step2["lastRunDurationMs"] = 0
step2["lastRunFramesExecuted"] = 0
step2["lastRunStatus"] = "not-run"

# 5) Add a targeted GDevelop gameplay test for the new human-side loop.
if any(t.get("name") == "v0.6.0 human-side CPU Wolf test" for t in data.get("tests", [])):
    raise SystemExit("v0.6.0 gameplay test already exists")

new_test = {
    "description": "Human role creates one CPU Wolf; CPU Wolf can freeze Player; Human CPU can rescue frozen Player",
    "lastRunAt": 0,
    "lastRunDurationMs": 0,
    "lastRunFramesExecuted": 0,
    "lastRunStatus": "not-run",
    "name": "v0.6.0 human-side CPU Wolf test",
    "type": "gameplay",
    "source": [
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
        "await click(1190, 622);",
        "harness.assert(pvar('Role') === 'Human', 'Player switched to Human');",
        "let wolfActors = actors().filter(a => avar(a.id, 'Role') === 'Wolf' && avar(a.id, 'State') === 'Active');",
        "let humanActors = actors().filter(a => avar(a.id, 'Role') === 'Human' && avar(a.id, 'State') === 'Active');",
        "harness.assert(wolfActors.length === 1, `exactly one primary CPU Wolf, got ${wolfActors.length}`);",
        "harness.assert(humanActors.length === 5, `five Human CPU allies, got ${humanActors.length}`);",
        "const player = harness.getObjects('Player')[0];",
        "const wolf = wolfActors[0];",
        "harness.setObjectVariable(wolf.id, 'AIWolfCooldownLeft', 0);",
        "harness.setObjectVariable(wolf.id, 'AIWolfModeLeft', 0);",
        "harness.setObjectPosition(wolf.id, player.centerX + 10, player.centerY);",
        "await harness.stepFrames(20);",
        "harness.assert(pvar('State') === 'Frozen', 'CPU Wolf can freeze Human Player');",
        "harness.setObjectPosition(wolf.id, -650, -650);",
        "harness.setObjectVariable(wolf.id, 'AIWolfModeLeft', 0);",
        "harness.setObjectVariable(wolf.id, 'AIWolfCooldownLeft', 999);",
        "humanActors = actors().filter(a => avar(a.id, 'Role') === 'Human' && avar(a.id, 'State') === 'Active');",
        "const rescuer = humanActors[0];",
        "const frozenPlayer = harness.getObjects('Player')[0];",
        "harness.setObjectPosition(rescuer.id, frozenPlayer.centerX + 10, frozenPlayer.centerY);",
        "await harness.stepFrames(30);",
        "harness.assert(pvar('State') === 'Active', 'Human CPU rescues frozen Human Player');",
        "",
    ],
}
data.setdefault("tests", []).append(new_test)

# Compact UTF-8 JSON, matching the repository's canonical one-line style.
PROJECT.write_text(
    json.dumps(data, ensure_ascii=False, separators=(",", ":")),
    encoding="utf-8",
)
print("Applied ICE WOLF v0.6.0 Human-Side Playability Phase 1")
