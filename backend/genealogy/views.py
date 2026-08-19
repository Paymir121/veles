import json
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from logger.logger import py_logger

from .models import BurialPlace, Person, Union
from .serializers import (
    BurialPlaceSerializer,
    PersonDetailSerializer,
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
    filterset_fields = ["status"]
    search_fields = ["first_name", "last_name", "patronymic", "maiden_name", "birth_place"]
    ordering_fields = ["last_name", "birth_date"]

    def get_permissions(self):
        # Viewing a single person (reached by clicking a node in the public
        # tree/map) doesn't require login; browsing/searching the full list
        # and every write action still do.
        if self.action == "retrieve":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PersonDetailSerializer
        return PersonSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        gender = self.request.query_params.get("gender")
        if gender == "M":
            return queryset.filter(Q(gender="M") | Q(gender="U"))
        if gender == "F":
            return queryset.filter(Q(gender="F") | Q(gender="U"))
        if gender:
            return queryset.filter(gender=gender)
        return queryset

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


class ExportView(APIView):
    """Export the entire DB as JSON compatible with demo_data.json / seed_demo_data."""

    permission_classes = [IsAdminUser]

    def get(self, request):
        burial_places_out = []
        for bp in BurialPlace.objects.all():
            key = f"bp_{bp.pk}"
            entry: dict = {"key": key, "name": bp.name}
            if bp.city:
                entry["city"] = bp.city
            if bp.latitude is not None:
                entry["latitude"] = str(bp.latitude)
            if bp.longitude is not None:
                entry["longitude"] = str(bp.longitude)
            if bp.address:
                entry["address"] = bp.address
            if bp.description:
                entry["description"] = bp.description
            burial_places_out.append(entry)

        person_key_map: dict[int, str] = {}
        persons = list(
            Person.objects.select_related("father", "mother", "burial_place").all()
        )
        for p in persons:
            key = f"p_{p.pk}"
            person_key_map[p.pk] = key

        persons_out = []
        for p in persons:
            entry = {
                "key": person_key_map[p.pk],
                "first_name": p.first_name,
                "last_name": p.last_name,
            }
            if p.patronymic:
                entry["patronymic"] = p.patronymic
            if p.maiden_name:
                entry["maiden_name"] = p.maiden_name
            entry["gender"] = p.gender
            if p.birth_date:
                entry["birth_date"] = str(p.birth_date)
            if p.birth_date_text:
                entry["birth_date_text"] = p.birth_date_text
            if p.birth_place:
                entry["birth_place"] = p.birth_place
            entry["status"] = p.status
            if p.death_date:
                entry["death_date"] = str(p.death_date)
            if p.death_date_text:
                entry["death_date_text"] = p.death_date_text
            if p.father_id:
                entry["father"] = person_key_map[p.father_id]
            if p.mother_id:
                entry["mother"] = person_key_map[p.mother_id]
            if p.burial_place_id:
                entry["burial_place"] = f"bp_{p.burial_place_id}"
            if p.burial_plot_details:
                entry["burial_plot_details"] = p.burial_plot_details
            entry["extra_info"] = p.extra_info or []
            if p.notes:
                entry["notes"] = p.notes
            persons_out.append(entry)

        unions_out = []
        for u in Union.objects.all():
            entry: dict = {
                "person1": person_key_map[u.person1_id],
                "person2": person_key_map[u.person2_id],
            }
            if u.date_start:
                entry["date_start"] = str(u.date_start)
            if u.date_start_text:
                entry["date_start_text"] = u.date_start_text
            if u.date_end:
                entry["date_end"] = str(u.date_end)
            if u.date_end_text:
                entry["date_end_text"] = u.date_end_text
            if u.status:
                entry["status"] = u.status
            if u.notes:
                entry["notes"] = u.notes
            unions_out.append(entry)

        data = {
            "burial_places": burial_places_out,
            "persons": persons_out,
            "unions": unions_out,
        }

        response = JsonResponse(data, json_dumps_params={"ensure_ascii": False, "indent": 2})
        response["Content-Disposition"] = 'attachment; filename="veles_export.json"'
        return response


class ImportView(APIView):
    """Import JSON (same format as demo_data.json) with merge semantics.

    Person uniqueness: (first_name, last_name, patronymic, birth_date).
    BurialPlace uniqueness: (name, city).
    Union uniqueness: (person1, person2, date_start).
    Existing records that match are updated with non-empty fields from the file;
    new records are created.
    """

    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            data = json.loads(uploaded.read().decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            return Response({"detail": f"Invalid JSON: {exc}"}, status=status.HTTP_400_BAD_REQUEST)

        stats = {"burial_places_created": 0, "burial_places_updated": 0,
                 "persons_created": 0, "persons_updated": 0,
                 "unions_created": 0, "unions_updated": 0}

        try:
            with transaction.atomic():
                place_by_key = self._import_burial_places(data.get("burial_places", []), stats)
                person_by_key = self._import_persons(data.get("persons", []), place_by_key, stats, request.user)
                self._import_unions(data.get("unions", []), person_by_key, stats)
        except Exception as exc:
            py_logger.error(f"Import failed: {exc}")
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        py_logger.success(f"Import by {request.user}: {stats}")
        return Response(stats)

    def _import_burial_places(self, items, stats):
        place_by_key: dict[str, BurialPlace] = {}
        for raw in items:
            item = dict(raw)
            key = item.pop("key", None)
            item.pop("_comment", None)

            for coord in ("latitude", "longitude"):
                if coord in item:
                    try:
                        item[coord] = Decimal(item[coord])
                    except (InvalidOperation, TypeError):
                        item[coord] = None

            name = item.get("name", "")
            city = item.get("city", "")
            existing = BurialPlace.objects.filter(name=name, city=city).first()

            if existing:
                for field, val in item.items():
                    if val not in (None, ""):
                        setattr(existing, field, val)
                existing.full_clean()
                existing.save()
                place_by_key[key or f"bp_{existing.pk}"] = existing
                stats["burial_places_updated"] += 1
            else:
                bp = BurialPlace(**item)
                bp.full_clean()
                bp.save()
                place_by_key[key or f"bp_{bp.pk}"] = bp
                stats["burial_places_created"] += 1

        return place_by_key

    def _import_persons(self, items, place_by_key, stats, user):
        person_by_key: dict[str, Person] = {}
        pending_parents: dict[str, tuple] = {}

        for raw in items:
            item = dict(raw)
            key = item.pop("key", None)
            father_key = item.pop("father", None)
            mother_key = item.pop("mother", None)
            burial_place_key = item.pop("burial_place", None)

            if burial_place_key and burial_place_key in place_by_key:
                item["burial_place"] = place_by_key[burial_place_key]
            elif burial_place_key:
                item.pop("burial_place", None)

            first_name = item.get("first_name", "")
            last_name = item.get("last_name", "")
            patronymic = item.get("patronymic", "")
            birth_date = item.get("birth_date") or None

            existing = Person.objects.filter(
                first_name=first_name, last_name=last_name,
                patronymic=patronymic, birth_date=birth_date,
            ).first()

            if existing:
                for field, val in item.items():
                    if field in ("first_name", "last_name", "patronymic", "birth_date"):
                        continue
                    if val not in (None, "", []):
                        setattr(existing, field, val)
                existing.updated_by = user
                existing.full_clean()
                existing.save()
                person_by_key[key or f"p_{existing.pk}"] = existing
                stats["persons_updated"] += 1
            else:
                person = Person(**item)
                person.created_by = user
                person.updated_by = user
                person.full_clean()
                person.save()
                person_by_key[key or f"p_{person.pk}"] = person
                stats["persons_created"] += 1

            actual_key = key or f"p_{(existing or person).pk}"
            pending_parents[actual_key] = (father_key, mother_key)

        # Pass 2: link parents
        for pkey, person in person_by_key.items():
            father_key, mother_key = pending_parents.get(pkey, (None, None))
            if not father_key and not mother_key:
                continue
            changed = False
            if father_key and father_key in person_by_key:
                person.father = person_by_key[father_key]
                changed = True
            if mother_key and mother_key in person_by_key:
                person.mother = person_by_key[mother_key]
                changed = True
            if changed:
                person.full_clean()
                person.save()

        return person_by_key

    def _import_unions(self, items, person_by_key, stats):
        for raw in items:
            item = dict(raw)
            p1_key = item.pop("person1", None)
            p2_key = item.pop("person2", None)
            if not p1_key or not p2_key:
                continue
            if p1_key not in person_by_key or p2_key not in person_by_key:
                continue

            person1 = person_by_key[p1_key]
            person2 = person_by_key[p2_key]
            date_start = item.get("date_start") or None

            pair = {person1.pk, person2.pk}
            existing = Union.objects.filter(
                person1_id__in=pair, person2_id__in=pair, date_start=date_start,
            ).first()

            if existing:
                for field in ("date_start_text", "date_end", "date_end_text", "status", "notes"):
                    val = item.get(field)
                    if val not in (None, ""):
                        setattr(existing, field, val)
                existing.full_clean()
                existing.save()
                stats["unions_updated"] += 1
            else:
                union = Union(
                    person1=person1, person2=person2,
                    date_start=date_start,
                    date_start_text=item.get("date_start_text", ""),
                    date_end=item.get("date_end"),
                    date_end_text=item.get("date_end_text", ""),
                    status=item.get("status", ""),
                    notes=item.get("notes", ""),
                )
                union.full_clean()
                union.save()
                stats["unions_created"] += 1


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
