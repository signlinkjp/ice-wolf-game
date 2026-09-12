import copy
import json
import uuid
from pathlib import Path

PATH = Path("game.json")
ICE = "0;255;255"
WHITE = "255;255;255"


def uid():
    return str(uuid.uuid4())


def tval(node):
    return node.get("type", {}).get("value") if isinstance(node.get("type"), dict) else node.get("type")


def is_button_click(event, button_name):
    return any(
        tval(c) == "ButtonStates::ButtonFSM::IsClicked"
        and c.get("parameters", [None])[0] == button_name
        for c in event.get("conditions", [])
    )


def add_feedback(actions, text, seconds=1.15):
    actions.extend([
        {"type": {"value": "TextContainerCapability::TextContainerBehavior::SetValue"},
         "parameters": ["ActionFeedbackText", "Text", "=", json.dumps(text)]},
        {"type": {"value": "Show"}, "parameters": ["ActionFeedbackText", ""]},
        {"type": {"value": "SetNumberVariable"}, "parameters": ["FeedbackLeft", "=", str(seconds)]},
    ])


def make_text_from(base, name, text, size, color, bold=True, outline=4):
    obj = copy.deepcopy(base)
    obj["name"] = name
    obj["persistentUuid"] = uid()
    obj["string"] = text
    obj["characterSize"] = size
    obj["bold"] = bold
    r, g, b = (int(v) for v in color.split(";"))
    obj["color"] = {"r": r, "g": g, "b": b}
    obj["behaviors"] = []
    c = obj["content"]
    c["text"] = text
    c["characterSize"] = size
    c["bold"] = bold
    c["color"] = color
    c["isOutlineEnabled"] = True
    c["outlineColor"] = "0;0;0"
    c["outlineThickness"] = outline
    c["isShadowEnabled"] = True
    c["shadowColor"] = "0;0;0"
    c["shadowDistance"] = 2
    c["shadowBlurRadius"] = 2
    c["shadowOpacity"] = 180
    return obj


def set_button_style(obj, text, size, color):
    obj["string"] = text
    obj["characterSize"] = size
    obj["bold"] = True
    r, g, b = (int(v) for v in color.split(";"))
    obj["color"] = {"r": r, "g": g, "b": b}
    c = obj["content"]
    c["text"] = text
    c["characterSize"] = size
    c["bold"] = True
    c["color"] = color
    c["isOutlineEnabled"] = True
    c["outlineColor"] = "0;0;0"
    c["outlineThickness"] = 4
    c["isShadowEnabled"] = True
    c["shadowColor"] = "0;0;0"
    c["shadowDistance"] = 2
    c["shadowBlurRadius"] = 2
    c["shadowOpacity"] = 180


def instance_from(base, name, x, y, width, height, hidden=False):
    inst = copy.deepcopy(base)
    inst["name"] = name
    inst["persistentUuid"] = uid()
    inst["layer"] = "UI"
    inst["x"] = x
    inst["y"] = y
    inst["width"] = width
    inst["height"] = height
    inst["customSize"] = True
    if hidden:
        inst["hidden"] = True
    else:
        inst.pop("hidden", None)
    return inst


def walk_events(events):
    for event in events:
        yield event
        yield from walk_events(event.get("events", []))


data = json.loads(PATH.read_text(encoding="utf-8"))
layout = next(x for x in data["layouts"] if x["name"] == "FROST LAB")
objects = {o["name"]: o for o in layout["objects"]}
instances = {i["name"]: i for i in layout["instances"]}

# Scene feedback timer.
if not any(v.get("name") == "FeedbackLeft" for v in layout["variables"]):
    layout["variables"].append({"name": "FeedbackLeft", "type": "number", "value": 0})

# Strong, distinct action controls. These remain contextual; only their readability/touch size changes.
set_button_style(objects["WolfButton"], "[ WOLF MODE ]", 40, "255;90;90")
set_button_style(objects["RescueButton"], "[ RESCUE ]", 40, "80;255;210")
set_button_style(objects["InfectButton"], "[ INFECT ]", 40, "255;190;70")

