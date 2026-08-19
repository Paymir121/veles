import pytest
from rest_framework.test import APIRequestFactory

from accounts.models import User
from genealogy.models import Person
from genealogy.serializers import PersonSerializer, UnionSerializer

pytestmark = pytest.mark.django_db


def _request_for(user):
    request = APIRequestFactory().get("/")
    request.user = user
    return request


@pytest.fixture
def user():
    return User.objects.create_user(username="alice", password="pw12345")


@pytest.fixture
def other_user():
    return User.objects.create_user(username="bob", password="pw12345")


# --- PersonSerializer: status/clean() wiring -------------------------------


def test_person_serializer_accepts_valid_payload(user):
    data = {"first_name": "Ivan", "last_name": "Ivanov", "status": "alive", "extra_info": []}
    serializer = PersonSerializer(data=data, context={"request": _request_for(user)})
    assert serializer.is_valid(), serializer.errors
    person = serializer.save(created_by=user, updated_by=user)
    assert person.pk is not None


def test_person_serializer_rejects_alive_with_death_date(user):
    data = {
        "first_name": "Ivan",
        "last_name": "Ivanov",
        "status": "alive",
        "death_date": "2020-01-01",
    }
    serializer = PersonSerializer(data=data, context={"request": _request_for(user)})
    assert not serializer.is_valid()


# --- extra_info shape, enforced via the declared serializer field ---------


def test_person_serializer_rejects_bad_extra_info_shape(user):
    data = {
        "first_name": "Ivan",
        "last_name": "Ivanov",
        "status": "alive",
        "extra_info": [{"title": "missing category"}],
    }
    serializer = PersonSerializer(data=data, context={"request": _request_for(user)})
    assert not serializer.is_valid()
    assert "extra_info" in serializer.errors


# --- linked_user self-claim rule -------------------------------------------


def test_person_serializer_allows_self_link(user):
    data = {
        "first_name": "Ivan",
        "last_name": "Ivanov",
        "status": "alive",
        "linked_user": user.pk,
    }
    serializer = PersonSerializer(data=data, context={"request": _request_for(user)})
    assert serializer.is_valid(), serializer.errors


def test_person_serializer_rejects_linking_someone_elses_account(user, other_user):
    data = {
        "first_name": "Ivan",
        "last_name": "Ivanov",
        "status": "alive",
        "linked_user": other_user.pk,
    }
    serializer = PersonSerializer(data=data, context={"request": _request_for(user)})
    assert not serializer.is_valid()
    assert "linked_user" in serializer.errors


# --- UnionSerializer: clean() wiring ----------------------------------------


def test_union_serializer_accepts_valid_pair():
    p1 = Person.objects.create(first_name="Ivan", last_name="Ivanov", status="alive")
    p2 = Person.objects.create(first_name="Maria", last_name="Ivanova", status="alive")
    serializer = UnionSerializer(data={"person1": p1.pk, "person2": p2.pk, "date_start": "2000-01-01"})
    assert serializer.is_valid(), serializer.errors


def test_union_serializer_rejects_self_marriage():
    p1 = Person.objects.create(first_name="Ivan", last_name="Ivanov", status="alive")
    serializer = UnionSerializer(data={"person1": p1.pk, "person2": p1.pk})
    assert not serializer.is_valid()


def test_union_serializer_rejects_duplicate_pair_and_date():
    p1 = Person.objects.create(first_name="Ivan", last_name="Ivanov", status="alive")
    p2 = Person.objects.create(first_name="Maria", last_name="Ivanova", status="alive")
    from genealogy.models import Union as UnionModel

    UnionModel.objects.create(person1=p1, person2=p2, date_start="2000-01-01")

    serializer = UnionSerializer(data={"person1": p2.pk, "person2": p1.pk, "date_start": "2000-01-01"})
    assert not serializer.is_valid()
