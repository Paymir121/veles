import pytest
from django.test.utils import CaptureQueriesContext
from django.db import connection
from rest_framework.test import APIClient

from accounts.models import User
from genealogy.models import Person, Union

pytestmark = pytest.mark.django_db


@pytest.fixture
def auth_client():
    user = User.objects.create_user(username="alice", password="pw12345")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def small_family():
    father = Person.objects.create(first_name="Petr", last_name="Ivanov", status="deceased", gender="M")
    mother = Person.objects.create(first_name="Anna", last_name="Ivanova", status="deceased", gender="F")
    child = Person.objects.create(
        first_name="Ivan",
        last_name="Ivanov",
        status="alive",
        gender="M",
        father=father,
        mother=mother,
    )
    Union.objects.create(person1=father, person2=mother, date_start="1990-01-01", status="married")
    return father, mother, child


def test_tree_shape(auth_client, small_family):
    father, mother, child = small_family

    response = auth_client.get("/api/tree/")
    assert response.status_code == 200

    nodes = {node["id"]: node for node in response.json()}
    assert set(nodes.keys()) == {str(father.pk), str(mother.pk), str(child.pk)}

    child_node = nodes[str(child.pk)]
    assert set(child_node["rels"]["parents"]) == {str(father.pk), str(mother.pk)}
    assert child_node["rels"]["spouses"] == []
    assert child_node["rels"]["children"] == []

    father_node = nodes[str(father.pk)]
    assert father_node["rels"]["parents"] == []
    assert father_node["rels"]["spouses"] == [str(mother.pk)]
    assert father_node["rels"]["children"] == [str(child.pk)]

    mother_node = nodes[str(mother.pk)]
    assert mother_node["rels"]["parents"] == []
    assert mother_node["rels"]["spouses"] == [str(father.pk)]
    assert mother_node["rels"]["children"] == [str(child.pk)]


def test_tree_gender_unknown_falls_back_to_M_but_keeps_actual(auth_client):
    Person.objects.create(first_name="Sasha", last_name="Neizvestny", status="alive", gender="U")

    response = auth_client.get("/api/tree/")
    node = response.json()[0]
    assert node["data"]["gender"] == "M"
    assert node["data"]["gender_actual"] == "U"


def test_tree_runs_in_two_queries(auth_client, small_family):
    with CaptureQueriesContext(connection) as ctx:
        response = auth_client.get("/api/tree/")
    assert response.status_code == 200
    # Exactly Person.objects.all() + Union.objects.all() -- no N+1, regardless
    # of family size.
    assert len(ctx.captured_queries) == 2, ctx.captured_queries
