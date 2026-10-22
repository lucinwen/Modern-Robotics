"""Run the Day 02 teaching examples with the actual Z3 Python package.

These are synthetic teaching runs, not a record of the learner's own work.
Run from the repository root after installing this folder's requirements.txt.
No network access is used by this script.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import platform
import subprocess
import sys
from datetime import datetime, timezone
from fractions import Fraction
from pathlib import Path
from time import perf_counter

try:
    import z3
except ImportError as exc:
    raise SystemExit(
        "请先运行 python -m pip install -r examples/day-02/requirements.txt"
    ) from exc

PLAN_REVISION = "de6fd9cb352370863e94d64d775c4f5236ed38fc"
UPSTREAM_BLOB_SHA = "2cb1e01141b6d983c2e6e55b28d407c363604e83"


def scalar(value):
    """Keep exact rationals as strings; integer model values remain JSON numbers."""
    if z3.is_int_value(value):
        return value.as_long()
    if z3.is_rational_value(value):
        n, d = value.numerator_as_long(), value.denominator_as_long()
        return n if d == 1 else f"{n}/{d}"
    if z3.is_true(value) or z3.is_false(value):
        return z3.is_true(value)
    return str(value)


def checked_result(solver, variables=(), assumptions=()):
    """The timer covers check(), not Python startup or model formatting."""
    started = perf_counter()
    status = solver.check(*assumptions)
    elapsed = (perf_counter() - started) * 1000
    result = {
        "status": str(status), "elapsed_ms": round(elapsed, 6),
        "model": None, "unsat_core": [], "reason_unknown": None,
    }
    if status == z3.sat:
        model = solver.model()
        result["model"] = {
            str(v): scalar(model.eval(v, model_completion=True)) for v in variables
        }
    elif status == z3.unsat and isinstance(solver, z3.Solver):
        result["unsat_core"] = [str(v) for v in solver.unsat_core()]
    elif status == z3.unknown:
        result["reason_unknown"] = solver.reason_unknown()
    return result


def tracked_result(constraints, variables=()):
    solver = z3.Solver()
    for label, expression in constraints:
        solver.assert_and_track(expression, label)
    result = checked_result(solver, variables)
    result["constraints"] = [
        {"label": label, "formula": str(expression)}
        for label, expression in constraints
    ]
    if result["status"] == "sat":
        model = solver.model()
        assert all(z3.is_true(model.eval(e)) for _, e in constraints)
        result["model_satisfies_formulas"] = True
    elif result["status"] == "unsat":
        selected = set(result["unsat_core"])
        witness = z3.Solver()
        witness.add([e for name, e in constraints if name in selected])
        assert witness.check() == z3.unsat
        result["returned_core_rechecked_unsat"] = True
    return result


def layout_case(case_id, width, height, count, expected, continuous=False):
    make_var = z3.Real if continuous else z3.Int
    variables = [make_var(f"{axis}_{label}")
                 for label in ("a", "b")[:count] for axis in ("x", "y")]
    xa, ya = variables[:2]
    constraints = [("a_inside", z3.And(xa >= 0, ya >= 0,
                    xa + 2 <= width, ya + 2 <= height))]
    if count == 2:
        xb, yb = variables[2:]
        constraints.extend([
            ("b_inside", z3.And(xb >= 0, yb >= 0,
                               xb + 2 <= width, yb + 2 <= height)),
            ("no_overlap", z3.Or(xa + 2 <= xb, xb + 2 <= xa,
                                 ya + 2 <= yb, yb + 2 <= ya)),
        ])
    result = tracked_result(constraints, variables)
    assert result["status"] == expected, (case_id, result)
    result.update({
        "id": case_id,
        "title": f"{count} 间 2×2 房间放入 {width}×{height} 边界",
        "expected_status": expected,
        "input": {"width": width, "height": height, "room_count": count,
                  "room_width": 2, "room_height": 2, "unit": "m",
                  "coordinate_sort": "Real" if continuous else "Int",
                  "rotation_allowed": False, "boundary_touch_allowed": True},
        "variables": [{"name": str(v), "sort": str(v.sort())} for v in variables],
        "scope": "固定尺寸、轴对齐、允许接边的二维盒布局；没有门、机器人或运动约束。",
        "view_geometry": {"container": {"width": width, "height": height},
                          "rooms": [], "required_room_count": count,
                          "required_room_size": {"width": 2, "height": 2}},
    })
    if result["status"] == "sat":
        m = result["model"]
        rooms = [{"label": label.upper(), "x": m[f"x_{label}"],
                  "y": m[f"y_{label}"], "width": 2, "height": 2}
                 for label in ("a", "b")[:count]]
        inside = all(0 <= r["x"] and 0 <= r["y"] and
                     r["x"] + r["width"] <= width and
                     r["y"] + r["height"] <= height for r in rooms)
        separated = True
        if count == 2:
            a, b = rooms
            separated = (a["x"] + 2 <= b["x"] or b["x"] + 2 <= a["x"] or
                         a["y"] + 2 <= b["y"] or b["y"] + 2 <= a["y"])
        assert inside and separated
        result["independent_geometry_check"] = {"inside": inside,
                                                    "no_internal_overlap": separated}
        result["view_geometry"]["rooms"] = rooms
    return result


def door_conflict():
    width = z3.Real("door_width")
    result = tracked_result([
        ("minimum_clearance", width >= z3.RealVal("0.8")),
        ("available_opening", width <= z3.RealVal("0.5")),
    ], [width])
    assert result["status"] == "unsat"
    result.update({
        "id": "U3", "title": "门宽下限 0.8 m 与上限 0.5 m 冲突",
        "expected_status": "unsat",
        "input": {"minimum_width": "0.8", "maximum_width": "0.5", "unit": "m"},
        "variables": [{"name": "door_width", "sort": "Real"}],
        "scope": "只比较一维门净宽上下界，不检查门的位置或机器人路径。",
        "view_interval": {"lower": 0.8, "upper": 0.5},
    })
    return result


def incremental_run():
    x = z3.Int("x")
    solver = z3.Solver()
    solver.add(x >= 2, x <= 6)
    steps = []

    def capture(operation):
        steps.append({"operation": operation, "scope_depth": solver.num_scopes(),
                      "assertions": [str(e) for e in solver.assertions()],
                      **checked_result(solver, [x])})

    capture("add(x >= 2, x <= 6); check()")
    solver.push()
    solver.add(x <= 1)
    capture("push(); add(x <= 1); check()")
    solver.pop()
    capture("pop(); check()")
    assert [s["status"] for s in steps] == ["sat", "unsat", "sat"]
    assert steps[0]["assertions"] == steps[2]["assertions"]
    return {"steps": steps, "note": "pop 撤回匹配 push 后新增的断言；不是删任意历史条件。"}


def assumptions_run():
    width = z3.Real("door_width")
    minimum, opening = z3.Bools("need_clearance wall_limit")
    solver = z3.Solver()
    solver.add(z3.Implies(minimum, width >= z3.RealVal("0.8")),
               z3.Implies(opening, width <= z3.RealVal("0.5")))
    steps = []
    for active in ([minimum, opening], [minimum], [minimum, opening]):
        steps.append({"active_assumptions": [str(a) for a in active],
                      **checked_result(solver, [width, minimum, opening], active)})
    assert [s["status"] for s in steps] == ["unsat", "sat", "unsat"]
    return {"background_assertions": [str(e) for e in solver.assertions()],
            "steps": steps,
            "note": "未作为 assumption 传入的开关没有被要求为真；这不等于永久删除其 Implies 公式。"}


def core_runs():
    x, y = z3.Ints("x y")
    fine = [("x_lower", x >= 2), ("x_upper", x <= 1)]
    grouped = [("x_policy", z3.And(x >= 2, x <= 1))]
    all_constraints = fine + [("y_lower", y >= 4), ("y_upper", y <= 3),
                              ("x_loose_upper", x <= 10)]
    returned = tracked_result(all_constraints, [x, y])
    removed = returned["unsat_core"][0]
    after_removal = tracked_result([(n, e) for n, e in all_constraints if n != removed], [x, y])
    assert after_removal["status"] == "unsat"
    alternatives = [tracked_result(pair) for pair in (fine, all_constraints[2:4])]
    candidate = tracked_result(all_constraints)
    less_redundant = tracked_result(all_constraints[:-1])
    assert candidate["status"] == less_redundant["status"] == "unsat"
    background = z3.Solver()
    background.add(x >= 2)
    background.assert_and_track(x <= 1, "tracked_upper")
    background_result = checked_result(background, [x])
    assert background_result["status"] == "unsat"
    return {
        "fine": tracked_result(fine), "grouped": tracked_result(grouped),
        "two_independent_conflicts": returned,
        "alternative_conflict_subsets": alternatives,
        "after_removing_one_returned_label": {"removed_label": removed, **after_removal},
        "redundant_candidate": {
            "candidate_labels": [n for n, _ in all_constraints],
            "candidate_status": candidate["status"],
            "removable_label": "x_loose_upper",
            "after_removing_redundant_label_status": less_redundant["status"],
            "provenance": "人工选取的不可满足子集，再用 Z3 核对；并非声称 Z3 返回了这五个标签。",
        },
        "untracked_background": {
            "background": ["x >= 2"],
            "tracked": [{"label": "tracked_upper", "formula": "x <= 1"}],
            **background_result,
            "note": "核心标签必须连同未跟踪的背景断言理解；x <= 1 单独并不矛盾。",
        },
        "note": "返回的 core 不是唯一根因或删除清单；标签打包粒度会改变核心的呈现粒度。",
    }


def unknown_run():
    x = z3.Real("x")
    solver = z3.Solver()
    solver.set(timeout=3000)
    solver.add(2 ** x == 3)
    result = checked_result(solver, [x])
    return {"id": "UNKNOWN", "title": "官方教程中的非多项式例子",
            "variables": [{"name": "x", "sort": "Real"}],
            "constraints": [{"label": None, "formula": "2**x == 3"}],
            "timeout_ms": 3000, **result,
            "note": "如实保存当前版本结果与 reason_unknown。设置时间上限不代表本次触发超时。",
            "source": "https://github.com/microsoft/z3guide/blob/main/website/docs-programming/02%20-%20Z3%20Python/01%20-%20Introduction.md#solvers"}


def optimization_runs():
    rows = []
    for cap in (120, 90, 70):
        width = z3.Int("width_cm")
        hard = [width >= 80, width <= cap]
        solver = z3.Solver()
        solver.add(hard)
        feasible = checked_result(solver, [width])
        optimizer = z3.Optimize()
        optimizer.add(hard)
        distance = z3.If(width >= 100, width - 100, 100 - width)
        optimizer.minimize(distance)
        optimal = checked_result(optimizer, [width])
        if optimal["status"] == "sat":
            optimal["distance_from_preferred_cm"] = scalar(optimizer.model().eval(distance))
            assert optimal["model"]["width_cm"] == min(100, cap)
        else:
            assert cap < 80 and optimal["status"] == "unsat"
        assert feasible["status"] == optimal["status"]
        rows.append({"hard_minimum_cm": 80, "hard_maximum_cm": cap,
                     "preferred_width_cm": 100, "solver": feasible, "optimize": optimal})
    return {"cases": rows,
            "objective": "minimize(abs(width_cm - 100))",
            "note": "Solver 给一个满足硬条件的模型；Optimize 在相同硬条件中优化偏好。硬条件自身冲突时仍无解。"}


def postcheck_run(layout):
    door, robot = Fraction(1, 2), Fraction(3, 5)
    passes = door >= robot
    assert layout["status"] == "sat" and not passes
    return {"solver_case_id": layout["id"], "solver_status": layout["status"],
            "model": layout["model"],
            "not_encoded": ["door_width", "robot_width", "door_contact", "motion_path"],
            "independent_check": {"name": "门净宽与机器人宽度的一维比较",
                "door_width_m": float(door), "robot_width_m": float(robot),
                "extra_margin_m": 0, "passes": passes},
            "conclusion": "布局公式有模型，但该输入的门宽检查失败；没有进行路径或物理执行验证。"}


def upstream_runs(path):
    source = path.read_bytes()
    blob_sha = hashlib.sha1(b"blob " + str(len(source)).encode() + b"\0" + source).hexdigest()
    if blob_sha != UPSTREAM_BLOB_SHA:
        raise ValueError("提供的原 MiniLab 文件与已核对版本不同，请先核对版本后再比较。")
    runs = []
    for width in (4, 3, 5):
        started = perf_counter()
        proc = subprocess.run([sys.executable, str(path), "--width", str(width)],
                              text=True, capture_output=True, check=True)
        elapsed = (perf_counter() - started) * 1000
        output = json.loads(proc.stdout)
        assert output["status"] == ("unsat" if width == 3 else "sat")
        runs.append({"width": width, "stdout_json": output,
                     "elapsed_ms_including_process_startup": round(elapsed, 6)})
    return {"status": "executed", "source_blob_sha": blob_sha,
            "source_revision": PLAN_REVISION,
            "source_url": f"https://github.com/lucinwen/14plan/blob/{PLAN_REVISION}/minilab/z3_demo.py",
            "runs": runs}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="写入 JSON；省略时输出到终端")
    parser.add_argument("--upstream-demo", type=Path,
                        help="可选：指定已核对 14plan 版本的 minilab/z3_demo.py，额外执行原例")
    args = parser.parse_args()
    cases = [layout_case("S1", 4, 3, 2, "sat"),
             layout_case("S2", 5, 5, 2, "sat"),
             layout_case("S3", 2, 2, 1, "sat"),
             layout_case("U1", 3, 3, 2, "unsat"),
             layout_case("U2", 1, 3, 1, "unsat"), door_conflict()]
    data = {
        "schema_version": 1,
        "environment": {
            "python": platform.python_version(), "z3": z3.get_version_string(),
            "z3_solver_package": importlib.metadata.version("z3-solver"),
            "platform": f"{platform.system()} {platform.machine()}",
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "reproduction_command": "python examples/day-02/run_examples.py --output my-day-02-results.json",
            "elapsed_ms_scope": "仅 check() 调用；原 MiniLab 子进程另行注明。单次耗时不是性能基准。",
        },
        "provenance": {
            "kind": "assistant_environment_run",
            "note": "AI 辅助制作教程时在执行环境中真实运行；不是学习者的本机实测或个人完成记录。",
            "plan_revision": PLAN_REVISION,
        },
        "cases": cases,
        "extra": {
            "incremental": incremental_run(), "assumptions": assumptions_run(),
            "core_granularity": core_runs(), "unknown": unknown_run(),
            "optimization": optimization_runs(), "postcheck": postcheck_run(cases[0]),
            "continuous_comparison": layout_case("U1-Real", 3, 3, 2, "unsat", True),
            "upstream_minilab": upstream_runs(args.upstream_demo) if args.upstream_demo else {
                "status": "not_run", "reason": "未提供 --upstream-demo；六例及扩展例仍实际运行。"},
        },
        "verification": {
            "six_expected_statuses_matched": True,
            "sat_models_satisfy_asserted_formulas": True,
            "sat_geometry_checked_independently": True,
            "returned_tracked_cores_rechecked": True,
            "incremental_and_assumption_sequences_checked": True,
            "physical_execution_tested": False,
        },
    }
    payload = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload, encoding="utf-8")
        print(f"Wrote {args.output}; Z3 {data['environment']['z3']}; "
              + ", ".join(f"{c['id']}={c['status']}" for c in cases)
              + f"; boundary example={data['extra']['unknown']['status']}")
    else:
        print(payload, end="")


if __name__ == "__main__":
    main()
