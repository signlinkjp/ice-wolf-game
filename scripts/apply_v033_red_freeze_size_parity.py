import json
from pathlib import Path

GAME = Path("game.json")
data = json.loads(GAME.read_text(encoding="utf-8"))

frost = next(layout for layout in data["layouts"] if layout.get("name") == "FROST LAB")

# 1) Enforce all test Human actors to use the exact same base instance dimensions as Player/Wolf.
player_instance = next(i for i in frost["instances"] if i.get("name") == "Player")
actor_instances = [i for i in frost["instances"] if i.get("name") == "Actor"]
for actor in actor_instances:
    actor["customSize"] = True
    actor["width"] = player_instance["width"]
    actor["height"] = player_instance["height"]
    actor["depth"] = player_instance["depth"]

# Helpers for recursive event traversal.
def walk_events(events):
    for ev in events:
        yield ev
        yield from walk_events(ev.get("events", []))

# 2) Frozen feedback: use red instead of cyan, and stop enlarging frozen actors.
for ev in walk_events(frost.get("events", [])):
    for action in ev.get("actions", []):
        t = action.get("type", {}).get("value")
        p = action.get("parameters", [])
        # Red for any existing frozen-state cyan color hook (Actor freeze or Player trap).
        if t == "ChangeColor" and len(p) >= 2 and p[0] in {"Actor", "Player"} and p[1] == '"0;255;255"':
            p[1] = '"255;0;0"'
        # Frozen actors should remain the same visual size as active actors.
        if t == "ScalableCapability::ScalableBehavior::SetValue" and len(p) >= 4 and p[0] == "Actor" and p[1] == "Scale" and p[3] == "1.15":
            p[3] = "1.0"

# 3) Update DEV label.
for obj in frost.get("objects", []):
    if obj.get("name") == "BuildText":
        obj["string"] = "DEV v0.3.3"
        if isinstance(obj.get("content"), dict):
            obj["content"]["text"] = "DEV v0.3.3"

# Validation.
assert len(actor_instances) == 5
for actor in actor_instances:
    assert actor["width"] == player_instance["width"]
    assert actor["height"] == player_instance["height"]
    assert actor["depth"] == player_instance["depth"]

raw = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
assert "DEV v0.3.3" in raw
assert '255;0;0' in raw
# v0.3.3 must not keep the old frozen 1.15x enforcement or cyan frozen color.
assert '"Scale","=","1.15"' not in raw
assert '\"0;255;255\"' not in raw

GAME.write_text(raw, encoding="utf-8")
print("Applied v0.3.3: actor/player size parity + red frozen state + no frozen scale enlargement")
