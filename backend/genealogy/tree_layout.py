"""Grid packer for GET /api/tree/.

Coordinates are integer cells, not pixels. The frontend multiplies by its
node size. One person occupies one cell; neighbouring people are separated
by one empty cell (COL_STEP). Generation rows are separated by an empty
row (ROW_STRIDE) for the family bar.
"""
from __future__ import annotations

import math
from collections import defaultdict

COL_STEP = 2
ROW_STRIDE = 2


def js_round(value: float) -> int:
    """Match JS Math.round: ties round toward +∞."""
    return math.floor(value + 0.5)


def layout_tree(nodes: list[dict]) -> dict[str, tuple[int, int]]:
    """Return {person_id: (x, y)} in grid cells. Origin is top-left; younger
    generations have smaller y.
    """
    if not nodes:
        return {}

    generations = assign_aligned_generations(nodes)
    max_gen = max(generations.values(), default=0)
    families = build_family_units(nodes)
    columns: dict[str, int] = {}
    origin = 0

    for component in connected_components(nodes):
        ids = {person["id"] for person in component}
        local_families = [
            family
            for family in families
            if all(parent_id in ids for parent_id in family["parent_ids"])
            and all(child_id in ids for child_id in family["child_ids"])
        ]
        packed = pack_columns(component, local_families, generations)
        max_col = max(packed.values(), default=0)
        for person_id, col in packed.items():
            columns[person_id] = origin + col
        origin += max_col + COL_STEP * 2

    return {
        person["id"]: (
            columns.get(person["id"], 0),
            (max_gen - generations.get(person["id"], 0)) * ROW_STRIDE,
        )
        for person in nodes
    }


def assign_aligned_generations(nodes: list[dict]) -> dict[str, int]:
    """Blood generation. Parentless in-laws join their partner's row; nobody
    else is pulled. Co-parents snap to the deeper row of that pair only.
    """
    by_id = {person["id"]: person for person in nodes}
    gen = blood_generation(nodes)
    families = build_family_units(nodes)
    has_parents = lambda person_id: bool(by_id.get(person_id, {}).get("rels", {}).get("parents"))

    for _ in range(16):
        changed = False

        def raise_gen(person_id: str, next_gen: int) -> None:
            nonlocal changed
            current = gen.get(person_id, 0)
            if next_gen > current:
                gen[person_id] = next_gen
                changed = True

        for family in families:
            rooted = [parent_id for parent_id in family["parent_ids"] if has_parents(parent_id)]
            if rooted:
                target = max(gen.get(parent_id, 0) for parent_id in rooted)
                for parent_id in family["parent_ids"]:
                    if not has_parents(parent_id):
                        raise_gen(parent_id, target)
                parent_gen = max(gen.get(parent_id, 0) for parent_id in family["parent_ids"])
                for child_id in family["child_ids"]:
                    raise_gen(child_id, parent_gen + 1)

        for person in nodes:
            if has_parents(person["id"]):
                continue
            for spouse_id in person["rels"]["spouses"]:
                if spouse_id in by_id:
                    raise_gen(person["id"], gen.get(spouse_id, 0))

        if not changed:
            break

    for family in families:
        if len(family["parent_ids"]) < 2:
            continue
        together = max(gen.get(parent_id, 0) for parent_id in family["parent_ids"])
        for parent_id in family["parent_ids"]:
            gen[parent_id] = together

    return gen


def build_family_units(nodes: list[dict]) -> list[dict]:
    ids = {person["id"] for person in nodes}
    families: dict[str, dict] = {}
    for node in nodes:
        parent_ids = [parent_id for parent_id in node["rels"]["parents"] if parent_id in ids]
        if not parent_ids:
            continue
        family_id = _family_id(parent_ids)
        existing = families.get(family_id)
        if existing:
            existing["child_ids"].append(node["id"])
            continue
        families[family_id] = {
            "id": family_id,
            "parent_ids": sorted(parent_ids),
            "child_ids": [node["id"]],
        }
    return list(families.values())


def _family_id(parent_ids: list[str]) -> str:
    return "family:" + "+".join(sorted(parent_ids))


def blood_generation(nodes: list[dict]) -> dict[str, int]:
    by_id = {person["id"]: person for person in nodes}
    memo: dict[str, int] = {}

    def generation_of(person_id: str, visiting: set[str]) -> int:
        if person_id in memo:
            return memo[person_id]
        if person_id in visiting:
            return 0
        person = by_id.get(person_id)
        parents = person["rels"]["parents"] if person else []
        if not person or not parents:
            memo[person_id] = 0
            return 0
        visiting.add(person_id)
        generation = max(
            (generation_of(parent_id, visiting) + 1 for parent_id in parents if parent_id in by_id),
            default=0,
        )
        visiting.remove(person_id)
        memo[person_id] = generation
        return generation

    for node in nodes:
        generation_of(node["id"], set())
    return memo