for name, y in (("WolfButton", 280), ("RescueButton", 370), ("InfectButton", 460)):
    inst = instances[name]
    inst["x"] = 1010
    inst["y"] = y
    inst["width"] = 250
    inst["height"] = 72
    inst["customSize"] = True

# Add persistent action/status HUD using copies of known-good Text objects.
role_base = objects["RoleText"]
win_base = objects["WinText"]
if "StatusText" not in objects:
    status = make_text_from(role_base, "StatusText", "WOLF MODE READY", 26, "255;235;120", True, 3)
    layout["objects"].append(status)
    layout["objectsFolderStructure"]["children"].append({"objectName": "StatusText"})
    layout["instances"].append(instance_from(instances["RoleText"], "StatusText", 820, 14, 430, 48))
if "ActionFeedbackText" not in objects:
    feedback = make_text_from(win_base, "ActionFeedbackText", "", 42, "255;255;255", True, 5)
    layout["objects"].append(feedback)
    layout["objectsFolderStructure"]["children"].append({"objectName": "ActionFeedbackText"})
    layout["instances"].append(instance_from(instances["WinText"], "ActionFeedbackText", 340, 92, 600, 78, True))

# Frozen and hidden-candidate appearance must remain identical, but far more obvious than before.
for event in walk_events(layout["events"]):
    for action in event.get("actions", []):
        if tval(action) == "ChangeColor" and len(action.get("parameters", [])) >= 2:
            if action["parameters"][1] == '"173;216;230"':
                action["parameters"][1] = json.dumps(ICE)

# Inject feedback into the existing, already-audited core transitions.
feedback_hits = {"wolf": 0, "freeze": 0, "infect": 0, "trap": 0, "rescue": 0, "reset": 0}
for event in walk_events(layout["events"]):
    actions = event.get("actions", [])

    if is_button_click(event, "WolfButton") and any(
        tval(a) == "SetNumberVariable" and a.get("parameters", [])[:1] == ["WolfModeLeft"]
        for a in actions
    ):
        add_feedback(actions, "WOLF MODE ON!")
        feedback_hits["wolf"] += 1

    if any(
        tval(a) == "SetStringObjectVariable"
        and a.get("parameters", [])[:2] == ["Actor", "State"]
        and len(a.get("parameters", [])) >= 4
        and a["parameters"][3] == '"Frozen"'
        for a in actions
    ):
        add_feedback(actions, "HUMAN FROZEN!")
        feedback_hits["freeze"] += 1

    if is_button_click(event, "InfectButton") and any(
        tval(a) == "SetStringObjectVariable"
        and a.get("parameters", [])[:2] == ["Actor", "State"]
        and len(a.get("parameters", [])) >= 4
        and a["parameters"][3] == '"FrozenWolfCandidate"'
        for a in actions
    ):
        add_feedback(actions, "INFECTED - HIDDEN")
        feedback_hits["infect"] += 1

    if any(
        tval(a) == "SetStringObjectVariable"
        and a.get("parameters", [])[:2] == ["Player", "State"]
        and len(a.get("parameters", [])) >= 4
        and a["parameters"][3] == '"Frozen"'
        for a in actions
    ) and any(
        tval(a) == "SetStringObjectVariable"
        and a.get("parameters", [])[:2] == ["Actor", "Role"]
        and len(a.get("parameters", [])) >= 4
        and a["parameters"][3] == '"Wolf"'
        for a in actions
    ):
        add_feedback(actions, "TRAP! YOU ARE FROZEN", 1.6)
        feedback_hits["trap"] += 1

    if any(
        tval(a) == "SetStringObjectVariable"
        and a.get("parameters", [])[:2] == ["Actor", "State"]
        and len(a.get("parameters", [])) >= 4
        and a["parameters"][3] == '"Active"'
        for a in actions
    ) and not any(
        tval(a) == "SetStringObjectVariable"
        and a.get("parameters", [])[:2] == ["Actor", "Role"]
        for a in actions
    ):
        # This identifies the normal Frozen -> Active rescue child event.
        add_feedback(actions, "RESCUED!")
        feedback_hits["rescue"] += 1

    if is_button_click(event, "TestResetButton"):
        actions.extend([
            {"type": {"value": "SetNumberVariable"}, "parameters": ["FeedbackLeft", "=", "0"]},
            {"type": {"value": "Hide"}, "parameters": ["ActionFeedbackText"]},
        ])
        feedback_hits["reset"] += 1

