#!/usr/bin/env python3
import json
import pathlib
import re
import subprocess
import tempfile

BASE_SHA = "84bbfe11f8f345addf3762cc277429b560cc4194"
CURRENT_MAIN_SHA = "cfd2aae6a48e8ad3d33e176e49ff2ede25dbaefb"
PR8_SHA = "638bc703df12c40e9e24c39cab703972dca3aacb"
PROJECT = pathlib.Path("game.json")


def load_commit(sha: str):
    raw = subprocess.check_output(["git", "show", f"{sha}:game.json"], text=True)
    return json.loads(raw)


def inline_text(value):
    if not isinstance(value, list) or not value or not all(isinstance(x, str) for x in value):
        return None
    if len(value) == 1:
        return value[0]
    if all(x.endswith("\n") for x in value[:-1]):
        return "".join(value)
    return "\n".join(value)


def walk(node, path=()):
    if isinstance(node, dict):
        yield node, path
        for key, value in node.items():
            yield from walk(value, path + (key,))
    elif isinstance(node, list):
        for idx, value in enumerate(node):
            yield from walk(value, path + (idx,))


def find_cpu_ai(data, label: str):
    found = []
    for node, path in walk(data):
        source = inline_text(node.get("inlineCode")) if isinstance(node, dict) else None
        if source and "const humanActors" in source and "FrozenWolfCandidate" in source and "aiWolfDetourDuration" in source:
            found.append((node, source, path))
    if len(found) != 1:
        raise AssertionError(f"{label}: expected exactly one CPU AI inlineCode block, got {len(found)}")
    return found[0]


def replace_exact_string(node, old: str, new: str):
    count = 0
    if isinstance(node, dict):
        for key, value in list(node.items()):
            if isinstance(value, str) and value == old:
                node[key] = new
                count += 1
            else:
                count += replace_exact_string(value, old, new)
    elif isinstance(node, list):
        for idx, value in enumerate(list(node)):
            if isinstance(value, str) and value == old:
                node[idx] = new
                count += 1
            else:
                count += replace_exact_string(value, old, new)
    return count


def main():
    current = json.loads(PROJECT.read_text(encoding="utf-8"))
    base = load_commit(BASE_SHA)
    pr8 = load_commit(PR8_SHA)

    gd = current["gdVersion"]
    assert (gd["major"], gd["minor"], gd["build"]) == (5, 6, 282), gd

    current_node, current_src, current_path = find_cpu_ai(current, "current main")
    _, base_src, _ = find_cpu_ai(base, "v0.5.4 base")
    _, pr8_src, _ = find_cpu_ai(pr8, "PR #8")

    with tempfile.TemporaryDirectory() as td:
        td = pathlib.Path(td)
        ours = td / "current.js"
        common = td / "base.js"
        theirs = td / "pr8.js"
        ours.write_text(current_src, encoding="utf-8")
        common.write_text(base_src, encoding="utf-8")
        theirs.write_text(pr8_src, encoding="utf-8")
        proc = subprocess.run(
            ["git", "merge-file", "-p", str(ours), str(common), str(theirs)],
            text=True,
            capture_output=True,
        )
        if proc.returncode != 0:
            print(proc.stderr)
            print(proc.stdout[:12000])
            raise SystemExit(f"semantic three-way AI transplant conflicted (git merge-file exit {proc.returncode})")
        merged = proc.stdout

    if "<<<<<<<" in merged or ">>>>>>>" in merged or "=======" in merged:
        raise AssertionError("merge conflict marker survived")

    base_human_tokens = set(re.findall(r"__iceWolfAIHuman[A-Za-z0-9_]*", base_src))
    pr8_human_tokens = set(re.findall(r"__iceWolfAIHuman[A-Za-z0-9_]*", pr8_src))
    recovery_tokens = sorted(pr8_human_tokens - base_human_tokens)
    if not recovery_tokens:
        raise AssertionError("PR #8 did not expose any Human navigation recovery runtime markers")
    missing_recovery = [token for token in recovery_tokens if token not in merged]
    if missing_recovery:
        raise AssertionError(f"missing transplanted Human recovery markers: {missing_recovery}")

    protected_markers = [
        "activeHumanTargets",
        "CpuWolfDiagPhase",
        "AIWolfModeLeft",
        "AIWolfCooldownLeft",
    ]
    for marker in protected_markers:
        if marker not in current_src:
            raise AssertionError(f"current PR #10 AI unexpectedly lacks protected marker: {marker}")
        if marker not in merged:
            raise AssertionError(f"transplant lost protected PR #10 marker: {marker}")

    current_node["inlineCode"] = [merged]

    label_count = replace_exact_string(current, "開発版 v0.6.0-DIAG", "開発版 v0.6.1-DIAG")
    if label_count < 1:
        raise AssertionError("v0.6.0-DIAG BuildText label not found")

    group_count = replace_exact_string(
        current,
        "v0.5.2 CPU5 Rescue AI + Repeat Wolf Cycle",
        "v0.6.1 Human CPU Navigation Recovery + CPU Wolf Cycle",
    )
    if group_count != 1:
        raise AssertionError(f"expected one stale AI group name, got {group_count}")

    PROJECT.write_text(json.dumps(current, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    pathlib.Path("/tmp/v061-merged-ai.js").write_text(merged, encoding="utf-8")

    roundtrip = json.loads(PROJECT.read_text(encoding="utf-8"))
    rt_node, rt_src, _ = find_cpu_ai(roundtrip, "patched v0.6.1")
    assert rt_src == merged
    assert "開発版 v0.6.1-DIAG" in PROJECT.read_text(encoding="utf-8")
    assert "v0.6.1 Human CPU Navigation Recovery + CPU Wolf Cycle" in PROJECT.read_text(encoding="utf-8")

    print("v0.6.1 semantic transplant PASS")
    print(f"CPU AI path: {current_path}")
    print(f"Build label replacements: {label_count}")
    print(f"Recovered Human navigation markers: {', '.join(recovery_tokens)}")
    print("Protected PR #10 markers preserved: " + ", ".join(protected_markers))


if __name__ == "__main__":
    main()
