import pytest
from rest_framework.test import APIClient

from accounts.models import User
from genealogy.models import BurialPlace, Person

pytestmark = pytest.mark.django_db


@pytest.fixture
def auth_client():
    user = User.objects.create_user(username="alice", password="pw12345")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_search_finds_person_and_burial_place(auth_client):
    Person.objects.create(first_name="Ivan", last_name="Petrov", status="alive")
    BurialPlace.objects.create(name="Petrovskoye cemetery", city="Moscow")

    response = auth_client.get("/api/search/?q=Petrov")
    assert response.status_code == 200
    data = response.json()
    assert len(data["persons"]) == 1
    assert len(data["burial_places"]) == 1


def test_search_matches_by_city(auth_client):
    BurialPlace.objects.create(name="Vagankovskoye", city="Moscow")
    BurialPlace.objects.create(name="Some place", city="Kazan")

    response = auth_client.get("/api/search/?q=Moscow")
    data = response.json()
    assert len(data["burial_places"]) == 1
    assert data["burial_places"][0]["city"] == "Moscow"


def test_search_matches_cyrillic_regardless_of_case(auth_client):
    # SQLite's built-in UPPER()/LOWER() only case-folds ASCII, so a query in
    # a different case than the stored value used to silently return zero
    # rows for Cyrillic text (see genealogy/apps.py's connection_created
    # hook, which registers Unicode-aware replacements).
    BurialPlace.objects.create(name="Ваганьковское кладбище", city="Москва")

    response = auth_client.get("/api/search/?q=москва")
    data = response.json()
    assert len(data["burial_places"]) == 1
    assert data["burial_places"][0]["city"] == "Москва"


def test_search_empty_query_returns_empty_lists(auth_client):
    response = auth_client.get("/api/search/?q=")
    assert response.status_code == 200
    assert response.json() == {"persons": [], "burial_places": []}


def test_search_no_match_returns_empty_lists(auth_client):
    response = auth_client.get("/api/search/?q=doesnotexist")
    assert response.status_code == 200
    assert response.json() == {"persons": [], "burial_places": []}


def test_persons_search_filter(auth_client):
    Person.objects.create(first_name="Ivan", last_name="Petrov", status="alive")
    Person.objects.create(first_name="Boris", last_name="Sidorov", status="alive")

    response = auth_client.get("/api/persons/?search=Petrov")
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 1
    assert results[0]["last_name"] == "Petrov"


def test_burial_places_city_filter(auth_client):
    BurialPlace.objects.create(name="A", city="Moscow")
    BurialPlace.objects.create(name="B", city="Kazan")

    response = auth_client.get("/api/burial-places/?city=Moscow")
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 1
    assert results[0]["city"] == "Moscow"