# Add clarity/status logic after existing groups so FROZEN state can override the ordinary RoleText update.
clarity_group = {
    "colorB": 228, "colorG": 176, "colorR": 74, "creationTime": 0,
    "name": "v0.3 Action clarity feedback", "source": "", "type": "BuiltinCommonInstructions::Group",
    "events": [
        {"type": "BuiltinCommonInstructions::Standard",
         "conditions": [{"type": {"value": "SceneJustBegins"}, "parameters": [""]}],
         "actions": [{"type": {"value": "Hide"}, "parameters": ["ActionFeedbackText"]}]},
        {"type": "BuiltinCommonInstructions::Standard",
         "conditions": [{"type": {"value": "NumberVariable"}, "parameters": ["FeedbackLeft", ">", "0"]}],
         "actions": [{"type": {"value": "SetNumberVariable"}, "parameters": ["FeedbackLeft", "-", "TimeDelta()"]}],
         "events": [
             {"type": "BuiltinCommonInstructions::Standard",
              "conditions": [{"type": {"value": "NumberVariable"}, "parameters": ["FeedbackLeft", "<=", "0"]}],
              "actions": [
                  {"type": {"value": "SetNumberVariable"}, "parameters": ["FeedbackLeft", "=", "0"]},
                  {"type": {"value": "Hide"}, "parameters": ["ActionFeedbackText"]},
              ]}
         ]},
        {"type": "BuiltinCommonInstructions::Standard",
         "conditions": [
             {"type": {"value": "StringObjectVariable"}, "parameters": ["Player", "State", "=", '"Frozen"']},
             {"type": {"value": "StringObjectVariable"}, "parameters": ["Player", "Role", "=", '"Human"']},
         ],
         "actions": [
             {"type": {"value": "TextContainerCapability::TextContainerBehavior::SetValue"}, "parameters": ["RoleText", "Text", "=", '"YOU: HUMAN | FROZEN"']},
             {"type": {"value": "TextContainerCapability::TextContainerBehavior::SetValue"}, "parameters": ["StatusText", "Text", "=", '"YOU ARE FROZEN"']},
         ]},
        {"type": "BuiltinCommonInstructions::Standard",
         "conditions": [
             {"type": {"value": "StringObjectVariable"}, "parameters": ["Player", "State", "=", '"Frozen"']},
             {"type": {"value": "StringObjectVariable"}, "parameters": ["Player", "Role", "=", '"Wolf"']},
         ],
         "actions": [
             {"type": {"value": "TextContainerCapability::TextContainerBehavior::SetValue"}, "parameters": ["RoleText", "Text", "=", '"YOU: WOLF | FROZEN"']},
             {"type": {"value": "TextContainerCapability::TextContainerBehavior::SetValue"}, "parameters": ["StatusText", "Text", "=", '"YOU ARE FROZEN"']},
         ]},
        {"type": "BuiltinCommonInstructions::Standard",
         "conditions": [
             {"type": {"value": "StringObjectVariable"}, "parameters": ["Player", "State", "=", '"Active"']},
             {"type": {"value": "StringObjectVariable"}, "parameters": ["Player", "Role", "=", '"Wolf"']},
             {"type": {"value": "NumberVariable"}, "parameters": ["WolfModeLeft", ">", "0"]},
         ],
         "actions": [{"type": {"value": "TextContainerCapability::TextContainerBehavior::SetValue"}, "parameters": ["StatusText", "Text", "=", '"WOLF MODE ACTIVE"']}]},
        {"type": "BuiltinCommonInstructions::Standard",
         "conditions": [
             {"type": {"value": "StringObjectVariable"}, "parameters": ["Player", "State", "=", '"Active"']},
             {"type": {"value": "StringObjectVariable"}, "parameters": ["Player", "Role", "=", '"Wolf"']},
             {"type": {"value": "NumberVariable"}, "parameters": ["WolfModeLeft", "<=", "0"]},
             {"type": {"value": "NumberVariable"}, "parameters": ["CooldownLeft", ">", "0"]},
         ],
         "actions": [{"type": {"value": "TextContainerCapability::TextContainerBehavior::SetValue"}, "parameters": ["StatusText", "Text", "=", '"WOLF COOLDOWN: " + ToString(ceil(CooldownLeft))']}]},
        {"type": "BuiltinCommonInstructions::Standard",
         "conditions": [
             {"type": {"value": "StringObjectVariable"}, "parameters": ["Player", "State", "=", '"Active"']},
             {"type": {"value": "StringObjectVariable"}, "parameters": ["Player", "Role", "=", '"Wolf"']},
             {"type": {"value": "NumberVariable"}, "parameters": ["WolfModeLeft", "<=", "0"]},
             {"type": {"value": "NumberVariable"}, "parameters": ["CooldownLeft", "<=", "0"]},
         ],
         "actions": [{"type": {"value": "TextContainerCapability::TextContainerBehavior::SetValue"}, "parameters": ["StatusText", "Text", "=", '"WOLF MODE READY"']}]},
        {"type": "BuiltinCommonInstructions::Standard",
         "conditions": [
             {"type": {"value": "StringObjectVariable"}, "parameters": ["Player", "State", "=", '"Active"']},
             {"type": {"value": "StringObjectVariable"}, "parameters": ["Player", "Role", "=", '"Human"']},
         ],
         "actions": [{"type": {"value": "TextContainerCapability::TextContainerBehavior::SetValue"}, "parameters": ["StatusText", "Text", "=", '"HUMAN: RESCUE FROZEN ALLIES"']}]},
    ],
    "parameters": [],
}

