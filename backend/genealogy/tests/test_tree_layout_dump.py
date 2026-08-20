from genealogy.tree_layout_dump import format_tree_layout


def make_node(node_id, data=None, rels=None, x=0, y=0):
    payload = {
        "first_name": "Иван",
        "last_name": "Петров",
        "patronymic": "",
        "gender": "M",
        "gender_actual": "M",
        "birth_date": "",
        "death_date": "",
        "status": "alive",
        "avatar": None,
    }
    if data:
        payload.update(data)
    links = {"parents": [], "spouses": [], "children": []}
    if rels:
        links.update(rels)
    return {"id": node_id, "data": payload, "rels": links, "x": x, "y": y}


def test_empty_dump():
    assert format_tree_layout([]) == "TREE LAYOUT  0 people\n"


def test_dump_groups_people_by_row_and_names_rels():
    tree = [
        make_node("father", {"first_name": "Сергей", "last_name": "Логинов"}, {
            "spouses": ["mother"],
            "children": ["denis"],
        }, x=4, y=2),
        make_node(
            "mother",
            {"first_name": "Светлана", "last_name": "Логинова", "gender": "F"},
            {"spouses": ["father"], "children": ["denis"]},
            x=6,
            y=2,
        ),
        make_node("denis", {"first_name": "Денис", "last_name": "Логинов"}, {
            "parents": ["father", "mother"],
        }, x=5, y=0),
    ]
    text = format_tree_layout(tree)
    assert "ROW y=0" in text
    assert "ROW y=2" in text
    assert "Логинов Денис" in text
    assert "parents=Логинов Сергей, Логинова Светлана" in text
    assert "FAMILY" in text or "Логинов Сергей + Логинова Светлана" in text


def test_dump_flags_stranger_inside_sibling_block():
    tree = [
        make_node("p1", {"first_name": "Григорий", "last_name": "Нельзин"}, {
            "children": ["a", "b"],
        }, x=4, y=2),
        make_node("a", {"first_name": "Райса", "last_name": "Нельзина"}, {
            "parents": ["p1"],
        }, x=2, y=0),
        make_node("b", {"first_name": "Борис", "last_name": "Нельзин"}, {
            "parents": ["p1"],
        }, x=10, y=0),
        make_node("stranger", {"first_name": "Сергей", "last_name": "Логинов"}, {}, x=6, y=0),
    ]
    text = format_tree_layout(tree)
    assert "WARN hole filler" in text
    assert "Логинов Сергей" in text


def test_query_keeps_one_hop_relatives():
    tree = [
        make_node("sergey", {"first_name": "Сергей", "last_name": "Логинов"}, {
            "children": ["denis"],
        }, x=4, y=2),
        make_node("denis", {"first_name": "Денис", "last_name": "Логинов"}, {
            "parents": ["sergey"],
        }, x=4, y=0),
        make_node("other", {"first_name": "Антон", "last_name": "Романов"}, {}, x=20, y=0),
    ]
    text = format_tree_layout(tree, query="Денис")
    assert "Логинов Денис" in text
    assert "Логинов Сергей" in text
    assert "Романов Антон" not in text
