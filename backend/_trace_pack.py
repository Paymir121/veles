import os
from collections import defaultdict

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "veles.settings.dev")
import django
django.setup()

from genealogy.services import serialize_tree
from genealogy import tree_layout as tl


class R:
    pass


payload = serialize_tree(R())
nodes = payload["nodes"]
by_id = {n["id"]: n for n in nodes}


def name(pid):
    n = by_id.get(pid)
    if not n:
        return pid
    return f"{n['data']['last_name']} {n['data']['first_name']}"


# Monkeypatch pack_person-level tracing by wrapping pack_columns internals via layout_tree
# Easier: re-run pack_columns with instrumented copies.

orig_pack = tl.pack_columns
log = []


def pack_columns(people, families, gen):
    by = {p["id"]: p for p in people}
    ids = set(by)
    col = {}
    families_by_parent = defaultdict(list)
    reserved = []
    for family in families:
        for parent_id in family["parent_ids"]:
            families_by_parent[parent_id].append(family)

    def occupied_at(generation):
        return [
            col[p["id"]]
            for p in people
            if gen.get(p["id"], 0) == generation and p["id"] in col
        ]

    def column_allowed(person_id, candidate):
        if not tl.far_enough(candidate, occupied_at(gen.get(person_id, 0))):
            return False
        for lo, hi, members in reserved:
            if person_id in members:
                continue
            if lo <= candidate <= hi:
                return False
        return True

    def nearest_free(generation, preferred, person_id):
        occupied = occupied_at(generation)
        if tl.far_enough(preferred, occupied) and column_allowed(person_id, preferred):
            return preferred
        for delta in range(1, 800):
            right = preferred + delta
            if tl.far_enough(right, occupied) and column_allowed(person_id, right):
                return right
            left = preferred - delta
            if tl.far_enough(left, occupied) and column_allowed(person_id, left):
                return left
        return preferred

    def place(person_id, preferred):
        if person_id in col:
            return
        col[person_id] = nearest_free(gen.get(person_id, 0), preferred, person_id)
        interesting = name(person_id)
        if "Логин" in interesting or person_id in {"53", "54", "55", "60"}:
            blocked = [(lo, hi) for lo, hi, m in reserved if person_id not in m]
            log.append(f"PLACE {interesting} pref={preferred} -> {col[person_id]} gen={gen.get(person_id)} blocked={blocked[:6]}")

    def place_parents(family, child_cols):
        if not child_cols:
            return
        mid = (min(child_cols) + max(child_cols)) / 2
        unplaced = tl.sort_couple(
            [p for p in family["parent_ids"] if p in ids and p not in col],
            by,
        )
        placed = [p for p in family["parent_ids"] if p in col]
        if len(unplaced) >= 2:
            left = nearest_free(gen.get(unplaced[0], 0), tl.js_round(mid - tl.COL_STEP / 2), unplaced[0])
            place(unplaced[0], left)
            place(unplaced[1], left + tl.COL_STEP)
            return
        if len(unplaced) == 1:
            preferred = tl.js_round(mid)
            if len(placed) == 1:
                preferred = col[placed[0]] + tl.COL_STEP
            place(unplaced[0], preferred)

    def pack_family(family, family_origin):
        kids = [c for c in tl.sort_children(family, by) if c in ids]
        if any("Логин" in name(c) or "Логин" in name(p) for c in kids for p in family["parent_ids"]):
            log.append(f"PACK_FAMILY origin={family_origin} parents={[name(p) for p in family['parent_ids']]} kids={[name(k) for k in kids]} already={[name(k) for k in kids if k in col]}")
        cursor = family_origin
        child_cols = []
        left = family_origin
        right = family_origin
        for child_id in kids:
            packed_col, packed_left, packed_right = pack_person(child_id, cursor)
            child_cols.append(packed_col)
            left = min(left, packed_left)
            right = max(right, packed_right)
            cursor = packed_right + tl.COL_STEP
        place_parents(family, child_cols)
        if child_cols:
            members = set(family["parent_ids"]) | set(family["child_ids"])
            reserved.append((min(child_cols), max(child_cols), members))
        for parent_id in family["parent_ids"]:
            if parent_id not in col:
                continue
            left = min(left, col[parent_id])
            right = max(right, col[parent_id])
        return left, right

    def pack_person(person_id, person_origin):
        interesting = "Логин" in name(person_id) or person_id in {"53", "54", "55", "60", "51", "58"}
        if person_id in col:
            current = col[person_id]
            if interesting:
                log.append(f"SKIP {name(person_id)} already col={current} origin={person_origin}")
            return current, current, current
        own_families = [
            family
            for family in families_by_parent.get(person_id, [])
            if all(p in ids for p in family["parent_ids"]) and all(c in ids for c in family["child_ids"])
        ]
        if interesting:
            log.append(f"PACK_PERSON {name(person_id)} origin={person_origin} families={len(own_families)}")
        if not own_families:
            place(person_id, person_origin)
            current = col[person_id]
            return current, current, current
        cursor = person_origin
        left = person_origin
        right = person_origin
        for family in own_families:
            packed_left, packed_right = pack_family(family, cursor)
            left = min(left, packed_left)
            right = max(right, packed_right)
            cursor = packed_right + tl.COL_STEP
        if person_id not in col:
            place(person_id, tl.js_round((left + right) / 2))
        current = col[person_id]
        return current, min(left, current), max(right, current)

    roots = [p for p in people if not p["rels"]["parents"]]
    roots.sort(key=lambda p: (-len(p["rels"]["children"]), tl._person_sort_key(p)))
    log.append("ROOTS: " + ", ".join(f"{name(p['id'])} kids={len(p['rels']['children'])}" for p in roots))
    pack_origin = 0
    for person in roots:
        if person["id"] in col:
            continue
        log.append(f"=== ROOT {name(person['id'])} at origin {pack_origin}")
        _, _, packed_right = pack_person(person["id"], pack_origin)
        pack_origin = packed_right + tl.COL_STEP * 2
        log.append(f"    origin now {pack_origin} right={packed_right}")

    for person in people:
        if person["id"] in col:
            continue
        log.append(f"=== LEFTOVER {name(person['id'])} at origin {pack_origin}")
        _, _, packed_right = pack_person(person["id"], pack_origin)
        pack_origin = packed_right + tl.COL_STEP * 2

    return col


tl.pack_columns = pack_columns
tl.layout_tree(nodes)
print("\n".join(log))
