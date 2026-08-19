"""Add a giant layout-lab tree without touching the real family.

DESTRUCTIVE only for rows tagged notes=layout-lab. Romanovs / Loginovs /
Nelzins stay. DEBUG=True required.
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from logger.logger import py_logger

from ...layout_lab import LAB_NOTE, build_layout_lab
from ...models import Person, Union


class Command(BaseCommand):
    help = (
        "Delete previous layout-lab people and insert a giant synthetic tree "
        "covering every packer case. Does not wipe the real family."
    )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "Refusing to seed layout lab: DEBUG=False. "
                "seed_layout_lab is for local test databases only."
            )

        spec = build_layout_lab()

        with transaction.atomic():
            deleted_persons, _ = Person.objects.filter(notes=LAB_NOTE).delete()
            person_by_key = self._create_persons(spec["persons"])
            self._link_parents(person_by_key, spec["persons"])
            union_count = self._create_unions(spec["unions"], person_by_key)

        message = (
            f"Removed {deleted_persons} previous lab persons. "
            f"Seeded {len(person_by_key)} lab persons, {union_count} unions "
            f"(notes={LAB_NOTE})."
        )
        py_logger.success(message)
        self.stdout.write(self.style.SUCCESS(message))

    def _create_persons(self, items):
        person_by_key = {}
        for raw in items:
            item = {k: v for k, v in raw.items() if k not in ("key", "father", "mother")}
            person = Person(**item)
            person.full_clean()
            person.save()
            person_by_key[raw["key"]] = person
        return person_by_key

    def _link_parents(self, person_by_key, items):
        for raw in items:
            father_key = raw.get("father")
            mother_key = raw.get("mother")
            if not father_key and not mother_key:
                continue
            person = person_by_key[raw["key"]]
            person.father = person_by_key[father_key] if father_key else None
            person.mother = person_by_key[mother_key] if mother_key else None
            person.full_clean()
            person.save()

    def _create_unions(self, items, person_by_key):
        count = 0
        for raw in items:
            union = Union(
                person1=person_by_key[raw["person1"]],
                person2=person_by_key[raw["person2"]],
                date_start=raw.get("date_start"),
                date_start_text=raw.get("date_start_text", ""),
                date_end=raw.get("date_end"),
                date_end_text=raw.get("date_end_text", ""),
                status=raw.get("status", ""),
                notes=raw.get("notes", LAB_NOTE),
            )
            union.full_clean()
            union.save()
            count += 1
        return count
