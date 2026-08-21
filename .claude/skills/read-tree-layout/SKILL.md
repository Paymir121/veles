---
name: read-tree-layout
description: >-
  Reads the family-tree grid via dump_tree_layout.py instead of guessing from
  JSON or a screenshot. Use when inspecting tree layout, packing, node x/y,
  family bars, sibling holes, in-law placement, or when the tree looks wrong
  (верстка дерева, разъехалось, кто где сидит).
---

# Read tree layout

If the task is to understand **who sits where** on the tree, run the dump
utility first. Do not decode `/api/tree/` JSON by hand, do not write a one-off
parser, and do not guess from a screenshot.

## Command

From the repo root (this machine: `py`, not `python`):

```text
py dump_tree_layout.py
py dump_tree_layout.py --q Логинов
```

`--q` keeps matching people plus parents/spouses/children.

## How to read the output

- `ROW y=…` — one generation. Smaller `y` is younger.
- `x=` — grid column (empty cell between people is normal; step is 2).
- `FAMILIES` — parents and children with `(x,y)`.
- `WARN` — packing bug (hole inside a sibling block, siblings torn apart).
- `NOTE` — explained layout, not a bug (child married into another branch).

After the dump, change packer/frontend if needed. UI still needs a real browser
look (skill `project-testing-rules`).
