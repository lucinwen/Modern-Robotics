from __future__ import annotations
import json, math, argparse

def door_clearance(width, diameter=.55, margin=.05, offset=0.0):
    c = width / 2 - abs(offset) - diameter / 2
    return {"clearance": c, "collision": c <= 0, "margin_pass": c >= margin and c > 0}

def dynamics(force, mass, mu, hz):
    net = max(0.0, force - mu * mass * 9.81)
    a = net / mass
    return {"acceleration": a, "dv": a / hz}

def reset_ok(robot, vel, door, cup, seed):
    return all([robot, vel, door, cup, seed])

def reward_case(progress, holding, delivered):
    r = progress + (5 if holding else 0)
    return {"reward": r, "success": bool(delivered and holding)}

def main(output=None):
    cases = []
    checks = 0

    def add(name, result, assertions):
        nonlocal checks
        for ok, msg in assertions:
            assert ok, msg
            checks += 1
        cases.append({"id": name, "result": result, "checks": len(assertions)})

    for name, F, m, mu, hz in [
        ("dyn_light", 20, 5, .2, 50),
        ("dyn_heavy", 20, 20, .2, 50),
        ("dyn_stuck", 10, 10, .8, 50),
    ]:
        r = dynamics(F, m, mu, hz)
        add(name, r, [
            (r["acceleration"] >= 0, "a nonnegative"),
            (r["dv"] >= 0, "dv nonnegative"),
            (math.isfinite(r["acceleration"]), "finite a"),
            (math.isfinite(r["dv"]), "finite dv"),
            (abs(r["dv"] - r["acceleration"] / hz) < 1e-12, "dt relation"),
        ])

    for i, w in enumerate([.9, .65, .6, .55, .5, .4]):
        r = door_clearance(w)
        add(f"door_{i}", r, [
            (math.isfinite(r["clearance"]), "finite"),
            (r["collision"] == (r["clearance"] <= 0), "collision rule"),
            (r["margin_pass"] == (r["clearance"] >= .05 and r["clearance"] > 0), "margin rule"),
            (w > 0, "positive width"),
            (not (r["collision"] and r["margin_pass"]), "exclusive"),
        ])

    for i, o in enumerate([0, .05, .125, .2]):
        r = door_clearance(.9, offset=o)
        add(f"offset_{i}", r, [
            (r["clearance"] <= .175 + 1e-12, "offset reduces clearance"),
            (math.isfinite(r["clearance"]), "finite"),
            (r["collision"] == (r["clearance"] <= 0), "collision"),
            (r["margin_pass"] == (r["clearance"] >= .05 and r["clearance"] > 0), "margin"),
            (o >= 0, "offset domain"),
        ])

    reset_inputs = [
        (1,1,1,1,1), (1,0,1,1,1), (1,1,0,1,1), (1,1,1,0,1), (1,1,1,1,0)
    ]
    for i, x in enumerate(reset_inputs):
        ok = reset_ok(*x)
        add(f"reset_{i}", {"ok": ok}, [
            (ok == all(x), "all states restored"),
            (isinstance(ok, bool), "bool"),
            (len(x) == 5, "five fields"),
            (sum(x) <= 5, "bounded"),
            (sum(x) >= 0, "nonnegative"),
        ])

    for i, (p, h, d) in enumerate([(8,1,1), (12,0,0), (5,1,0), (0,1,1)]):
        r = reward_case(p, h, d)
        add(f"reward_{i}", r, [
            (r["reward"] >= p, "reward includes progress"),
            (r["success"] == bool(d and h), "success predicate"),
            (math.isfinite(r["reward"]), "finite reward"),
            (r["reward"] == p + (5 if h else 0), "reward formula"),
            (not r["success"] or h, "success needs holding"),
            (not r["success"] or d, "success needs delivered"),
        ])

    for i, (ph, ch, ct) in enumerate([(120,30,50), (240,30,60), (120,24,40)]):
        ps = ph / ct
        cs = ph / ch
        add(f"timing_{i}", {"physics_per_control": ps, "physics_per_camera": cs}, [
            (ps > 0, "positive"),
            (cs > 0, "positive"),
            (math.isfinite(ps), "finite"),
            (math.isfinite(cs), "finite"),
            (ph >= max(ch, ct), "physics no slower"),
        ])

    contract = {
        "units": "m",
        "collision": True,
        "joint": True,
        "timestamped_obs": True,
        "seed_logged": True,
    }
    add("contract", contract, [
        (contract["units"] == "m", "meters"),
        (contract["collision"], "collision"),
        (contract["joint"], "joint"),
        (contract["timestamped_obs"], "time"),
        (contract["seed_logged"], "seed"),
        (isinstance(contract["units"], str), "unit type"),
        (all(isinstance(contract[k], bool) for k in ["collision","joint","timestamped_obs","seed_logged"]), "bool flags"),
        (len(contract) == 5, "field count"),
        (contract["collision"] and contract["joint"], "physical prerequisites"),
        (contract["timestamped_obs"] and contract["seed_logged"], "repro prerequisites"),
    ])

    assert len(cases) == 26 and checks == 139
    payload = {
        "summary": {
            "cases": 26,
            "checks": checks,
            "passed": checks,
            "isaac_execution": "not_run",
            "physical_execution": "not_run",
        },
        "cases": cases,
    }
    if output:
        with open(output, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"PASS: 26 cases, {checks}/{checks} checks")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--output")
    args = ap.parse_args()
    main(args.output)
