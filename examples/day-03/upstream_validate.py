"""Minimal, deliberately bounded task-environment checker for learning.

Runs with Python standard library. No physics, path trajectory, robot control,
perception, or learned policy is simulated. "feasible" means only that the
declared discrete rules pass; it is not a robot execution success claim.
"""
from __future__ import annotations

import argparse
import copy
import json
from collections import deque
from typing import Any


def example_world() -> dict[str, Any]:
    return {
        "rooms": [
            {"id": "A", "box": [0, 0, 4, 4]},
            {"id": "B", "box": [4, 0, 8, 4]},
        ],
        "doors": [
            {"id": "D", "between": ["A", "B"], "width_m": 0.9, "locked": False}
        ],
        "robot": {
            "start": "A", "width_m": 0.6,
            "capabilities": ["move", "grasp"], "keys": [],
        },
        "objects": [{"id": "cup", "room": "B", "graspable": True}],
        "goal": {"type": "hold", "object": "cup"},
    }


def shared_wall_length(a: list[float], b: list[float], eps: float = 1e-8) -> float:
    """Length of a collinear *wall* contact; point touch is not a doorway."""
    if abs(a[2] - b[0]) <= eps or abs(b[2] - a[0]) <= eps:
        return max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    if abs(a[3] - b[1]) <= eps or abs(b[3] - a[1]) <= eps:
        return max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    return 0.0


def _reachable(start: str, target: str, edges: list[tuple[str, str]]) -> bool:
    adj: dict[str, set[str]] = {}
    for a, b in edges:
        adj.setdefault(a, set()).add(b)
        adj.setdefault(b, set()).add(a)
    queue = deque([start])
    seen = {start}
    while queue:
        room = queue.popleft()
        if room == target:
            return True
        for neighbor in adj.get(room, set()) - seen:
            seen.add(neighbor)
            queue.append(neighbor)
    return False


