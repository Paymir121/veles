"""Synthetic families that cover every tree-layout case.

Loaded by `manage.py seed_layout_lab`. Every person/union is tagged
`notes=layout-lab` so a reseed deletes only this lab, not the real tree.
"""
from __future__ import annotations

LAB_NOTE = "layout-lab"


def _person(key, first_name, last_name, *, gender="M", status="alive", **fields):
    row = {
        "key": key,
        "first_name": first_name,
        "last_name": last_name,
        "patronymic": "",
        "gender": gender,
        "status": status,
        "notes": LAB_NOTE,
        "extra_info": [],
    }
    row.update(fields)
    return row


def _union(person1, person2, date_start="1990-01-01", status="married"):
    return {
        "person1": person1,
        "person2": person2,
        "date_start": date_start,
        "status": status,
        "notes": LAB_NOTE,
    }


def build_layout_lab():
    """Return {persons, unions} in the same key-based shape as demo_data.json."""
    persons: list[dict] = []
    unions: list[dict] = []

    def add(*args, **kwargs):
        persons.append(_person(*args, **kwargs))

    def marry(*args, **kwargs):
        unions.append(_union(*args, **kwargs))

    # 1. Isolated person, no relatives.
    add("iso", "Артём", "Одиноков", status="alive")

    # 2. Couple + two kids. Father left / mother right; children mirrored.
    add("pair-f", "Иван", "Парнов", gender="M", status="deceased")
    add("pair-m", "Мария", "Парнова", gender="F", status="deceased")
    add("pair-a", "Антон", "Парнов", gender="M", status="alive", father="pair-f", mother="pair-m", birth_date="2018-01-01")
    add("pair-n", "Никита", "Парнов", gender="M", status="alive", father="pair-f", mother="pair-m", birth_date="2020-06-01")
    marry("pair-f", "pair-m", "1995-06-01")

    # 3. Parentless in-law joins partner's row; her absence of parents
    #    does not pull the husband's siblings.
    add("inlaw-gf", "Валерий", "Примаков", gender="M", status="deceased")
    add("inlaw-gm", "Галина", "Примакова", gender="F", status="deceased")
    add("inlaw-s", "Сергей", "Примаков", gender="M", father="inlaw-gf", mother="inlaw-gm")
    add("inlaw-sis", "Ольга", "Примакова", gender="F", father="inlaw-gf", mother="inlaw-gm")
    add("inlaw-w", "Светлана", "Примакова", gender="F")
    add("inlaw-c", "Денис", "Примаков", gender="M", father="inlaw-s", mother="inlaw-w")
    marry("inlaw-gf", "inlaw-gm", "1968-01-01")
    marry("inlaw-s", "inlaw-w", "1994-01-01")

    # 4. Both spouses have ancestors, different blood depth: pair sits on
    #    the deeper row, the shallow spouse's sibling is not raised.
    add("deep-gf", "Пётр", "Глубинов", gender="M", status="deceased")
    add("deep-gm", "Вера", "Глубинова", gender="F", status="deceased")
    add("deep-f", "Андрей", "Глубинов", gender="M", status="deceased", father="deep-gf", mother="deep-gm")
    add("shallow-gm", "Нина", "Мелкова", gender="F", status="deceased")
    add("shallow-m", "Елена", "Глубинова", gender="F", father="shallow-gm")
    add("shallow-bro", "Игорь", "Мелков", gender="M", father="shallow-gm")
    add("deep-c", "Павел", "Глубинов", gender="M", father="deep-f", mother="shallow-m")
    marry("deep-gf", "deep-gm", "1950-01-01")
    marry("deep-f", "shallow-m", "1978-01-01")

    # 5. Half-siblings: one mother, two fathers, two family bars.
    add("half-m", "Мария", "Полусибнова", gender="F")
    add("half-fa", "Андрей", "Полусибнов", gender="M")
    add("half-fb", "Борис", "Полусибнов", gender="M")
    add("half-a", "Анна", "Полусибнова", gender="F", father="half-fa", mother="half-m", birth_date="2001-01-01")
    add("half-b", "Вера", "Полусибнова", gender="F", father="half-fb", mother="half-m", birth_date="2005-01-01")
    marry("half-fa", "half-m", "2000-01-01", status="divorced")
    marry("half-fb", "half-m", "2004-01-01")

    # 6. Half-siblings the other way: one father, two mothers.
    add("hf-f", "Кирилл", "Отцовполусибнов", gender="M")
    add("hf-ma", "Дарья", "Отцовполусибнова", gender="F")
    add("hf-mb", "Оксана", "Отцовполусибнова", gender="F")
    add("hf-a", "Лев", "Отцовполусибнов", gender="M", father="hf-f", mother="hf-ma", birth_date="1999-01-01")
    add("hf-b", "Марк", "Отцовполусибнов", gender="M", father="hf-f", mother="hf-mb", birth_date="2008-01-01")
    marry("hf-f", "hf-ma", "1998-01-01", status="divorced")
    marry("hf-f", "hf-mb", "2007-01-01")

    # 7. Siblings stay on one row even if only one has children.
    add("sib-f", "Вадим", "Братов", gender="M", status="deceased")
    add("sib-m", "Светлана", "Братова", gender="F", status="deceased")
    add("sib-n", "Никита", "Братов", gender="M", father="sib-f", mother="sib-m")
    add("sib-a", "Антон", "Братов", gender="M", father="sib-f", mother="sib-m")
    add("sib-d", "Дарья", "Братова", gender="F", father="sib-a")
    marry("sib-f", "sib-m", "1988-01-01")

    # 8. Single parent: children keep natural order (no mirror).
    add("wid-a", "Антон", "Вдов", gender="M")
    add("wid-d", "Дарья", "Вдова", gender="F", father="wid-a", birth_date="2018-01-01")
    add("wid-s", "Софья", "Вдова", gender="F", father="wid-a", birth_date="2020-01-01")

    # 9. Mother only (no father).
    add("mom-only", "Ирина", "Материна", gender="F")
    add("mom-c1", "Юля", "Материна", gender="F", mother="mom-only", birth_date="2010-01-01")
    add("mom-c2", "Катя", "Материна", gender="F", mother="mom-only", birth_date="2012-01-01")

    # 10. Unknown gender, no relatives.
    add("unk", "Саша", "Неизвестков", gender="U")

    # 11. Wide row: ten leaf children under one couple.
    add("wide-f", "Фёдор", "Многодетов", gender="M", status="deceased")
    add("wide-m", "Надежда", "Многодетова", gender="F", status="deceased")
    marry("wide-f", "wide-m", "1970-01-01")
    for i, name in enumerate(
        ("Александр", "Борис", "Виктор", "Глеб", "Дмитрий", "Егор", "Жанна", "Зина", "Илья", "Кира"),
        start=1,
    ):
        gender = "F" if name in {"Жанна", "Зина", "Кира"} else "M"
        last = "Многодетова" if gender == "F" else "Многодетов"
        add(
            f"wide-c{i}",
            name,
            last,
            gender=gender,
            father="wide-f",
            mother="wide-m",
            birth_date=f"{1972 + i:04d}-03-01",
        )

    # 12. Deep chain: eight generations, one child each (Y stacking).
    prev = None
    deep_names = (
        ("Родион", "Длиннов"),
        ("Степан", "Длиннов"),
        ("Тихон", "Длиннов"),
        ("Устин", "Длиннов"),
        ("Фома", "Длиннов"),
        ("Харитон", "Длиннов"),
        ("Чеслав", "Длиннов"),
        ("Юрий", "Длиннов"),
    )
    for i, (first, last) in enumerate(deep_names):
        key = f"deep-{i}"
        status = "deceased" if i < 6 else "alive"
        fields = {"gender": "M", "status": status}
        if prev:
            fields["father"] = prev
        add(key, first, last, **fields)
        prev = key

    # 13. Hole case: many siblings, one raised with descendants; another
    #     bloodline marries in so an in-law couple must not sit inside the
    #     sibling block (the Loginov/Nelzin bug).
    add("hole-gf", "Григорий", "Дыров", gender="M", status="deceased")
    add("hole-gm", "Галина", "Дырова", gender="F", status="deceased")
    marry("hole-gf", "hole-gm", "1948-01-01")
    hole_kids = (
        ("valentina", "Валентина", "F"),
        ("raisa", "Раиса", "F"),
        ("marusya", "Маруся", "F"),
        ("klava", "Клавдия", "F"),
        ("kapa", "Капа", "F"),
        ("pavel", "Павел", "M"),
        ("boris", "Борис", "M"),
        ("tamara", "Тамара", "F"),
    )
    for key, first, gender in hole_kids:
        last = "Дырова" if gender == "F" else "Дыров"
        add(f"hole-{key}", first, last, gender=gender, father="hole-gf", mother="hole-gm")

    add("hole-vadim", "Вадим", "Клинов", gender="M", mother="hole-valentina")
    add("wedge-gf", "Валерий", "Клинов", gender="M", status="deceased")
    add("wedge-gm", "Галина", "Клинова", gender="F", status="deceased")
    marry("wedge-gf", "wedge-gm", "1960-01-01")
    add("wedge-sr", "Светлана", "Клинова", gender="F", father="wedge-gf", mother="wedge-gm")
    add("wedge-sergey", "Сергей", "Клинов", gender="M", father="wedge-gf", mother="wedge-gm")
    add("wedge-sl", "Анна", "Клинова", gender="F")
    add("hole-anton", "Антон", "Клинов", gender="M", father="hole-vadim", mother="wedge-sr")
    add("wedge-denis", "Денис", "Клинов", gender="M", father="wedge-sergey", mother="wedge-sl")
    marry("hole-vadim", "wedge-sr", "1988-01-01")
    marry("wedge-sergey", "wedge-sl", "1992-01-01")

    # 14. Second marriage of the same two people (allowed: different date).
    add("rem-a", "Глеб", "Второбраков", gender="M")
    add("rem-b", "Алла", "Второбракова", gender="F")
    add("rem-c1", "Инна", "Второбракова", gender="F", father="rem-a", mother="rem-b", birth_date="1985-01-01")
    add("rem-c2", "Олег", "Второбраков", gender="M", father="rem-a", mother="rem-b", birth_date="2001-01-01")
    marry("rem-a", "rem-b", "1984-01-01", status="divorced")
    unions.append(
        {
            "person1": "rem-a",
            "person2": "rem-b",
            "date_start": "2000-05-01",
            "status": "married",
            "notes": LAB_NOTE,
        }
    )

    # 15. Disconnected tiny clump so two islands share a generation baseline.
    add("isle-a", "Борис", "Островков", gender="M")
    add("isle-b", "Инга", "Островкова", gender="F")
    add("isle-c", "Тима", "Островков", gender="M", father="isle-a", mother="isle-b")
    marry("isle-a", "isle-b", "1991-01-01")

    return {"persons": persons, "unions": unions}
