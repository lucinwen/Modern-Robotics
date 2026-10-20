"""Run actual Pyperplan PDDL searches and the exact upstream MiniLab checker.

The models are synthetic teaching examples. No robot, simulator, trajectory
planner, inverse-kinematics solver or perception system is run by this file.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.metadata
import io
import json
import logging
import platform
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

import upstream_validate

HERE = Path(__file__).resolve().parent
PLAN_REVISION = "de6fd9cb352370863e94d64d775c4f5236ed38fc"
UPSTREAM_BLOB_SHA = "4cbe22b923d770147e931f610fc00e0d79df96a0"
SYMBOLIC_SCOPE = (
    "finite_fully_observed_deterministic_typed_strips_domain_only_"
    "no_continuous_motion_or_physical_execution"
)

PLANNING_SPECS = [
    {"id": "success", "file": "problem-success.pddl", "title": "钥匙与四种能力齐全",
     "changes": ["标准初态：门锁着，机器人在 A，杯子在 B。"],
     "expected_status": "plan_found", "expected_length": 4, "door_width_m": 0.9},
    {"id": "missing_key", "file": "problem-missing-key.pddl", "title": "缺少钥匙",
     "changes": ["仅删除初态中的 (has-key r k)，没有拾钥匙或替代开锁动作。"],
     "expected_status": "no_plan", "door_width_m": 0.9},
    {"id": "missing_unlock", "file": "problem-missing-unlock.pddl", "title": "有钥匙但缺少开锁能力",
     "changes": ["仅删除 (can-unlock r)，其余初态保持标准条件。"],
     "expected_status": "no_plan", "door_width_m": 0.9},
    {"id": "missing_open", "file": "problem-missing-open.pddl", "title": "能解锁，但缺少开门能力",
     "changes": ["仅删除 (can-open r)；解锁不会自动把 opened 变真。"],
     "expected_status": "no_plan", "door_width_m": 0.9},
    {"id": "no_grasp", "file": "problem-no-grasp.pddl", "title": "缺少抓取能力",
     "changes": ["仅删除 (can-pickup r)，物体仍声明为 graspable。"],
     "expected_status": "no_plan", "door_width_m": 0.9},
    {"id": "ungraspable", "file": "problem-ungraspable.pddl", "title": "物体未被声明为可抓取",
     "changes": ["仅删除 (graspable cup)，机器人仍有 can-pickup。"],
     "expected_status": "no_plan", "door_width_m": 0.9},
    {"id": "already_open", "file": "problem-already-open.pddl", "title": "初态中门已经打开",
     "changes": ["删除 locked，加入 unlocked 与 opened；无需重复解锁或开门。"],
     "expected_status": "plan_found", "expected_length": 2, "door_width_m": 0.9},
    {"id": "narrow_door", "file": "problem-narrow-door.pddl", "title": "符号计划存在，但门宽不足",
     "changes": ["PDDL 初态与标准例相同；独立门宽输入改为 0.50 m。"],
     "expected_status": "plan_found", "expected_length": 4, "door_width_m": 0.5},
    {"id": "goal_already_met", "file": "problem-goal-already-met.pddl", "title": "初态已经拿着杯子",
     "changes": ["加入 holding；删除 item-at 与 handempty，保持物体状态一致。"],
     "expected_status": "plan_found", "expected_length": 0, "door_width_m": 0.9},
]


def blob_sha(path: Path) -> str:
    raw = path.read_bytes()
    return hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()


def instantiate(predicate, assignment):
    args = [assignment.get(name, name) for name, _ in predicate.signature]
    return "(" + " ".join([predicate.name, *args]) + ")"


def state_invariants(facts):
    """Invariants of the supplied r/a/b/d/cup model, not all possible PDDL."""
    facts = set(facts)
    positions = [f for f in facts if f.startswith("(at r ")]
    cup_locations = [f for f in facts if f.startswith("(item-at cup ")]
    held = "(holding r cup)" in facts
    return {
        "one_robot_room": len(positions) == 1,
        "exactly_one_lock_status": ("(locked d)" in facts) != ("(unlocked d)" in facts),
        "opened_implies_unlocked": "(opened d)" not in facts or "(unlocked d)" in facts,
        "cup_has_one_location_or_is_held": (held and not cup_locations) or (
            not held and len(cup_locations) == 1),
        "hand_matches_cup_state": ("(handempty r)" in facts) != held,
    }


def run_planning_case(spec, check_expected=True):
    try:
        from pyperplan.pddl.parser import Parser
        from pyperplan.grounding import ground
        from pyperplan.search.breadth_first_search import breadth_first_search
    except ImportError as exc:
        raise SystemExit(
            "请先安装：python -m pip install -r examples/day-03/requirements.txt\n"
            "只运行原规则检查器可加 --only-minilab。"
        ) from exc

    domain_path = HERE / "pddl/domain.pddl"
    problem_path = Path(spec["path"]) if "path" in spec else HERE / "pddl" / spec["file"]
    start = perf_counter()
    parser = Parser(str(domain_path), str(problem_path))
    domain = parser.parse_domain()
    problem = parser.parse_problem(domain)
    task = ground(problem, remove_statics_from_initial_state=False,
                  remove_irrelevant_operators=False)
    parse_ground_ms = (perf_counter() - start) * 1000

    # Preserve the official BFS log to distinguish a fully exhausted finite
    # search from a timeout/aborted process. No timeout is imposed on these tiny tasks.
    output = io.StringIO()
    handler = logging.StreamHandler(output)
    logger = logging.getLogger()
    previous_level = logger.level
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    start = perf_counter()
    try:
        solution = breadth_first_search(task)
        elapsed_ms = (perf_counter() - start) * 1000
    finally:
        logger.removeHandler(handler)
        logger.setLevel(previous_level)
    log_lines = output.getvalue().strip().splitlines()
    status = "no_plan" if solution is None else "plan_found"
    expanded = next((int(match.group(1)) for line in log_lines
                     if (match := re.search(r"(\d+) Nodes expanded", line))), None)

    current = frozenset(task.initial_state)
    states = [sorted(current)]
    plan, trace = [], []
    for index, operator in enumerate(solution or [], 1):
        tokens = operator.name.strip("()").split()
        name, args = tokens[0], tokens[1:]
        original = domain.actions[name]
        assignment = dict(zip([p[0] for p in original.signature], args))
        pre = sorted(instantiate(p, assignment) for p in original.precondition)
        add = sorted(instantiate(p, assignment) for p in original.effect.addlist)
        delete = sorted(instantiate(p, assignment) for p in original.effect.dellist)
        assert set(pre) <= current, (operator.name, "source precondition violation")
        assert operator.applicable(current)
        expected_next = (current - set(delete)) | set(add)
        actual_next = operator.apply(current)
        assert actual_next == expected_next, (operator.name, "source effect mismatch")
        plan.append({
            "raw": operator.name, "name": name, "args": args,
            "pre": pre, "add": add, "del": delete,
            "grounded_preconditions": sorted(operator.preconditions),
        })
        trace.append({"step": index, "action": operator.name,
                      "removed": sorted(current - actual_next),
                      "added": sorted(actual_next - current)})
        current = actual_next
        states.append(sorted(current))
    if solution is not None:
        assert task.goal_reached(current)
    else:
        assert any("No operators left" in line for line in log_lines), log_lines

    checks = [state_invariants(state) for state in states]
    if check_expected:
        assert all(all(item.values()) for item in checks)
        assert status == spec["expected_status"], (spec["id"], status)
        if "expected_length" in spec:
            assert len(plan) == spec["expected_length"], (spec["id"], plan)

    geometry = {
        "checked": False, "passes": None, "method": "declared_door_width_only",
        "input": {"door_width_m": spec.get("door_width_m"),
                  "robot_width_m": 0.6 if "door_width_m" in spec else None,
                  "extra_margin_m": 0.0 if "door_width_m" in spec else None},
        "reason": "没有找到候选计划，未进入计划的后验门宽检查。",
        "scope": "仅比较声明的净宽与身体宽度；无路径、碰撞、门扇或真实执行验证。",
    }
    if (solution is not None and any(step["name"] == "move" for step in plan)
            and "door_width_m" not in spec):
        geometry["reason"] = "自定义 PDDL 没有提供独立尺寸输入；未进行过门宽度检查。"
    elif solution is not None and any(step["name"] == "move" for step in plan):
        geometry["checked"] = True
        geometry["passes"] = geometry["input"]["door_width_m"] >= geometry["input"]["robot_width_m"]
        geometry["reason"] = ("本例门宽数值条件成立。" if geometry["passes"] else
                              "门宽 0.50 m 小于机器人宽 0.60 m；当前声明尺寸拒绝这条过门候选。")
    elif solution is not None:
        geometry["reason"] = "本次计划不含 move，未进行过门宽度检查。"
    if check_expected and spec["id"] == "narrow_door":
        assert status == "plan_found" and geometry["passes"] is False

    return {
        "id": spec["id"], "title": spec["title"], "changes": spec["changes"],
        "problem_file": str(spec["path"]) if "path" in spec else "pddl/" + problem_path.name,
        "source_files": {"domain_git_blob_sha": blob_sha(domain_path),
                         "problem_git_blob_sha": blob_sha(problem_path)},
        "expected_status": spec.get("expected_status"),
        "status": status, "plan_length": None if solution is None else len(plan),
        "initial_facts": states[0], "goal": sorted(task.goals),
        "plan": plan, "states": states, "trace": trace,
        "plan_validated_against_source_actions": solution is not None,
        "state_invariant_checks": checks,
        "search_exhausted": solution is None,
        "expanded_states": expanded, "grounded_operator_count": len(task.operators),
        "elapsed_ms": round(elapsed_ms, 6),
        "parse_ground_ms": round(parse_ground_ms, 6), "search_log": log_lines,
        "geometry_check": geometry, "execution_status": "not_run",
        "scope": SYMBOLIC_SCOPE,
    }


def minilab_specs():
    base = upstream_validate.example_world()
    locked = copy.deepcopy(base)
    locked["doors"][0].update({"locked": True, "key": "K"})
    only_key = copy.deepcopy(locked)
    only_key["robot"]["keys"] = ["K"]
    only_skill = copy.deepcopy(locked)
    only_skill["robot"]["capabilities"].append("unlock")
    ready = copy.deepcopy(only_key)
    ready["robot"]["capabilities"].append("unlock")
    no_grasp = copy.deepcopy(base)
    no_grasp["robot"]["capabilities"].remove("grasp")
    ungraspable = copy.deepcopy(base)
    ungraspable["objects"][0]["graspable"] = False
    narrow = copy.deepcopy(base)
    narrow["doors"][0]["width_m"] = 0.5
    combined = copy.deepcopy(locked)
    combined["doors"][0]["width_m"] = 0.5
    return [
        ("baseline", "未锁门的基线", base, "rule_feasible",
         ["原 checker 基线：0.90 m 门，0.60 m 机器人，move 与 grasp。"]),
        ("locked_missing_key_and_skill", "锁门，无钥匙与开锁能力", locked, "blocked_state",
         ["locked=true，并声明该门使用钥匙 K。"]),
        ("key_without_unlock_skill", "有钥匙，但没有开锁能力", only_key, "blocked_state",
         ["在锁门例中，仅把 K 放入 robot.keys。"]),
        ("unlock_skill_without_key", "有开锁能力，但没有钥匙", only_skill, "blocked_state",
         ["在锁门例中，仅加入 unlock 能力。"]),
        ("key_and_unlock_skill", "钥匙和开锁能力齐全", ready, "rule_feasible",
         ["在仅有钥匙的例子中，再加入 unlock 能力。"]),
        ("no_grasp", "机器人缺少 grasp 能力", no_grasp, "blocked_action",
         ["从未锁门基线中，仅移除 grasp。"]),
        ("ungraspable_object", "目标物体不可抓取", ungraspable, "blocked_action",
         ["从未锁门基线中，仅把 graspable 改为 false。"]),
        ("narrow_door", "门净宽不足", narrow, "blocked_geometry",
         ["从未锁门基线中，仅把门宽改为 0.50 m。"]),
        ("narrow_and_locked", "窄门，同时缺钥匙与开锁能力", combined, "blocked_geometry",
         ["在锁门例中，再把门宽改为 0.50 m。"]),
    ]


def run_minilab_case(case_id, title, world, expected_status, changes):
    before = copy.deepcopy(world)
    start = perf_counter()
    result = upstream_validate.analyze(world)
    elapsed = (perf_counter() - start) * 1000
    if expected_status is not None:
        assert result["status"] == expected_status, (case_id, result)
    assert world == before
    notes = [
        "原函数只检查当前声明规则，不输出或执行 unlock/open/move/pickup 序列。",
        "即使规则可行，输入里的 locked 字段也没有被该函数修改。",
    ]
    if result["status"] == "blocked_state":
        notes.append(
            "原 reason 的 'narrow doors:' 前缀不一定表示门窄；应按输入和 status 解释。"
            if case_id == "custom_world" else
            "原 reason 含多余的 'narrow doors:' 前缀；本例门并不窄，保留原文而按输入及 status 解读。")
    if case_id == "narrow_and_locked":
        notes.append("原程序对窄门先 continue，故此条返回没有列出锁问题；修好宽度后仍需重新检查锁条件。")
    return {
        "id": case_id, "title": title, "changes": changes, "input": before,
        "expected_status": expected_status, "status": result["status"],
        "reason": result["reason"], "elapsed_ms": round(elapsed, 6),
        "raw_result": result, "input_unchanged": world == before,
        "notes": notes, "execution_status": "not_run", "scope": result["scope"],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="my-day-03-results.json",
                        help="新运行记录输出位置；不默认覆盖教程制作记录。")
    selected = parser.add_mutually_exclusive_group()
    selected.add_argument("--only-minilab", action="store_true",
                          help="只运行九例原规则检查，不需要安装 pyperplan。")
    selected.add_argument("--world", type=Path, help="用原 checker 检查一个自定义 JSON world。")
    selected.add_argument("--problem", type=Path,
                          help="用本目录 domain.pddl 求解一个自己的 problem 文件。")
    args = parser.parse_args()
    assert blob_sha(HERE / "upstream_validate.py") == UPSTREAM_BLOB_SHA, (
        "上游 checker 已变更；请明确记录变更来源后再生成对照数据。")
    try:
        package_version = importlib.metadata.version("pyperplan")
    except importlib.metadata.PackageNotFoundError:
        package_version = None
    result = {
        "schema_version": 1,
        "environment": {"python": platform.python_version(), "pyperplan": package_version,
                        "platform": platform.platform(),
                        "generated_at_utc": datetime.now(timezone.utc).isoformat()},
        "provenance": {
            "plan_repository": "venividici/14plan", "plan_revision": PLAN_REVISION,
            "upstream_validate_blob": UPSTREAM_BLOB_SHA,
            "upstream_file": "minilab/validate.py",
            "pyperplan_source": "https://github.com/aibasel/pyperplan",
            "scope": "教程制作环境中的真实程序运行；合成输入；没有用户本机或物理机器人运行。",
            "search": "pyperplan.search.breadth_first_search",
            "grounding_options": {"remove_statics_from_initial_state": False,
                                  "remove_irrelevant_operators": False},
            "elapsed_ms_definition": "planning: BFS call only; minilab: analyze call only",
        },
        "planning_cases": [], "minilab_cases": [],
    }
    if args.world:
        world = json.loads(args.world.read_text(encoding="utf-8"))
        result["minilab_cases"] = [run_minilab_case(
            "custom_world", "我的自定义规则输入", world, None, [str(args.world)])]
    elif args.problem:
        result["planning_cases"] = [run_planning_case({
            "id": "custom_problem", "title": "我的自定义 PDDL problem",
            "path": args.problem, "changes": [str(args.problem)],
        }, check_expected=False)]
    else:
        if not args.only_minilab:
            result["planning_cases"] = [run_planning_case(spec) for spec in PLANNING_SPECS]
        result["minilab_cases"] = [run_minilab_case(*spec) for spec in minilab_specs()]
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output),
                      "planning": [{"id": c["id"], "status": c["status"],
                                    "plan_length": c["plan_length"]} for c in result["planning_cases"]],
                      "minilab": [{"id": c["id"], "status": c["status"]} for c in result["minilab_cases"]]},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
