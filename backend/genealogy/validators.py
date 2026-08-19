"""Standalone validation functions for the genealogy models.

These are called from Person.clean() / Union.clean() rather than wired up
purely as field-level `validators=[...]` kwargs, because several of them
(status consistency, self-parent, ancestor cycle, Union duplicates) need to
reason about more than one field at once. Routing everything through
Model.clean() gives us a single source of truth that protects every write
path: DRF serializers (which call instance.clean() from validate()), the
Django admin (ModelForm.full_clean() calls it automatically), and any future
management command or script that calls full_clean() before saving.
"""
from __future__ import annotations

from django.core.exceptions import ValidationError

EXTRA_INFO_ALLOWED_KEYS = {"category", "title", "role", "date_from", "date_to", "description"}
EXTRA_INFO_REQUIRED_KEYS = {"category", "title"}
EXTRA_INFO_MAX_ITEMS = 100
EXTRA_INFO_STRING_MAX_LEN = 300
EXTRA_INFO_DESCRIPTION_MAX_LEN = 2000


def validate_person_status_consistency(person):
    """alive <=> no death/burial info; deceased plot details need a burial place."""
    if person.status == "alive":
        offending = [
            field_name
            for field_name, value in (
                ("burial_place", person.burial_place_id),
                ("burial_plot_details", person.burial_plot_details),
                ("death_date", person.death_date),
                ("death_date_text", person.death_date_text),
            )
            if value
        ]
        if offending:
            raise ValidationError(
                "A person marked 'alive' cannot have these fields set: "
                + ", ".join(offending)
            )
    elif person.status == "deceased":
        if person.burial_plot_details and not person.burial_place_id:
            raise ValidationError(
                "burial_plot_details requires burial_place to be set."
            )


def validate_no_self_parent(person):
    """A person cannot be listed as their own father/mother."""
    if person.pk is None:
        return
    if person.father_id == person.pk:
        raise ValidationError("A person cannot be their own father.")
    if person.mother_id == person.pk:
        raise ValidationError("A person cannot be their own mother.")


def validate_no_ancestor_cycle(person, max_depth=200):
    """Walk up from the proposed father/mother; error if we ever reach `person`.

    Both parent lines are walked breadth-first (a cycle can be introduced
    through either the father's or the mother's ancestry, not just a single
    straight line), one query per generation. `max_depth` is a safety valve
    against a corrupted/pathological graph, not a realistic limit for an
    actual family tree.
    """
    if person.pk is None:
        return

    Person = person.__class__
    frontier = {pid for pid in (person.father_id, person.mother_id) if pid}
    seen: set[int] = set()
    depth = 0

    while frontier and depth < max_depth:
        if person.pk in frontier:
            raise ValidationError("A person cannot be their own ancestor.")
        seen |= frontier
        rows = Person.objects.filter(pk__in=frontier).values_list("father_id", "mother_id")
        next_frontier: set[int] = set()
        for father_id, mother_id in rows:
            if father_id and father_id not in seen:
                next_frontier.add(father_id)
            if mother_id and mother_id not in seen:
                next_frontier.add(mother_id)
        frontier = next_frontier
        depth += 1


def validate_extra_info(value):
    """extra_info is a free-form timeline: list[dict] with a fixed key set.

    `category` is deliberately free text (not a fixed choices enum) -- the
    whole point is letting the user invent arbitrary categories (workplace,
    school, hobby, anything) without a schema change.
    """
    if not isinstance(value, list):
        raise ValidationError("extra_info must be a list.")
    if len(value) > EXTRA_INFO_MAX_ITEMS:
        raise ValidationError(
            f"extra_info cannot have more than {EXTRA_INFO_MAX_ITEMS} items."
        )

    for index, item in enumerate(value):
        if not isinstance(item, dict):
            raise ValidationError(f"extra_info[{index}] must be an object.")

        unknown_keys = set(item.keys()) - EXTRA_INFO_ALLOWED_KEYS
        if unknown_keys:
            raise ValidationError(
                f"extra_info[{index}] has unknown keys: {', '.join(sorted(unknown_keys))}."
            )

        for key in EXTRA_INFO_REQUIRED_KEYS:
            val = item.get(key)
            if not isinstance(val, str) or not val.strip():
                raise ValidationError(
                    f"extra_info[{index}].{key} is required and must be a non-empty string."
                )

        for key, val in item.items():
            if val is None:
                continue
            if not isinstance(val, str):
                raise ValidationError(f"extra_info[{index}].{key} must be a string.")
            max_len = (
                EXTRA_INFO_DESCRIPTION_MAX_LEN if key == "description" else EXTRA_INFO_STRING_MAX_LEN
            )
            if len(val) > max_len:
                raise ValidationError(
                    f"extra_info[{index}].{key} exceeds max length of {max_len}."
                )


def validate_image_max_size(file, max_mb=8):
    """Applied to both Person.photo and Person.grave_photo."""
    if file and file.size > max_mb * 1024 * 1024:
        raise ValidationError(f"Image file must not exceed {max_mb}MB.")
