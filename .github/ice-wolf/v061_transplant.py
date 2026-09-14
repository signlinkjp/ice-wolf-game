#!/usr/bin/env python3
import json
import pathlib

PROJECT = pathlib.Path("game.json")
OLD_GROUP = "v0.5.2 CPU5 Rescue AI + Repeat Wolf Cycle"
NEW_GROUP = "v0.6.1 Human CPU Navigation Recovery + CPU Wolf Cycle"
OLD_LABEL = "開発版 v0.6.0-DIAG"
NEW_LABEL = "開発版 v0.6.1-DIAG"
TEST_NAME = "v0.6.1 Human CPU navigation recovery test"


def exactly_one(items, label):
    if len(items) != 1:
        raise AssertionError(f"{label}: expected exactly one match, got {len(items)}")
    return items[0]


def insert_after(lines, anchor, additions):
    positions = [i for i, line in enumerate(lines) if line == anchor]
    idx = exactly_one(positions, f"anchor {anchor!r}")
    lines[idx + 1:idx + 1] = additions


def insert_before(lines, anchor, additions):
    positions = [i for i, line in enumerate(lines) if line == anchor]
    idx = exactly_one(positions, f"anchor {anchor!r}")
    lines[idx:idx] = additions


def main():
    data = json.loads(PROJECT.read_text(encoding="utf-8"))
    gd = data["gdVersion"]
    assert (gd["major"], gd["minor"], gd["build"]) == (5, 6, 282), gd

    frost = exactly_one([x for x in data["layouts"] if x.get("name") == "FROST LAB"], "FROST LAB")
    group = exactly_one([x for x in frost["events"] if x.get("name") == OLD_GROUP], OLD_GROUP)
    js_events = [
        x for x in group.get("events", [])
        if x.get("type") == "BuiltinCommonInstructions::JsCode"
        and isinstance(x.get("inlineCode"), list)
        and "const dt = gdjs.evtTools.runtimeScene.getElapsedTimeInSeconds(runtimeScene);" in x["inlineCode"]
        and any("activeHumanTargets" in line for line in x["inlineCode"])
    ]
    ai_event = exactly_one(js_events, "current CPU/Human AI JsCode")
    lines = ai_event["inlineCode"]

    protected = [
        "activeHumanTargets",
        "CpuWolfDiagPhase",
        "AIWolfModeLeft",
        "AIWolfCooldownLeft",
        "__iceWolfAIWolfBlockedFor",
        "__iceWolfAIWolfDetourLeft",
    ]
    current_source = "\n".join(lines)
    for marker in protected:
        if marker not in current_source:
            raise AssertionError(f"current PR #10 AI unexpectedly lacks protected marker: {marker}")
    if "__iceWolfAIHumanBlockedFor" in current_source:
        raise AssertionError("Human navigation recovery already present; refusing duplicate patch")

    insert_after(lines, "    const aiWolfDetourDuration = 0.75;", [
        "    const humanBlockedRatio = 0.28;",
        "    const humanBlockedTrigger = 0.16;",
        "    const humanDetourDuration = 1.5;",
    ])

    insert_after(lines, "      const ay = actor.getCenterYInScene();", [
        "      const humanPrevActualX = actor.__iceWolfAIHumanPrevActualX;",
        "      const humanPrevActualY = actor.__iceWolfAIHumanPrevActualY;",
        "      const humanLastExpectedMove = Number.isFinite(actor.__iceWolfAIHumanLastExpectedMove) ? actor.__iceWolfAIHumanLastExpectedMove : 0;",
        "      const humanHadPreviousActual = Number.isFinite(humanPrevActualX) && Number.isFinite(humanPrevActualY);",
        "      if (humanHadPreviousActual && humanLastExpectedMove > 0.4) {",
        "        const humanActualMove = Math.hypot(ax - humanPrevActualX, ay - humanPrevActualY);",
        "        const humanBlocked = humanActualMove < Math.max(0.35, humanLastExpectedMove * humanBlockedRatio);",
        "        const humanBlockedFor = Number.isFinite(actor.__iceWolfAIHumanBlockedFor) ? actor.__iceWolfAIHumanBlockedFor : 0;",
        "        actor.__iceWolfAIHumanBlockedFor = humanBlocked ? humanBlockedFor + dt : Math.max(0, humanBlockedFor - dt * 2);",
        "      } else {",
        "        actor.__iceWolfAIHumanBlockedFor = 0;",
        "      }",
        "      actor.__iceWolfAIHumanPrevActualX = ax;",
        "      actor.__iceWolfAIHumanPrevActualY = ay;",
        "      actor.__iceWolfAIHumanDetourLeft = Math.max(0, (Number.isFinite(actor.__iceWolfAIHumanDetourLeft) ? actor.__iceWolfAIHumanDetourLeft : 0) - dt);",
    ])

    insert_before(lines, "      actor.setX(Math.max(-708, Math.min(692, actor.getX() + vx * speed * dt)));", [
        "      if (actor.__iceWolfAIHumanBlockedFor >= humanBlockedTrigger && actor.__iceWolfAIHumanDetourLeft <= 0) {",
        "        if (Math.abs(vx) >= Math.abs(vy)) {",
        "          actor.__iceWolfAIHumanDetourSign = (ay < 0 ? 1 : -1) * (vx >= 0 ? 1 : -1);",
        "        } else {",
        "          actor.__iceWolfAIHumanDetourSign = (ax >= 0 ? 1 : -1) * (vy >= 0 ? 1 : -1);",
        "        }",
        "        actor.__iceWolfAIHumanDetourLeft = humanDetourDuration;",
        "        actor.__iceWolfAIHumanBlockedFor = 0;",
        "      }",
        "      if (actor.__iceWolfAIHumanDetourLeft > 0) {",
        "        const humanDetourSign = actor.__iceWolfAIHumanDetourSign || 1;",
        "        let humanDetourX = vx * 0.35 + (-vy * humanDetourSign) * 0.95;",
        "        let humanDetourY = vy * 0.35 + (vx * humanDetourSign) * 0.95;",
        "        if (ax < -640) humanDetourX += 0.85;",
        "        else if (ax > 640) humanDetourX -= 0.85;",
        "        if (ay < -640) humanDetourY += 0.85;",
        "        else if (ay > 640) humanDetourY -= 0.85;",
        "        const humanDetourMagnitude = Math.max(Math.hypot(humanDetourX, humanDetourY), 1);",
        "        vx = humanDetourX / humanDetourMagnitude;",
        "        vy = humanDetourY / humanDetourMagnitude;",
        "      }",
        "      actor.__iceWolfAIHumanLastExpectedMove = Math.max(0, speed * dt);",
    ])

    group["name"] = NEW_GROUP

    build = exactly_one([x for x in frost["objects"] if x.get("name") == "BuildText"], "BuildText")
    if build.get("string") != OLD_LABEL or build.get("content", {}).get("text") != OLD_LABEL:
        raise AssertionError("BuildText v0.6.0-DIAG baseline did not match exactly")
    build["string"] = NEW_LABEL
    build["content"]["text"] = NEW_LABEL

    if any(t.get("name") == TEST_NAME for t in data.get("tests", [])):
        raise AssertionError("v0.6.1 navigation test already exists")
    data.setdefault("tests", []).append({
        "description": "Human CPU detects a wall stall, detours toward the central passage, and completes a frozen Player rescue",
        "lastRunAt": 0,
        "lastRunDurationMs": 0,
        "lastRunFramesExecuted": 0,
        "lastRunStatus": "not-run",
        "name": TEST_NAME,
        "type": "gameplay",
        "source": [
            "await harness.goToScene('FROST LAB');",
            "await harness.stepFrames(10);",
            "const players = harness.getObjects('Player');",
            "const actors = harness.getObjects('Actor');",
            "const walls = harness.getObjects('Wall');",
            "harness.assert(players.length === 1, `one Player, got ${players.length}`);",
            "harness.assert(actors.length === 6, `six Actors, got ${actors.length}`);",
            "const player = players[0];",
            "const rescuer = actors[0];",
            "const wall = walls.find(w => w.width <= 40 && w.height >= 150 && w.height <= 170 && w.centerX < 0 && Math.abs(w.centerX) < 300 && w.centerY < 0 && Math.abs(w.centerY) < 300);",
            "harness.assert(!!wall, 'target central vertical wall exists');",
            "harness.setSceneVariable('GameOver', false);",
            "harness.setSceneVariable('CpuWolfDiagPhase', 0);",
            "harness.setObjectVariable(player.id, 'Role', 'Human');",
            "harness.setObjectVariable(player.id, 'State', 'Frozen');",
            "for (const actor of actors) {",
            "  harness.setObjectVariable(actor.id, 'Role', 'Human');",
            "  harness.setObjectVariable(actor.id, 'State', 'Disabled');",
            "}",
            "harness.setObjectVariable(rescuer.id, 'State', 'Active');",
            "const laneY = wall.centerY + wall.height / 2 - 24;",
            "harness.setObjectPosition(rescuer.id, wall.centerX - wall.width / 2 - 48 - rescuer.width / 2, laneY - rescuer.height / 2);",
            "harness.setObjectPosition(player.id, wall.centerX + wall.width / 2 + 48 - player.width / 2, laneY - player.height / 2);",
            "await harness.stepFrames(3);",
            "const startRescuer = harness.getObjects('Actor').find(a => a.id === rescuer.id);",
            "const startY = startRescuer.centerY;",
            "let maxLateral = 0;",
            "for (let i = 0; i < 16 && harness.getObjectVariable('Player', 'State')?.value !== 'Active'; i++) {",
            "  await harness.stepFrames(8);",
            "  const current = harness.getObjects('Actor').find(a => a.id === rescuer.id);",
            "  maxLateral = Math.max(maxLateral, Math.abs(current.centerY - startY));",
            "}",
            "harness.assert(maxLateral > 20, `Human CPU visibly detours around wall: lateral=${maxLateral.toFixed(1)}`);",
            "harness.assert(harness.getObjectVariable('Player', 'State')?.value === 'Active', 'Human CPU completes rescue after wall detour');",
            ""
        ]
    })

    patched_source = "\n".join(lines)
    for marker in protected:
        if marker not in patched_source:
            raise AssertionError(f"patch lost protected PR #10 marker: {marker}")
    for marker in (
        "__iceWolfAIHumanBlockedFor",
        "__iceWolfAIHumanDetourLeft",
        "humanDetourDuration",
    ):
        if marker not in patched_source:
            raise AssertionError(f"patch missing Human recovery marker: {marker}")

    PROJECT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    pathlib.Path("/tmp/v061-merged-ai.js").write_text(patched_source + "\n", encoding="utf-8")

    roundtrip = json.loads(PROJECT.read_text(encoding="utf-8"))
    frost2 = exactly_one([x for x in roundtrip["layouts"] if x.get("name") == "FROST LAB"], "roundtrip FROST LAB")
    exactly_one([x for x in frost2["events"] if x.get("name") == NEW_GROUP], "roundtrip v0.6.1 group")
    build2 = exactly_one([x for x in frost2["objects"] if x.get("name") == "BuildText"], "roundtrip BuildText")
    assert build2["string"] == NEW_LABEL and build2["content"]["text"] == NEW_LABEL
    exactly_one([x for x in roundtrip.get("tests", []) if x.get("name") == TEST_NAME], "roundtrip v0.6.1 test")

    print("v0.6.1 Human CPU navigation recovery patch PASS")
    print("Protected PR #10 markers preserved: " + ", ".join(protected))
    print("Added bounded runtime regression: " + TEST_NAME)


if __name__ == "__main__":
    main()