def _person_sort_key(person: dict) -> str:
    data = person["data"]
    return (
        f"{data.get('birth_date') or '9999'}|"
        f"{data.get('last_name', '')}|"
        f"{data.get('first_name', '')}|"
        f"{person['id']}"
    )


def _gender_of(person: dict | None) -> str:
    if not person:
        return ""
    data = person["data"]
    return data.get("gender_actual") or data.get("gender") or ""


def sort_people(ids: list[str], by_id: dict[str, dict]) -> list[str]:
    return sorted(
        ids,
        key=lambda person_id: _person_sort_key(by_id[person_id]) if person_id in by_id else person_id,
    )


def sort_couple(ids: list[str], by_id: dict[str, dict]) -> list[str]:
    def couple_key(person_id: str) -> tuple[int, str]:
        person = by_id.get(person_id)
        male_first = 0 if _gender_of(person) == "M" else 1
        return (male_first, _person_sort_key(person) if person else person_id)

    return sorted(ids, key=couple_key)


def has_father_and_mother(parent_ids: list[str], by_id: dict[str, dict]) -> bool:
    genders = {_gender_of(by_id.get(parent_id)) for parent_id in parent_ids}
    return "M" in genders and "F" in genders


def sort_children(family: dict, by_id: dict[str, dict]) -> list[str]:
    kids = sort_people(family["child_ids"], by_id)
    if len(family["parent_ids"]) >= 2 and has_father_and_mother(family["parent_ids"], by_id):
        kids.reverse()
    return kids


def far_enough(col: int, occupied: list[int]) -> bool:
    return all(abs(used - col) >= COL_STEP for used in occupied)


def connected_components(nodes: list[dict]) -> list[list[dict]]:
    by_id = {person["id"]: person for person in nodes}
    seen: set[str] = set()
    components: list[list[dict]] = []

    for person in nodes:
        if person["id"] in seen:
            continue
        queue = [person["id"]]
        seen.add(person["id"])
        ids: list[str] = []
        while queue:
            current_id = queue.pop()
            ids.append(current_id)
            node = by_id.get(current_id)
            if not node:
                continue
            rels = node["rels"]
            for next_id in [*rels["parents"], *rels["children"], *rels["spouses"]]:
                if next_id not in by_id or next_id in seen:
                    continue
                seen.add(next_id)
                queue.append(next_id)
        components.append([by_id[person_id] for person_id in ids])

    components.sort(key=len, reverse=True)
    return components


