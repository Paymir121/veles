"""Human-readable dump of GET /api/tree/ grid coordinates.

Used by `manage.py dump_tree_layout` so an agent can see who sits where
without decoding JSON or a screenshot.
"""
from __future__ import annotations

from collections import defaultdict

from .tree_layout import COL_STEP, build_family_units


def _name(node: dict) -> str:
    data = node.get("data") or {}
    parts = [data.get("last_name") or "", data.get("first_name") or ""]
    return " ".join(part for part in parts if part).strip() or str(node.get("id", "?"))


def _matches(node: dict, query: str) -> bool:
    if not query:
        return True
    needle = query.casefold()
    data = node.get("data") or {}
    hay = " ".join(
        str(data.get(field) or "")
        for field in ("last_name", "first_name", "patronymic", "maiden_name")
    )
    return needle in hay.casefold() or needle == str(node.get("id", ""))


def _rel_names(ids: list[str], by_id: dict[str, dict]) -> str:
    if not ids:
        return "-"
    return ", ".join(_name(by_id[person_id]) if person_id in by_id else person_id for person_id in ids)


def format_tree_layout(nodes: list[dict], *, query: str = "") -> str:
    """Return UTF-8 text: people by row, then families, then layout checks."""
    if not nodes:
        return "TREE LAYOUT  0 people\n"

    by_id = {node["id"]: node for node in nodes}
    visible_ids = {node["id"] for node in nodes if _matches(node, query)}
    if query:
        extra: set[str] = set()
        for person_id in visible_ids:
            rels = by_id[person_id].get("rels") or {}
            extra.update(rels.get("parents") or [])
            extra.update(rels.get("spouses") or [])
            extra.update(rels.get("children") or [])
        visible_ids.update(person_id for person_id in extra if person_id in by_id)

    visible = [node for node in nodes if node["id"] in visible_ids]
    xs = [int(node.get("x") or 0) for node in visible]
    ys = [int(node.get("y") or 0) for node in visible]
    lines = [
        (
            f"TREE LAYOUT  {len(nodes)} people"
            + (f"  filter={query!r} showing {len(visible)} with 1-hop relatives" if query else "")
            + f"  x={min(xs)}..{max(xs)}  y={min(ys)}..{max(ys)}"
            + "  (smaller y = younger generation)"
        ),
        "",
    ]

    by_row: dict[int, list[dict]] = defaultdict(list)
    for node in visible:
        by_row[int(node.get("y") or 0)].append(node)

    for row in sorted(by_row):
        lines.append(f"ROW y={row}")
        for node in sorted(by_row[row], key=lambda item: (int(item.get("x") or 0), _name(item))):
            rels = node.get("rels") or {}
            lines.append(
                f"  x={int(node.get('x') or 0):3d}  id={node['id']:<4}  {_name(node):<28}  "
                f"parents={_rel_names(rels.get('parents') or [], by_id)}  "
                f"spouses={_rel_names(rels.get('spouses') or [], by_id)}  "
                f"kids={len(rels.get('children') or [])}"
            )
        lines.append("")

    families = build_family_units(nodes)
    if query:
        families = [
            family
            for family in families
            if any(person_id in visible_ids for person_id in family["parent_ids"] + family["child_ids"])
        ]

    if families:
        lines.append("FAMILIES")
        for family in families:
            parents = [by_id[person_id] for person_id in family["parent_ids"] if person_id in by_id]
            children = [by_id[person_id] for person_id in family["child_ids"] if person_id in by_id]
            parent_label = " + ".join(_name(parent) for parent in parents) or family["id"]
            lines.append(f"  {parent_label}")
            for parent in parents:
                lines.append(f"    parent  {_cell(parent)}  {_name(parent)}")
            for child in sorted(children, key=lambda item: (int(item.get("x") or 0), _name(item))):
                lines.append(f"    child   {_cell(child)}  {_name(child)}")
            lines.append("")

    checks = _layout_checks(nodes, by_id)
    lines.append("CHECKS")
    if checks:
        lines.extend(f"  {item}" for item in checks)
    else:
        lines.append("  (none)")
    lines.append("")
    return "\n".join(lines)


def _cell(node: dict) -> str:
    return f"({int(node.get('x') or 0)},{int(node.get('y') or 0)})"


def _layout_checks(nodes: list[dict], by_id: dict[str, dict]) -> list[str]:
    """Flag the packing mistakes this project has already hit in real data."""
    flags: list[str] = []
    families = build_family_units(nodes)

    for family in families:
        children = [by_id[person_id] for person_id in family["child_ids"] if person_id in by_id]
        by_gen: dict[int, list[dict]] = defaultdict(list)
        for child in children:
            by_gen[int(child.get("y") or 0)].append(child)
        members = set(family["parent_ids"]) | set(family["child_ids"])
        for row, siblings in by_gen.items():
            if len(siblings) < 2:
                continue
            xs = sorted(int(child.get("x") or 0) for child in siblings)
            lo, hi = xs[0], xs[-1]
            parent_names = " + ".join(
                _name(by_id[person_id]) for person_id in family["parent_ids"] if person_id in by_id
            )
            gaps = [right - left for left, right in zip(xs, xs[1:])]
            if any(gap > COL_STEP * 2 for gap in gaps):
                flags.append(
                    f"WARN siblings split: {parent_names} children on y={row} "
                    f"at x={xs} (max gap {max(gaps)})"
                )
            for node in nodes:
                if node["id"] in members:
                    continue
                if int(node.get("y") or 0) != row:
                    continue
                x = int(node.get("x") or 0)
                if lo < x < hi:
                    flags.append(
                        f"WARN hole filler: {_name(node)} {_cell(node)} sits inside "
                        f"sibling block of {parent_names} x={lo}..{hi} on y={row}"
                    )

        parents = [by_id[person_id] for person_id in family["parent_ids"] if person_id in by_id]
        if parents and children:
            parent_mid = sum(int(parent.get("x") or 0) for parent in parents) / len(parents)
            nearest = min(children, key=lambda child: abs(int(child.get("x") or 0) - parent_mid))
            farthest = max(children, key=lambda child: abs(int(child.get("x") or 0) - parent_mid))
            far_dx = abs(int(farthest.get("x") or 0) - parent_mid)
            near_dx = abs(int(nearest.get("x") or 0) - parent_mid)
            if far_dx >= COL_STEP * 6 and near_dx <= COL_STEP * 2:
                flags.append(
                    f"NOTE parents stay with {_name(nearest)} {_cell(nearest)}; "
                    f"{_name(farthest)} {_cell(farthest)} is an out-married child "
                    f"(dx={int(far_dx)} from parent mid {parent_mid:.0f})"
                )

    return flags
