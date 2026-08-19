"""Plain functions, not ModelSerializers, for endpoints whose output shape
doesn't map 1:1 onto a single model -- easier to unit test directly.
"""
from collections import defaultdict

from logger.logger import error_logger

from .models import Person, Union


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
                    "avatar": request.build_absolute_uri(p.photo.url) if p.photo else None,
                },
                "rels": {
                    "parents": [str(i) for i in (p.father_id, p.mother_id) if i],
                    "spouses": [str(i) for i in spouses_of.get(p.id, [])],
                    "children": [str(i) for i in children_of.get(p.id, [])],
                },
            }
        )
    return nodes