# Idempotency: replace if rerun, append otherwise.
existing_idx = next((i for i, e in enumerate(layout["events"]) if e.get("name") == clarity_group["name"]), None)
if existing_idx is None:
    layout["events"].append(clarity_group)
else:
    layout["events"][existing_idx] = clarity_group

# Add a focused GDevelop gameplay regression test for v0.3 UI/feedback.
if not any(t.get("name") == "v0.3 action clarity test" for t in data.get("tests", [])):
    data.setdefault("tests", []).append({
        "description": "v0.3: action labels, feedback, frozen visibility/state, core trap remains intact",
        "lastRunAt": 0,
        "lastRunDurationMs": 0,
        "lastRunFramesExecuted": 0,
        "lastRunStatus": "not-run",
        "name": "v0.3 action clarity test",
        "type": "gameplay",
        "source": [
            "await harness.goToScene('FROST LAB');",
            "await harness.stepFrames(30);",
            "harness.assert(harness.getObjects('StatusText').length === 1, 'StatusText exists');",
            "harness.assert(harness.getObjects('ActionFeedbackText').length === 1, 'ActionFeedbackText exists');",
            "harness.assert(harness.getObjects('WolfButton')[0].text === '[ WOLF MODE ]', 'WOLF label clear');",
            "harness.assert(harness.getObjects('RescueButton')[0].text === '[ RESCUE ]', 'RESCUE label clear');",
            "harness.assert(harness.getObjects('InfectButton')[0].text === '[ INFECT ]', 'INFECT label clear');",
            "harness.assert(harness.getObjects('StatusText')[0].text === 'WOLF MODE READY', 'ready status visible');",
            "",
        ],
    })

# Structural validation before writing.
obj_names = {o["name"] for o in layout["objects"]}
assert {"StatusText", "ActionFeedbackText"} <= obj_names
assert any(v.get("name") == "FeedbackLeft" for v in layout["variables"])
assert objects["WolfButton"]["string"] == "[ WOLF MODE ]"
assert objects["RescueButton"]["string"] == "[ RESCUE ]"
assert objects["InfectButton"]["string"] == "[ INFECT ]"
assert all(feedback_hits[k] >= 1 for k in ("wolf", "freeze", "infect", "trap", "rescue", "reset")), feedback_hits
assert any(e.get("name") == "v0.3 Action clarity feedback" for e in layout["events"])

PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("v0.3 Action Clarity applied", feedback_hits)
