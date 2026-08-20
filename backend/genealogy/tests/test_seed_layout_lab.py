import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from genealogy.layout_lab import LAB_NOTE, build_layout_lab
from genealogy.models import Person
from genealogy.services import serialize_tree

pytestmark = pytest.mark.django_db


def test_layout_lab_spec_has_many_disconnected_islands():
    spec = build_layout_lab()
    assert len(spec["persons"]) >= 70
    last_names = {row["last_name"] for row in spec["persons"]}
    assert "Одиноков" in last_names
    assert "Дыров" in last_names
    assert "Клинов" in last_names
    assert "Полусибнова" in last_names


@override_settings(DEBUG=False)
def test_seed_layout_lab_refuses_when_debug_is_off():
    with pytest.raises(CommandError, match="DEBUG=False"):
        call_command("seed_layout_lab")


@override_settings(DEBUG=True)
def test_seed_layout_lab_does_not_wipe_real_people():
    real = Person.objects.create(first_name="Вадим", last_name="Романов", status="alive", gender="M")
    call_command("seed_layout_lab")
    assert Person.objects.filter(pk=real.pk).exists()
    assert Person.objects.filter(notes=LAB_NOTE).count() == len(build_layout_lab()["persons"])


@override_settings(DEBUG=True)
def test_seed_layout_lab_keeps_inlaw_couple_outside_sibling_block():
    call_command("seed_layout_lab")
    payload = serialize_tree(None)
    kids = [
        node
        for node in payload["nodes"]
        if node["data"]["last_name"] in {"Дыров", "Дырова"}
        and node["data"]["first_name"]
        in {"Валентина", "Раиса", "Маруся", "Клавдия", "Капа", "Павел", "Борис", "Тамара"}
    ]
    sergey = next(
        node
        for node in payload["nodes"]
        if node["data"]["last_name"] == "Клинов" and node["data"]["first_name"] == "Сергей"
    )
    anna = next(
        node
        for node in payload["nodes"]
        if node["data"]["last_name"] == "Клинова" and node["data"]["first_name"] == "Анна"
    )
    lo = min(node["x"] for node in kids if node["y"] == sergey["y"]) if any(n["y"] == sergey["y"] for n in kids) else None
    hi = max(node["x"] for node in kids if node["y"] == sergey["y"]) if lo is not None else None
    assert len(kids) == 8
    if lo is not None and hi is not None and hi - lo >= 2:
        assert not (lo < sergey["x"] < hi)
        assert not (lo < anna["x"] < hi)
