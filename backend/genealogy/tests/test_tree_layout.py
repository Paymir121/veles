from genealogy.tree_layout import assign_aligned_generations, layout_tree


def make_node(node_id, data=None, rels=None):
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
    return {"id": node_id, "data": payload, "rels": links}


def test_empty_tree_is_empty_dict():
    assert layout_tree([]) == {}


def test_unrelated_roots_share_a_baseline():
    tree = [
        make_node("root-a", {"first_name": "Алексей"}, {"children": ["child-a"]}),
        make_node("child-a", {"first_name": "Павел"}, {"parents": ["root-a"]}),
        make_node("root-b", {"first_name": "Борис"}),
    ]
    pos = layout_tree(tree)
    assert pos["root-a"][1] == pos["root-b"][1]


def test_parentless_spouse_joins_partner_generation():
    tree = [
        make_node("root", {"first_name": "Валерий", "last_name": "Логинов"}, {"children": ["sergey"]}),
        make_node(
            "sergey",
            {"first_name": "Сергей", "last_name": "Логинов"},
            {"parents": ["root"], "spouses": ["svetlana"], "children": ["denis"]},
        ),
        make_node(
            "svetlana",
            {
                "first_name": "Светлана",
                "last_name": "Логинова",
                "gender": "F",
                "gender_actual": "F",
            },
            {"spouses": ["sergey"], "children": ["denis"]},
        ),
        make_node(
            "denis",
            {"first_name": "Денис", "last_name": "Логинов"},
            {"parents": ["sergey", "svetlana"]},
        ),
    ]
    generations = assign_aligned_generations(tree)
    assert generations["sergey"] == generations["svetlana"]
    assert generations["denis"] == generations["sergey"] + 1


def test_couple_share_a_row_and_children_sit_above():
    tree = [
        make_node(
            "father",
            {"first_name": "Вадим", "last_name": "Романов"},
            {"children": ["nikita", "anton"]},
        ),
        make_node(
            "mother",
            {
                "first_name": "Светлана",
                "last_name": "Романова",
                "gender": "F",
                "gender_actual": "F",
            },
            {"children": ["nikita", "anton"]},
        ),
        make_node(
            "nikita",
            {"first_name": "Никита", "last_name": "Романов"},
            {"parents": ["father", "mother"]},
        ),
        make_node(
            "anton",
            {"first_name": "Антон", "last_name": "Романов"},
            {"parents": ["father", "mother"]},
        ),
    ]
    pos = layout_tree(tree)
    assert pos["father"][1] == pos["mother"][1]
    assert pos["nikita"][1] == pos["anton"][1]
    assert pos["nikita"][1] < pos["father"][1]
    assert abs(pos["nikita"][0] - pos["anton"][0]) == 2
    assert pos["nikita"][0] < pos["anton"][0]
    assert pos["father"][0] < pos["mother"][0]


def test_single_parent_children_are_not_mirrored():
    tree = [
        make_node("anton", {"first_name": "Антон"}, {"children": ["darya", "sofia"]}),
        make_node(
            "darya",
            {
                "first_name": "Дарья",
                "gender": "F",
                "gender_actual": "F",
                "birth_date": "2018-01-01",
            },
            {"parents": ["anton"]},
        ),
        make_node(
            "sofia",
            {
                "first_name": "Софья",
                "gender": "F",
                "gender_actual": "F",
                "birth_date": "2020-01-01",
            },
            {"parents": ["anton"]},
        ),
    ]
    pos = layout_tree(tree)
    assert pos["darya"][0] < pos["sofia"][0]


def test_siblings_stay_on_one_row_if_only_one_has_children():
    tree = [
        make_node("father", {"first_name": "Вадим"}, {"children": ["nikita", "anton"]}),
        make_node(
            "mother",
            {"first_name": "Светлана", "gender": "F", "gender_actual": "F"},
            {"children": ["nikita", "anton"]},
        ),
        make_node("nikita", {"first_name": "Никита"}, {"parents": ["father", "mother"]}),
        make_node(
            "anton",
            {"first_name": "Антон"},
            {"parents": ["father", "mother"], "children": ["darya"]},
        ),
        make_node(
            "darya",
            {"first_name": "Дарья", "gender": "F", "gender_actual": "F"},
            {"parents": ["anton"]},
        ),
    ]
    pos = layout_tree(tree)
    assert pos["nikita"][1] == pos["anton"][1]
    assert abs(pos["nikita"][0] - pos["anton"][0]) <= 4