def pack_columns(
    people: list[dict],
    families: list[dict],
    gen: dict[str, int],
) -> dict[str, int]:
    by_id = {person["id"]: person for person in people}
    ids = set(by_id)
    col: dict[str, int] = {}
    families_by_parent: dict[str, list[dict]] = defaultdict(list)
    reserved: list[tuple[int, int, int, set[str]]] = []
    for family in families:
        for parent_id in family["parent_ids"]:
            families_by_parent[parent_id].append(family)

    def occupied_at(generation: int) -> list[int]:
        return [
            col[person["id"]]
            for person in people
            if gen.get(person["id"], 0) == generation and person["id"] in col
        ]

    def column_allowed(person_id: str, candidate: int) -> bool:
        if not far_enough(candidate, occupied_at(gen.get(person_id, 0))):
            return False
        person_gen = gen.get(person_id, 0)
        for span_gen, lo, hi, members in reserved:
            if person_id in members or span_gen != person_gen:
                continue
            if lo <= candidate <= hi:
                return False
        return True

    def nearest_free(
        generation: int,
        preferred: int,
        person_id: str,
        *,
        prefer_right: bool = False,
    ) -> int:
        occupied = occupied_at(generation)

        def ok(candidate: int) -> bool:
            return far_enough(candidate, occupied) and column_allowed(person_id, candidate)

        if ok(preferred):
            return preferred
        deltas = range(1, 800)
        if prefer_right:
            for delta in deltas:
                if ok(preferred + delta):
                    return preferred + delta
            for delta in deltas:
                if ok(preferred - delta):
                    return preferred - delta
            return preferred
        for delta in deltas:
            if ok(preferred + delta):
                return preferred + delta
            if ok(preferred - delta):
                return preferred - delta
        return preferred

    def snap_out_of_reserved(person_id: str, cursor: int) -> int:
        person_gen = gen.get(person_id, 0)
        for _ in range(8):
            moved = False
            for span_gen, lo, hi, members in reserved:
                if person_id in members or span_gen != person_gen:
                    continue
                if lo <= cursor <= hi:
                    cursor = hi + COL_STEP
                    moved = True
            if not moved:
                break
        return cursor

    def place(person_id: str, preferred: int, *, prefer_right: bool = False) -> None:
        if person_id in col:
            return
        col[person_id] = nearest_free(
            gen.get(person_id, 0),
            preferred,
            person_id,
            prefer_right=prefer_right,
        )

    def place_parents(family: dict, child_cols: list[int]) -> None:
        if not child_cols:
            return
        mid = (min(child_cols) + max(child_cols)) / 2
        unplaced = sort_couple(
            [parent_id for parent_id in family["parent_ids"] if parent_id in ids and parent_id not in col],
            by_id,
        )
        placed = [parent_id for parent_id in family["parent_ids"] if parent_id in col]
        if len(unplaced) >= 2:
            left = nearest_free(gen.get(unplaced[0], 0), js_round(mid - COL_STEP / 2), unplaced[0])
            place(unplaced[0], left)
            place(unplaced[1], left + COL_STEP)
            return
        if len(unplaced) == 1:
            preferred = js_round(mid)
            if len(placed) == 1:
                preferred = col[placed[0]] + COL_STEP
            place(unplaced[0], preferred)

    def pack_family(family: dict, family_origin: int) -> tuple[int, int]:
        kids = [child_id for child_id in sort_children(family, by_id) if child_id in ids]
        placed_kids = [child_id for child_id in kids if child_id in col]
        cursor = family_origin
        if placed_kids:
            cursor = max(col[child_id] for child_id in placed_kids) + COL_STEP
        child_cols: list[int] = []
        left = family_origin
        right = family_origin
        for index, child_id in enumerate(kids):
            if child_id not in col:
                cursor = snap_out_of_reserved(child_id, cursor)
            packed_col, packed_left, packed_right = pack_person(
                child_id,
                cursor,
                prefer_right=index > 0 or bool(placed_kids),
            )
            child_cols.append(packed_col)
            left = min(left, packed_left)
            right = max(right, packed_right)
            cursor = packed_right + COL_STEP
        place_parents(family, child_cols)
        if child_cols:
            members = set(family["parent_ids"]) | set(family["child_ids"])
            by_gen: dict[int, list[int]] = defaultdict(list)
            for child_id, child_col in zip(kids, child_cols):
                by_gen[gen.get(child_id, 0)].append(child_col)
            for span_gen, cols in by_gen.items():
                reserved.append((span_gen, min(cols), max(cols), members))
        for parent_id in family["parent_ids"]:
            if parent_id not in col:
                continue
            left = min(left, col[parent_id])
            right = max(right, col[parent_id])
        return left, right

    def pack_person(
        person_id: str,
        person_origin: int,
        *,
        prefer_right: bool = False,
    ) -> tuple[int, int, int]:
        if person_id in col:
            current = col[person_id]
            return current, current, current
        own_families = [
            family
            for family in families_by_parent.get(person_id, [])
            if all(parent_id in ids for parent_id in family["parent_ids"])
            and all(child_id in ids for child_id in family["child_ids"])
        ]
        if not own_families:
            place(person_id, person_origin, prefer_right=prefer_right)
            current = col[person_id]
            return current, current, current

        cursor = person_origin
        left = person_origin
        right = person_origin
        for family in own_families:
            packed_left, packed_right = pack_family(family, cursor)
            left = min(left, packed_left)
            right = max(right, packed_right)
            cursor = packed_right + COL_STEP
        if person_id not in col:
            place(person_id, js_round((left + right) / 2))
        current = col[person_id]
        return current, min(left, current), max(right, current)

    roots = [person for person in people if not person["rels"]["parents"]]
    roots.sort(
        key=lambda person: (
            -len(person["rels"]["children"]),
            _person_sort_key(person),
        )
    )

    pack_origin = 0
    for person in roots:
        if person["id"] in col:
            continue
        _, _, packed_right = pack_person(person["id"], pack_origin)
        pack_origin = packed_right + COL_STEP * 2

    for person in people:
        if person["id"] in col:
            continue
        _, _, packed_right = pack_person(person["id"], pack_origin)
        pack_origin = packed_right + COL_STEP * 2

    if col:
        min_col = min(col.values())
        if min_col != 0:
            for person_id, value in col.items():
                col[person_id] = value - min_col
    return col
