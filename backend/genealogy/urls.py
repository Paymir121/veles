from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("persons", views.PersonViewSet, basename="person")
router.register("burial-places", views.BurialPlaceViewSet, basename="burialplace")
router.register("unions", views.UnionViewSet, basename="union")

urlpatterns = [
    # Djoser registration/user-management (POST /auth/users/, GET /auth/users/me/, ...)
    path("auth/", include("djoser.urls")),
    # SimpleJWT login/refresh (POST /auth/jwt/create/, /auth/jwt/refresh/, ...)
    path("auth/", include("djoser.urls.jwt")),
    path("tree/", views.TreeView.as_view(), name="tree"),
    path("search/", views.SearchView.as_view(), name="search"),
    path("", include(router.urls)),
]
