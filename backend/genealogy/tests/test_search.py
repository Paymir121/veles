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


def test_search_matches_multi_word_full_name(auth_client):
    # Words are ANDed across fields: matching the whole query string against
    # each field separately (the previous behaviour) found nothing at all for
    # the most natural way to search for someone.
    Person.objects.create(first_name="Пётр", last_name="Соколов", status="alive")
    Person.objects.create(first_name="Анна", last_name="Соколова", status="alive")

    response = auth_client.get("/api/search/?q=Соколов Пётр")
    data = response.json()
    assert [p["first_name"] for p in data["persons"]] == ["Пётр"]


def test_search_multi_word_requires_every_word_to_match(auth_client):
    Person.objects.create(first_name="Пётр", last_name="Соколов", status="alive")

    response = auth_client.get("/api/search/?q=Соколов Иван")
    assert response.json()["persons"] == []


def test_search_treats_yo_and_ye_as_the_same_letter(auth_client):
    Person.objects.create(first_name="Пётр", last_name="Соколов", status="alive")

    assert len(auth_client.get("/api/search/?q=Петр").json()["persons"]) == 1
    assert len(auth_client.get("/api/search/?q=пётр").json()["persons"]) == 1


def test_search_matches_a_four_digit_year(auth_client):
    Person.objects.create(
        first_name="Пётр", last_name="Соколов", status="deceased", birth_date="1921-03-04"
    )
    Person.objects.create(first_name="Анна", last_name="Соколова", status="alive")
    # Free-form dates ("около 1920") are plain text, so they match too.
    Person.objects.create(first_name="Мария", last_name="Белова", birth_date_text="около 1921")

    names = {p["first_name"] for p in auth_client.get("/api/search/?q=1921").json()["persons"]}
    assert names == {"Пётр", "Мария"}


def test_search_ranks_own_name_above_a_maiden_name_match(auth_client):
    # Both people legitimately match both words, but only one of them *is*
    # Соколов Пётр -- alphabetical order alone would bury him under Морозова.
    Person.objects.create(
        first_name="Ольга",
        last_name="Морозова",
        patronymic="Петровна",
        maiden_name="Соколова",
        status="alive",
    )
    Person.objects.create(first_name="Пётр", last_name="Соколов", status="alive")

    data = auth_client.get("/api/search/?q=Соколов Пётр").json()
    assert [p["last_name"] for p in data["persons"]] == ["Соколов", "Морозова"]


def test_search_multi_word_matches_place_name_plus_city(auth_client):
    BurialPlace.objects.create(name="Ваганьковское кладбище", city="Москва")
    BurialPlace.objects.create(name="Ваганьковское кладбище", city="Казань")

    data = auth_client.get("/api/search/?q=Ваганьковское Москва").json()
    assert [place["city"] for place in data["burial_places"]] == ["Москва"]


def test_search_person_result_carries_its_burial_place(auth_client):
    # The map focuses a person by flying to their grave, so a search hit has to
    # carry the coordinates with it rather than needing a follow-up request.
    place = BurialPlace.objects.create(
        name="Ваганьковское", city="Москва", latitude="55.776100", longitude="37.558900"
    )
    Person.objects.create(
        first_name="Пётр", last_name="Соколов", status="deceased", burial_place=place
    )

    person = auth_client.get("/api/search/?q=Соколов").json()["persons"][0]
    assert person["burial_place_detail"]["name"] == "Ваганьковское"
    # Numbers, not strings: they go straight into Yandex Maps geometry.
    assert person["burial_place_detail"]["latitude"] == pytest.approx(55.7761)
    assert person["burial_place_detail"]["longitude"] == pytest.approx(37.5589)


def test_search_person_result_without_a_burial_place(auth_client):
    Person.objects.create(first_name="Пётр", last_name="Соколов", status="alive")

    person = auth_client.get("/api/search/?q=Соколов").json()["persons"][0]
    assert person["burial_place_detail"] is None


def test_burial_place_coordinates_are_numbers(auth_client):
    BurialPlace.objects.create(name="A", city="Moscow", latitude="55.751244", longitude="37.618423")

    place = auth_client.get("/api/burial-places/").json()["results"][0]
    assert place["latitude"] == pytest.approx(55.751244)
    assert place["longitude"] == pytest.approx(37.618423)


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
