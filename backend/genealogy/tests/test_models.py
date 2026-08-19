import pytest
from django.core.exceptions import ValidationError

from genealogy.models import BurialPlace, Person, Union

pytestmark = pytest.mark.django_db


def make_person(**kwargs):
    defaults = {
        "first_name": "Ivan",
        "last_name": "Ivanov",
        "status": "alive",
    }
    defaults.update(kwargs)
    return Person.objects.create(**defaults)


# --- status consistency ----------------------------------------------------


def test_alive_person_with_no_death_or_burial_fields_is_valid():
    person = Person(first_name="Ivan", last_name="Ivanov", status="alive")
    person.full_clean()  # should not raise


def test_alive_person_with_death_date_is_invalid():
    person = Person(
        first_name="Ivan", last_name="Ivanov", status="alive", death_date="2020-01-01"
    )
    with pytest.raises(ValidationError):
        person.full_clean()


def test_deceased_person_with_plot_details_requires_burial_place():
    person = Person(
        first_name="Ivan",
        last_name="Ivanov",
        status="deceased",
        burial_plot_details="plot 5, row 3",
    )
    with pytest.raises(ValidationError):
        person.full_clean()


def test_deceased_person_with_plot_details_and_burial_place_is_valid():
    place = BurialPlace.objects.create(name="Vagankovskoye")
    person = Person(
        first_name="Ivan",
        last_name="Ivanov",
        status="deceased",
        burial_place=place,
        burial_plot_details="plot 5, row 3",
    )
    person.full_clean()  # should not raise


# --- no self parent ----------------------------------------------------


def test_person_cannot_be_their_own_father():
    person = make_person()
    person.father_id = person.pk
    with pytest.raises(ValidationError):
        person.full_clean()


def test_person_with_different_father_is_valid():
    father = make_person(first_name="Petr", status="alive")
    child = make_person(first_name="Ivan", status="alive")
    child.father = father
    child.full_clean()  # should not raise


# --- ancestor cycle ----------------------------------------------------


def test_ancestor_cycle_is_rejected():
    grandparent = make_person(first_name="A")
    parent = make_person(first_name="B", father=grandparent)
    parent.save()
    grandchild = make_person(first_name="C", father=parent)
    grandchild.save()

    # Attempt to make grandparent a child of grandchild -> cycle.
    grandparent.father_id = grandchild.pk
    with pytest.raises(ValidationError):
        grandparent.full_clean()


def test_normal_multi_generation_tree_is_valid():
    grandparent = make_person(first_name="A")
    parent = make_person(first_name="B", father=grandparent)
    parent.save()
    grandchild = Person(first_name="C", last_name="Ivanov", status="alive", father=parent)
    grandchild.full_clean()  # should not raise


# --- extra_info shape ----------------------------------------------------


def test_extra_info_valid_shape():
    person = Person(
        first_name="Ivan",
        last_name="Ivanov",
        status="alive",
        extra_info=[
            {"category": "work", "title": "Engineer", "date_from": "1990", "date_to": "2000"},
        ],
    )
    person.full_clean()  # should not raise


def test_extra_info_missing_required_key_is_invalid():
    person = Person(
        first_name="Ivan",
        last_name="Ivanov",
        status="alive",
        extra_info=[{"title": "Engineer"}],  # missing "category"
    )
    with pytest.raises(ValidationError):
        person.full_clean()


def test_extra_info_unknown_key_is_invalid():
    person = Person(
        first_name="Ivan",
        last_name="Ivanov",
        status="alive",
        extra_info=[{"category": "work", "title": "Engineer", "unexpected": "x"}],
    )
    with pytest.raises(ValidationError):
        person.full_clean()


def test_extra_info_too_many_items_is_invalid():
    person = Person(
        first_name="Ivan",
        last_name="Ivanov",
        status="alive",
        extra_info=[{"category": "c", "title": "t"} for _ in range(101)],
    )
    with pytest.raises(ValidationError):
        person.full_clean()


# --- BurialPlace lat/lon constraint ----------------------------------------


def test_burial_place_both_lat_lon_null_is_valid():
    place = BurialPlace.objects.create(name="Unknown place")
    assert place.latitude is None and place.longitude is None


def test_burial_place_both_lat_lon_set_is_valid():
    place = BurialPlace.objects.create(name="Named place", latitude="55.7558", longitude="37.6173")
    assert place.pk is not None


# --- Union ----------------------------------------------------


def test_union_self_marriage_is_invalid():
    person = make_person()
    union = Union(person1=person, person2=person)
    with pytest.raises(ValidationError):
        union.full_clean()


def test_union_valid_pair():
    p1 = make_person(first_name="Ivan")
    p2 = make_person(first_name="Maria")
    union = Union(person1=p1, person2=p2, date_start="2000-01-01")
    union.full_clean()  # should not raise


def test_union_duplicate_pair_and_date_is_rejected():
    p1 = make_person(first_name="Ivan")
    p2 = make_person(first_name="Maria")
    Union.objects.create(person1=p1, person2=p2, date_start="2000-01-01")

    duplicate = Union(person1=p2, person2=p1, date_start="2000-01-01")  # reversed order
    with pytest.raises(ValidationError):
        duplicate.full_clean()


def test_union_same_pair_different_date_is_allowed():
    p1 = make_person(first_name="Ivan")
    p2 = make_person(first_name="Maria")
    Union.objects.create(person1=p1, person2=p2, date_start="2000-01-01", status="divorced")

    remarriage = Union(person1=p1, person2=p2, date_start="2005-01-01")
    remarriage.full_clean()  # should not raise