def analyze(world: dict[str, Any]) -> dict[str, Any]:
    """Check limited geometry, topology and symbolic preconditions.

    Statuses are intentionally not robotics rollout results:
    invalid_input / invalid_geometry / blocked_topology / blocked_geometry /
    blocked_state / blocked_action / rule_feasible.
    """
    scope = "axis_aligned_2d_geometry_and_symbolic_rules_only_no_physics_or_control"

    def result(status: str, reason: str, *, geom: bool, topo: bool,
               task: bool = False) -> dict[str, Any]:
        return {
            "status": status,
            "reason": reason,
            "geometry_valid": geom,
            "topology_connected": topo,
            "rule_task_feasible": task,
            "scope": scope,
        }

    try:
        rooms_list = world["rooms"]
        doors = world["doors"]
        robot = world["robot"]
        objects = world["objects"]
        goal = world["goal"]
        room_ids = [r["id"] for r in rooms_list]
        if not rooms_list or len(room_ids) != len(set(room_ids)):
            raise ValueError("room ids missing, empty or duplicated")
        rooms = {r["id"]: [float(v) for v in r["box"]] for r in rooms_list}
        if any(len(b) != 4 or not b[0] < b[2] or not b[1] < b[3]
               for b in rooms.values()):
            raise ValueError("room box is not [x_min,y_min,x_max,y_max] with positive area")
        if robot["start"] not in rooms or float(robot["width_m"]) <= 0:
            raise ValueError("invalid robot start or width")
        obj_ids = [o["id"] for o in objects]
        if len(set(obj_ids)) != len(obj_ids):
            raise ValueError("duplicated object id")
        object_by_id = {o["id"]: o for o in objects}
        if goal["type"] != "hold" or goal["object"] not in object_by_id:
            raise ValueError("demo only supports hold(existing-object)")
        target = object_by_id[goal["object"]]["room"]
        if target not in rooms:
            raise ValueError("target object refers to unknown room")
        for door in doors:
            a, b = door["between"]
            if a not in rooms or b not in rooms or a == b:
                raise ValueError("door references invalid endpoints")
            if float(door["width_m"]) <= 0:
                raise ValueError("door width must be positive")
    except (KeyError, TypeError, ValueError, IndexError) as exc:
        return result("invalid_input", f"invalid data or unsupported demo goal: {exc}",
                      geom=False, topo=False)

    for idx, aid in enumerate(room_ids):
        a = rooms[aid]
        for bid in room_ids[idx + 1:]:
            b = rooms[bid]
            x_overlap = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
            y_overlap = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
            if x_overlap * y_overlap > 1e-8:
                return result("invalid_geometry", f"interior overlap: {aid}/{bid}",
                              geom=False, topo=False)

    all_edges = []
    usable_edges = []
    width_blockers, lock_blockers = [], []
    capability = set(robot.get("capabilities", []))
    keys = set(robot.get("keys", []))
    width = float(robot["width_m"])

    for door in doors:
        a, b = door["between"]
        wall = shared_wall_length(rooms[a], rooms[b])
        dw = float(door["width_m"])
        if wall <= 1e-8 or dw > wall + 1e-8:
            return result("invalid_geometry",
                          f"door {door['id']} lacks a sufficient shared wall",
                          geom=False, topo=False)
        all_edges.append((a, b))
        if dw + 1e-8 < width:
            width_blockers.append(door["id"])
            continue
        if door.get("locked", False):
            key_name = door.get("key")
            if "unlock" not in capability or not key_name or key_name not in keys:
                lock_blockers.append(door["id"])
                continue
        usable_edges.append((a, b))

    start = robot["start"]
    topo = _reachable(start, target, all_edges)
    if not topo:
        return result("blocked_topology", "no declared door graph path to target",
                      geom=True, topo=False)
    if "move" not in capability and start != target:
        return result("blocked_action", "robot lacks move capability", geom=True, topo=True)
    if not _reachable(start, target, usable_edges):
        cause = "narrow doors: " + ",".join(width_blockers)
        if lock_blockers:
            cause += ("; " if width_blockers else "") + "locked doors: " + ",".join(lock_blockers)
        return result("blocked_geometry" if width_blockers else "blocked_state",
                      cause or "route blocked", geom=True, topo=True)
    obj = object_by_id[goal["object"]]
    if "grasp" not in capability or not bool(obj.get("graspable", False)):
        return result("blocked_action", "no valid grasp under declared demo rules",
                      geom=True, topo=True)
    return result("rule_feasible", "restricted graph/geometry/state rules all pass",
                  geom=True, topo=True, task=True)


def demo_results() -> dict[str, dict[str, Any]]:
    base = example_world()
    cases = {"baseline": base}

    narrow = copy.deepcopy(base)
    narrow["doors"][0]["width_m"] = 0.4
    cases["narrow_door"] = narrow

    locked = copy.deepcopy(base)
    locked["doors"][0].update({"locked": True, "key": "K"})
    cases["locked_without_key"] = locked

    unlockable = copy.deepcopy(locked)
    unlockable["robot"]["keys"].append("K")
    unlockable["robot"]["capabilities"].append("unlock")
    cases["unlocked_with_key"] = unlockable

    overlapping = copy.deepcopy(base)
    overlapping["rooms"][1]["box"] = [3, 0, 7, 4]
    cases["overlap"] = overlapping

    cannot_grasp = copy.deepcopy(base)
    cannot_grasp["robot"]["capabilities"].remove("grasp")
    cases["no_grasp"] = cannot_grasp

    return {name: analyze(case) for name, case in cases.items()}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", help="Optional JSON world file; otherwise print demo cases")
    args = parser.parse_args()
    if args.input:
        with open(args.input, encoding="utf-8") as f:
            print(json.dumps(analyze(json.load(f)), indent=2, ensure_ascii=False))
    else:
        print(json.dumps(demo_results(), indent=2, ensure_ascii=False))
