import json
import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "veles.settings.dev")
django.setup()

from genealogy.services import serialize_tree


class R:
    pass


tree = serialize_tree(R())
nodes = tree["nodes"]
loginovs = [
    n
    for n in nodes
    if "логин" in (n["data"]["last_name"] + n["data"]["first_name"]).lower()
    or "нельз" in n["data"]["last_name"].lower()
    or n["data"]["last_name"] in {"Романов", "Романова"}
]
loginovs.sort(key=lambda n: (n["y"], n["x"]))
out = {
    "total": len(nodes),
    "loginov_like": [
        {
            "id": n["id"],
            "name": f"{n['data']['last_name']} {n['data']['first_name']}",
            "x": n["x"],
            "y": n["y"],
            "parents": n["rels"]["parents"],
            "spouses": n["rels"]["spouses"],
            "children": n["rels"]["children"],
        }
        for n in loginovs
    ],
}
path = r"C:\dev\veles\backend\_loginov_dump.json"
with open(path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print("total", len(nodes), "focus", len(loginovs), "->", path)
for n in out["loginov_like"]:
    if "логин" in n["name"].lower() or "нельз" in n["name"].lower():
        print(f"{n['x']:4} {n['y']:3}  {n['name']}  parents={n['parents']} kids={len(n['children'])} spouses={n['spouses']}")
