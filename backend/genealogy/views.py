from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from logger.logger import py_logger

from .models import BurialPlace, Person, Union
from .serializers import (
    BurialPlaceSerializer,
    PersonSearchSerializer,
    PersonSerializer,
    UnionSerializer,
)
from .services import (
    build_burial_place_search_q,
    build_person_search_q,
    order_person_search,
    serialize_tree,
)

SEARCH_RESULT_LIMIT = 50


class PersonViewSet(ModelViewSet):
    queryset = Person.objects.select_related("father", "mother", "burial_place")
    serializer_class = PersonSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["gender", "status"]
    search_fields = ["first_name", "last_name", "patronymic", "maiden_name", "birth_place"]
    ordering_fields = ["last_name", "birth_date"]

    def get_permissions(self):
        # Viewing a single person (reached by clicking a node in the public
        # tree/map) doesn't require login; browsing/searching the full list
        # and every write action still do.
        if self.action == "retrieve":
            return [AllowAny()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        py_logger.success(f"Person #{instance.pk} created by {self.request.user}")

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        py_logger.info(f"Person #{instance.pk} updated by {self.request.user}")


class BurialPlaceViewSet(ModelViewSet):
    # prefetch_related avoids N+1 when the serializer nests each place's
    # persons list.
    queryset = BurialPlace.objects.prefetch_related("persons")
    serializer_class = BurialPlaceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ["city"]
    search_fields = ["name", "city", "address"]

    def get_permissions(self):
        # The map page (public) needs the full list plus single-place
        # lookups; creating/editing a burial place still requires login.
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAuthenticated()]


class UnionViewSet(ModelViewSet):
    queryset = Union.objects.select_related("person1", "person2")
    serializer_class = UnionSerializer
    permission_classes = [IsAuthenticated]


class TreeView(APIView):
    """Read-only, whole-graph, family-chart-shaped. Deliberately
    unpaginated -- the tree UI needs the entire graph in one response.

    Public on purpose: viewing the tree (and the map, see BurialPlaceViewSet
    above) doesn't require an account. Since this endpoint already exposes
    every person's name/relationships to anyone, gating PersonViewSet.list
    or SearchView behind auth would no longer protect anything meaningful
    that this doesn't already -- see SearchView below."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(serialize_tree(request))


class SearchView(APIView):
    """Single global-search endpoint combining Person and BurialPlace
    icontains matches, for one search box shared by the tree and map UIs.

    Public: TreeView already exposes every person publicly, so search is
    just a more convenient way to query data that's already open -- gating
    it wouldn't add real privacy, only break the search box on the public
    tree/map pages."""

    permission_classes = [AllowAny]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response({"persons": [], "burial_places": []})

        py_logger.debug(f"Search query={query!r} by {request.user}")

        person_matches = order_person_search(
            Person.objects.select_related("burial_place").filter(build_person_search_q(query)),
            query,
        )[:SEARCH_RESULT_LIMIT]

        place_matches = BurialPlace.objects.filter(
            build_burial_place_search_q(query)
        ).prefetch_related("persons")[:SEARCH_RESULT_LIMIT]

        return Response(
            {
                "persons": PersonSearchSerializer(person_matches, many=True, context={"request": request}).data,
                "burial_places": BurialPlaceSerializer(place_matches, many=True, context={"request": request}).data,
            }
        )
