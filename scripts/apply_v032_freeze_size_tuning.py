import json
from pathlib import Path

GAME = Path("game.json")
data = json.loads(GAME.read_text(encoding="utf-8"))

layout = next((x for x in data.get("layouts", []) if x.get("name") == "FROST LAB"), None)
assert layout is not None, "FROST LAB layout not found"

# Update visible dev label so iPhone testing can identify the exact candidate.
build_text = next((o for o in layout.get("objects", []) if o.get("name") == "BuildText"), None)
assert build_text is not None, "BuildText object not found"
build_text["string"] = "DEV v0.3.2"
if isinstance(build_text.get("content"), dict):
    build_text["content"]["text"] = "DEV v0.3.2"

# Minimal tuning only: keep Frozen/FrozenWolfCandidate visually identical,
# preserve cyan tint and audio feedback, but reduce the oversized 1.75 scale.
group = next((e for e in layout.get("events", []) if e.get("name") == "v0.3.1 Frozen visibility enforcement"), None)
assert group is not None, "v0.3.1 Frozen visibility enforcement group not found"
group["name"] = "v0.3.2 Frozen visibility enforcement"

changed = 0
state_specs = {}
for event in group.get("events", []):
    state = None
    for cond in event.get("conditions", []):
        params = cond.get("parameters", [])
        if cond.get("type", {}).get("value") == "StringObjectVariable" and len(params) >= 4 and params[0] == "Actor" and params[1] == "State":
            state = params[3].strip('"')
    if state not in {"Frozen", "FrozenWolfCandidate", "Active"}:
        continue

    tint = None
    scale = None
    for action in event.get("actions", []):
        value = action.get("type", {}).get("value")
        params = action.get("parameters", [])
        if value == "ChangeColor" and len(params) >= 2 and params[0] == "Actor":
            tint = params[1]
        if value == "ScalableCapability::ScalableBehavior::SetValue" and len(params) >= 4 and params[0] == "Actor" and params[1] == "Scale":
            if state in {"Frozen", "FrozenWolfCandidate"}:
                assert params[3] == "1.75", f"Unexpected pre-v0.3.2 scale for {state}: {params[3]}"
                params[3] = "1.15"
                changed += 1
            scale = params[3]
    state_specs[state] = (tint, scale)

assert changed == 2, f"Expected exactly 2 frozen scale edits, got {changed}"
assert state_specs.get("Frozen") == state_specs.get("FrozenWolfCandidate"), (
    "Frozen and FrozenWolfCandidate must remain visually identical: "
    f"{state_specs.get('Frozen')} vs {state_specs.get('FrozenWolfCandidate')}"
)
assert state_specs.get("Frozen") == ('"0;255;255"', "1.15"), f"Unexpected Frozen visual spec: {state_specs.get('Frozen')}"
assert state_specs.get("Active") == ('"255;255;255"', "1.0"), f"Unexpected Active visual spec: {state_specs.get('Active')}"

# Preserve freeze sound hooks added in v0.3.1.
serialized = json.dumps(data, ensure_ascii=False)
assert serialized.count('freeze_crack.wav') >= 3, "freeze_crack.wav resource/action hooks appear missing"
assert '"DEV v0.3.2"' in serialized, "DEV v0.3.2 label missing"
assert '"1.75"' not in json.dumps(group, ensure_ascii=False), "Oversized 1.75 frozen scale still remains in enforcement group"

GAME.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("v0.3.2 tuning applied: Frozen/FrozenWolfCandidate scale 1.75 -> 1.15; cyan/audio preserved; DEV label updated")
