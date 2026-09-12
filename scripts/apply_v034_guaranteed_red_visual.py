import json
from pathlib import Path

GAME = Path("game.json")
data = json.loads(GAME.read_text(encoding="utf-8"))
frost = next(layout for layout in data["layouts"] if layout.get("name") == "FROST LAB")

# Guard: this patch is intentionally based on the validated v0.3.3 candidate.
build = next(obj for obj in frost["objects"] if obj.get("name") == "BuildText")
assert build.get("string") == "DEV v0.3.3", f"unexpected base build: {build.get('string')}"

# 1) Absolute size parity: Player/Wolf, every Human Actor, Frozen and FrozenWolfCandidate
# all use the Player instance dimensions and no frozen-state enlargement.
player_instance = next(i for i in frost["instances"] if i.get("name") == "Player")
actor_instances = [i for i in frost["instances"] if i.get("name") == "Actor"]
assert len(actor_instances) == 5
for actor in actor_instances:
    actor["customSize"] = True
    actor["width"] = player_instance["width"]
    actor["height"] = player_instance["height"]
    actor["depth"] = player_instance["depth"]

# Recursive event traversal.
def walk(events):
    for ev in events:
        yield ev
        yield from walk(ev.get("events", []))

# Keep all Actor scale enforcement at exactly 1.0 (Active/Frozen/Candidate alike).
for ev in walk(frost.get("events", [])):
    for action in ev.get("actions", []):
        if action.get("type", {}).get("value") == "ScalableCapability::ScalableBehavior::SetValue":
            p = action.get("parameters", [])
            if len(p) >= 4 and p[0] == "Actor" and p[1] == "Scale":
                p[3] = "1.0"

# 2) Update DEV label.
build["string"] = "DEV v0.3.4"
if isinstance(build.get("content"), dict):
    build["content"]["text"] = "DEV v0.3.4"

# 3) Guarantee visible state colors at render-material level.
# Runtime ChangeColor is kept for existing game logic, but this override replaces the
# textured/lighting-dependent cube materials with per-object MeshBasicMaterials.
# This makes Active Player/Wolf and Humans identically solid white, and any Frozen or
# FrozenWolfCandidate identically solid bright red, independent of lighting/textures.
group_name = "v0.3.4 guaranteed solid-state visuals"
frost["events"] = [ev for ev in frost.get("events", []) if ev.get("name") != group_name]

js_lines = [
    "const sceneVars = runtimeScene.getVariables();",
    "const wolfModeLeft = sceneVars.get('WolfModeLeft').getAsNumber();",
    "const getState = (obj) => obj.getVariables().get('State').getAsString();",
    "const ensureSolidMaterials = (obj) => {",
    "  const mesh = obj.get3DRendererObject && obj.get3DRendererObject();",
    "  if (!mesh) return null;",
    "  if (!obj.__iceWolfSolidVisualReady) {",
    "    const oldMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];",
    "    const solidMaterials = oldMaterials.map(() => new THREE.MeshBasicMaterial({ color: 0xffffff }));",
    "    mesh.material = Array.isArray(mesh.material) ? solidMaterials : solidMaterials[0];",
    "    obj.__iceWolfSolidVisualReady = true;",
    "  }",
    "  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];",
    "};",
    "const setSolidColor = (obj, hexColor) => {",
    "  const materials = ensureSolidMaterials(obj);",
    "  if (!materials) return;",
    "  for (const material of materials) {",
    "    material.color.setHex(hexColor);",
    "  }",
    "};",
    "for (const actor of runtimeScene.getObjects('Actor')) {",
    "  const state = getState(actor);",
    "  const isFrozen = state === 'Frozen' || state === 'FrozenWolfCandidate';",
    "  setSolidColor(actor, isFrozen ? 0xff0000 : 0xffffff);",
    "}",
    "for (const player of runtimeScene.getObjects('Player')) {",
    "  const state = getState(player);",
    "  if (state === 'Frozen') setSolidColor(player, 0xff0000);",
    "  else if (wolfModeLeft > 0) setSolidColor(player, 0x8b0000);",
    "  else setSolidColor(player, 0xffffff);",
    "}",
]

frost["events"].append({
    "colorB": 228,
    "colorG": 176,
    "colorR": 74,
    "creationTime": 0,
    "name": group_name,
    "source": "",
    "type": "BuiltinCommonInstructions::Group",
    "events": [{
        "type": "BuiltinCommonInstructions::JsCode",
        "inlineCode": js_lines,
        "parameterObjects": "",
        "useStrict": True,
        "eventsSheetExpanded": False,
    }],
    "parameters": [],
})

# Static invariants.
assert (player_instance["width"], player_instance["height"], player_instance["depth"]) == (17, 17, 32)
assert all((a["width"], a["height"], a["depth"]) == (17, 17, 32) for a in actor_instances)
assert build["string"] == "DEV v0.3.4"
assert sum(1 for ev in frost["events"] if ev.get("name") == group_name) == 1
raw = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
assert "new THREE.MeshBasicMaterial({ color: 0xffffff })" in raw
assert "0xff0000" in raw
assert "FrozenWolfCandidate" in raw
assert '\"Scale\",\"=\",\"1.15\"' not in raw

GAME.write_text(raw, encoding="utf-8")
print("Applied v0.3.4: guaranteed solid white active / bright red frozen visuals with exact size parity")
