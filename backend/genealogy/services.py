"""Plain functions, not ModelSerializers, for endpoints whose output shape
doesn't map 1:1 onto a single model -- easier to unit test directly.
"""
import re
from collections import defaultdict

from django.db.models import Case, IntegerField, Q, Value, When

from logger.logger import error_logger

from .models import Person, Union

# Free-text fields matched by /api/search/. The *_date_text fields are here
# (not only the real date fields) so "1920" also finds "около 1920".
PERSON_SEARCH_FIELDS = (
    "first_name",
    "last_name",
    "patronymic",
    "maiden_name",
    "birth_place",
    "birth_date_text",
    "death_date_text",
)
BURIAL_PLACE_SEARCH_FIELDS = ("name", "city", "address")

# Used for ranking only: a word hitting the person's own name counts for more
# than the same word hitting a secondary field.
PRIMARY_NAME_FIELDS = ("first_name", "last_name")

# Bounded so a pathological query can't build an unbounded OR tree: every
# token multiplies into len(fields) * len(spelling variants) conditions.
MAX_SEARCH_TOKENS = 5

_YEAR_RE = re.compile(r"^\d{4}$")


def _token_variants(token):
    """е and ё are typed interchangeably in Russian names, and both SQLite and
    Postgres treat them as distinct letters -- match either spelling."""
    lowered = token.lower()
    return {lowered, lowered.replace("ё", "е"), lowered.replace("е", "ё")}


def _token_q(token, fields):
    q = Q()
    for variant in _token_variants(token):
        for field in fields:
            q |= Q(**{f"{field}__icontains": variant})
    return q


def build_person_search_q(query):
    """Words are ANDed, fields and spellings are ORed: "Соколов Пётр" matches a
    person whose last_name matches one word and first_name the other, which a
    single icontains over the whole string never could. A 4-digit word also
    matches a birth/death year.

    An empty query yields an empty Q (matches everything) -- callers are
    expected to short-circuit before that, see SearchView.
    """
    combined = Q()
    for token in query.split()[:MAX_SEARCH_TOKENS]:
        token_q = _token_q(token, PERSON_SEARCH_FIELDS)
        if _YEAR_RE.match(token):
            year = int(token)
            token_q |= Q(birth_date__year=year) | Q(death_date__year=year)
        combined &= token_q
    return combined


def order_person_search(queryset, query):
    """Order matches by how many query words hit the person's own first or last
    name, then alphabetically.

    Without this, "Соколов Пётр" lists a Морозова whose maiden name is Соколова
    (a legitimate match on both words) above Соколов Пётр himself, purely
    because "Морозова" sorts first.
    """
    score = None
    for token in query.split()[:MAX_SEARCH_TOKENS]:
        matched = Case(
            When(_token_q(token, PRIMARY_NAME_FIELDS), then=Value(1)),
            default=Value(0),
            output_field=IntegerField(),
        )
        score = matched if score is None else score + matched
    if score is None:
        return queryset.order_by("last_name", "first_name")
    return queryset.annotate(name_match_count=score).order_by(
        "-name_match_count", "last_name", "first_name"
    )


def build_burial_place_search_q(query):
    """Same word-by-word AND as build_person_search_q, over place fields, so
    "Ваганьковское Москва" matches on name plus city."""
    combined = Q()
    for token in query.split()[:MAX_SEARCH_TOKENS]:
        combined &= _token_q(token, BURIAL_PLACE_SEARCH_FIELDS)
    return combined


@error_logger()
def serialize_tree(request):
    """Build the full family graph in family-chart's node shape.

    Exactly 2 queries regardless of family size: one full Person scan, one
    full Union scan. `persons` is a QuerySet iterated twice below; Django
    caches the results after the first full iteration, so the second loop
    reuses that cache instead of re-querying.
    """
    persons = Person.objects.all()

    children_of = defaultdict(list)
    for p in persons:
        if p.father_id:
            children_of[p.father_id].append(p.id)
        if p.mother_id:
            children_of[p.mother_id].append(p.id)

    spouses_of = defaultdict(list)
    for u in Union.objects.all():
        spouses_of[u.person1_id].append(u.person2_id)
        spouses_of[u.person2_id].append(u.person1_id)

    nodes = []
    for p in persons:
        # family-chart only accepts "M"/"F"; "U" falls back to "M" here,
        # cosmetically, for this endpoint only. The real value travels
        # alongside as gender_actual. The DB and every other endpoint keep
        # the real "U". Documented tradeoff -- do not "fix" by dropping
        # gender_actual or changing the fallback target.
        gender = p.gender if p.gender in ("M", "F") else "M"
        nodes.append(
            {
                "id": str(p.id),
                "data": {
                    "first_name": p.first_name,
                    "last_name": p.last_name,
                    "patronymic": p.patronymic,
                    "gender": gender,
                    "gender_actual": p.gender,
                    "birth_date": p.birth_date_text or (p.birth_date.isoformat() if p.birth_date else ""),
                    "death_date": p.death_date_text or (p.death_date.isoformat() if p.death_date else ""),
                    "status": p.status,
                    "avatar": p.photo.url if p.photo else None,
                },
                "rels": {
                    "parents": [str(i) for i in (p.father_id, p.mother_id) if i],
                    "spouses": [str(i) for i in spouses_of.get(p.id, [])],
                    "children": [str(i) for i in children_of.get(p.id, [])],
                },
            }
        )
    return nodes
