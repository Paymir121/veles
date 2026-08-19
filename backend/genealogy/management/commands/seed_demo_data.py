"""Reset and reseed demo/family-tree data for local development and testing.

DESTRUCTIVE ON PURPOSE: every run wipes all existing Person/BurialPlace/Union
rows and reloads them fresh from genealogy/fixtures/demo_data.json (plain,
human-editable JSON -- persons and burial places reference each other by a
short string "key", not by database id, since ids don't exist yet when the
file is written). This is meant for a test/dev database that gets reset
often, not for a real deployment -- refuses to run unless DEBUG=True as a
guard rail against wiping real data on a live instance. Does not touch the
User table (the seeded admin/admin login survives a reseed).
"""
import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from logger.logger import py_logger

from ...models import BurialPlace, Person, Union

DATA_FILE = Path(__file__).resolve().parent.parent.parent / "fixtures" / "demo_data.json"


class Command(BaseCommand):
    help = (
        "Wipe Person/BurialPlace/Union and reload them from "
        "genealogy/fixtures/demo_data.json. Test/dev only -- refuses to run if DEBUG=False."
    )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError(
                "Refusing to wipe data: DEBUG=False. seed_demo_data is destructive and "
                "meant for test/dev databases only."
            )

        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))

        with transaction.atomic():
            # Order matters for a clean wipe even though the FKs would also
            # handle it (Union.person1/2 CASCADE, Person.father/mother
            # SET_NULL): deleting Person first cascades away every Union in
            # one query instead of relying on that as a side effect.
            _, person_delete_counts = Person.objects.all().delete()
            _, place_delete_counts = BurialPlace.objects.all().delete()
            deleted_persons = person_delete_counts.get("genealogy.Person", 0)
            deleted_unions = person_delete_counts.get("genealogy.Union", 0)
            deleted_places = place_delete_counts.get("genealogy.BurialPlace", 0)

            place_by_key = self._create_burial_places(data.get("burial_places", []))
            person_by_key, pending_parents = self._create_persons(
                data.get("persons", []), place_by_key
            )
            self._link_parents(person_by_key, pending_parents)
            union_count = self._create_unions(data.get("unions", []), person_by_key)

        message = (
            f"Wiped {deleted_persons} persons / {deleted_unions} unions / "
            f"{deleted_places} burial places. Reseeded {len(person_by_key)} persons, "
            f"{len(place_by_key)} burial places, {union_count} unions from {DATA_FILE.name}."
        )
        py_logger.success(message)
        self.stdout.write(self.style.SUCCESS(message))

    def _create_burial_places(self, items):
        place_by_key = {}
        for raw in items:
            item = dict(raw)
            key = item.pop("key")
            item.pop("_comment", None)
            place = BurialPlace(**item)
            place.full_clean()
            place.save()
            place_by_key[key] = place
        return place_by_key

    def _create_persons(self, items, place_by_key):
        # Pass 1: create every person without father/mother, since a child
        # can appear before its parents in the file. burial_place can be
        # resolved immediately -- burial places have no forward references.
        person_by_key = {}
        pending_parents = {}
        for raw in items:
            item = dict(raw)
            key = item.pop("key")
            father_key = item.pop("father", None)
            mother_key = item.pop("mother", None)
            burial_place_key = item.pop("burial_place", None)
            if burial_place_key:
                item["burial_place"] = place_by_key[burial_place_key]

            person = Person(**item)
            person.full_clean()
            person.save()

            person_by_key[key] = person
            pending_parents[key] = (father_key, mother_key)

        return person_by_key, pending_parents

    def _link_parents(self, person_by_key, pending_parents):
        # Pass 2: now that every person has a real pk, wire up father/mother
        # and re-validate (this is also what exercises the ancestor-cycle
        # check against the actual data, not just at API-write time).
        for key, person in person_by_key.items():
            father_key, mother_key = pending_parents[key]
            if not father_key and not mother_key:
                continue
            person.father = person_by_key[father_key] if father_key else None
            person.mother = person_by_key[mother_key] if mother_key else None
            person.full_clean()
            person.save()

    def _create_unions(self, items, person_by_key):
        count = 0
        for raw in items:
            item = dict(raw)
            union = Union(
                person1=person_by_key[item["person1"]],
                person2=person_by_key[item["person2"]],
                date_start=item.get("date_start"),
                date_start_text=item.get("date_start_text", ""),
                date_end=item.get("date_end"),
                date_end_text=item.get("date_end_text", ""),
                status=item.get("status", ""),
                notes=item.get("notes", ""),
            )
            union.full_clean()
            union.save()
            count += 1
        return count
