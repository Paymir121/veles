import pytest
from rest_framework.test import APIClient

from accounts.models import User
from genealogy.models import Person

pytestmark = pytest.mark.django_db


# Viewing is public (tree, map, an individual person, search over both --
# see the docstrings on TreeView/BurialPlaceViewSet/SearchView/PersonViewSet
# in views.py for why); browsing the raw person list and every write action
# still require login.


def test_anonymous_cannot_list_persons():
    response = APIClient().get("/api/persons/")
    assert response.status_code == 401


def test_anonymous_can_retrieve_person():
    person = Person.objects.create(first_name="Ivan", last_name="Petrov", status="alive")
    response = APIClient().get(f"/api/persons/{person.pk}/")
    assert response.status_code == 200


def test_anonymous_cannot_create_person():
    response = APIClient().post(
        "/api/persons/", {"first_name": "Bad", "last_name": "Actor", "status": "alive"}
    )
    assert response.status_code == 401


def test_anonymous_can_list_burial_places():
    response = APIClient().get("/api/burial-places/")
    assert response.status_code == 200


def test_anonymous_cannot_create_burial_place():
    response = APIClient().post("/api/burial-places/", {"name": "Test"})
    assert response.status_code == 401


def test_anonymous_can_read_tree():
    response = APIClient().get("/api/tree/")
    assert response.status_code == 200


def test_anonymous_can_search():
    response = APIClient().get("/api/search/?q=x")
    assert response.status_code == 200


def test_registration_is_open_to_anonymous():
    response = APIClient().post(
        "/api/auth/users/",
        {
            "username": "newuser",
            "password": "SuperSecret123",
            "re_password": "SuperSecret123",
        },
    )
    assert response.status_code == 201, response.data


def test_authenticated_user_can_list_persons():
    user = User.objects.create_user(username="alice", password="pw12345")
    client = APIClient()
    client.force_authenticate(user=user)
    response = client.get("/api/persons/")
    assert response.status_code == 200


def test_jwt_login_and_use_token():
    User.objects.create_user(username="alice", password="pw12345")
    client = APIClient()

    token_response = client.post(
        "/api/auth/jwt/create/", {"username": "alice", "password": "pw12345"}
    )
    assert token_response.status_code == 200
    access = token_response.data["access"]

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    response = client.get("/api/persons/")
    assert response.status_code == 200