def test_inlaw_couple_does_not_sit_inside_another_sibling_block():
    """Sergey/Svetlana Loginov must not fill the hole between a raised Nelzin
    child and her childless siblings."""
    tree = [
        make_node("grigory", {"first_name": "Григорий", "last_name": "Нельзин"}, {
            "children": ["valentina", "raisa", "marusya"],
        }),
        make_node(
            "galina-n",
            {"first_name": "Галина", "last_name": "Нельзина", "gender": "F", "gender_actual": "F"},
            {"children": ["valentina", "raisa", "marusya"]},
        ),
        make_node(
            "valentina",
            {"first_name": "Валентина", "last_name": "Романова", "gender": "F", "gender_actual": "F"},
            {"parents": ["grigory", "galina-n"], "children": ["vadim"]},
        ),
        make_node(
            "raisa",
            {"first_name": "Райса", "last_name": "Нельзина", "gender": "F", "gender_actual": "F"},
            {"parents": ["grigory", "galina-n"]},
        ),
        make_node(
            "marusya",
            {"first_name": "Маруся", "last_name": "Нельзина", "gender": "F", "gender_actual": "F"},
            {"parents": ["grigory", "galina-n"]},
        ),
        make_node("vadim", {"first_name": "Вадим", "last_name": "Романов"}, {
            "parents": ["valentina"],
            "spouses": ["svetlana-r"],
            "children": ["anton"],
        }),
        make_node("valery", {"first_name": "Валерий", "last_name": "Логинов"}, {
            "children": ["sergey", "svetlana-r"],
        }),
        make_node(
            "galina-l",
            {"first_name": "Галина", "last_name": "Логинова", "gender": "F", "gender_actual": "F"},
            {"children": ["sergey", "svetlana-r"]},
        ),
        make_node(
            "svetlana-r",
            {"first_name": "Светлана", "last_name": "Романова", "gender": "F", "gender_actual": "F"},
            {"parents": ["valery", "galina-l"], "spouses": ["vadim"], "children": ["anton"]},
        ),
        make_node(
            "anton",
            {"first_name": "Антон", "last_name": "Романов"},
            {"parents": ["vadim", "svetlana-r"]},
        ),
        make_node(
            "sergey",
            {"first_name": "Сергей", "last_name": "Логинов"},
            {"parents": ["valery", "galina-l"], "spouses": ["svetlana-l"], "children": ["denis", "dmitry"]},
        ),
        make_node(
            "svetlana-l",
            {"first_name": "Светлана", "last_name": "Логинова", "gender": "F", "gender_actual": "F"},
            {"spouses": ["sergey"], "children": ["denis", "dmitry"]},
        ),
        make_node(
            "dmitry",
            {"first_name": "Дмитрий", "last_name": "Логинов"},
            {"parents": ["sergey", "svetlana-l"], "children": ["serega", "alexandra"]},
        ),
        make_node("serega", {"first_name": "Серега", "last_name": "Логинов"}, {"parents": ["dmitry"]}),
        make_node(
            "alexandra",
            {"first_name": "Александра", "last_name": "Логинова", "gender": "F", "gender_actual": "F"},
            {"parents": ["dmitry"]},
        ),
        make_node(
            "denis",
            {"first_name": "Денис", "last_name": "Логинов"},
            {"parents": ["sergey", "svetlana-l"], "children": ["danil", "darina"]},
        ),
        make_node("danil", {"first_name": "Данил", "last_name": "Логинов"}, {"parents": ["denis"]}),
        make_node(
            "darina",
            {"first_name": "Дарина", "last_name": "Логинова", "gender": "F", "gender_actual": "F"},
            {"parents": ["denis"]},
        ),
    ]
    pos = layout_tree(tree)
    same_row = [kid for kid in ("valentina", "raisa", "marusya") if pos[kid][1] == pos["sergey"][1]]
    if len(same_row) >= 2:
        lo = min(pos[kid][0] for kid in same_row)
        hi = max(pos[kid][0] for kid in same_row)
        assert not (lo < pos["sergey"][0] < hi)
        assert not (lo < pos["svetlana-l"][0] < hi)
    assert abs(pos["sergey"][0] - pos["svetlana-l"][0]) == 2
    assert pos["sergey"][1] == pos["svetlana-l"][1]
    assert pos["denis"][1] == pos["dmitry"][1]
    assert abs(pos["denis"][0] - pos["dmitry"][0]) <= 6
