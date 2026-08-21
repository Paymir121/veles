from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from rest_framework import serializers

from .models import BurialPlace, Person, Union
from .validators import validate_extra_info


def _build_merged_instance(model_cls, instance, attrs):
    """Build an in-memory instance reflecting `instance` (if any) with
    `attrs` applied on top, so we can call .clean() against the *resulting*
    state without touching the database or mutating `instance` early.

    Existing values are copied by attname (e.g. "father_id") to avoid extra
    queries; incoming attrs are applied by field name so FK values already
    resolved to model instances by DRF (e.g. attrs["father"] = <Person>) are
    assigned correctly rather than being treated as raw ids.
    """
    merged = model_cls(pk=instance.pk) if instance is not None else model_cls()
    if instance is not None:
        for field in instance._meta.fields:
            setattr(merged, field.attname, getattr(instance, field.attname))
    for key, value in attrs.items():
        setattr(merged, key, value)
    return merged


def _translate_django_error(exc: DjangoValidationError):
    if hasattr(exc, "error_dict"):
        return exc.message_dict
    return exc.messages


class BurialPlaceBriefSerializer(serializers.ModelSerializer):
    """Place without its nested persons -- safe to embed inside a person (the
    full BurialPlaceSerializer nests persons, which would recurse)."""

    class Meta:
        model = BurialPlace
        fields = ["id", "name", "city", "latitude", "longitude"]


class PersonListSerializer(serializers.ModelSerializer):
    """Lightweight Person representation for nesting (BurialPlace.persons,
    /api/search/ results) -- avoids shipping extra_info/notes everywhere."""

    class Meta:
        model = Person
        fields = [
            "id",
            "first_name",
            "last_name",
            "patronymic",
            "maiden_name",
            "gender",
            "status",
            "birth_date",
            "birth_date_text",
            "birth_place",
            "death_date",
            "death_date_text",
            "photo",
        ]


class PersonSearchSerializer(PersonListSerializer):
    """Search hit: adds the person's burial place inline so the map can fly to
    a person straight from a search result, without a second request.

    Deliberately named `burial_place_detail`, not `burial_place`: the latter is
    a plain id everywhere else, and one key with two shapes across endpoints is
    exactly the kind of thing clients get wrong.
    """

    burial_place_detail = BurialPlaceBriefSerializer(source="burial_place", read_only=True)

    class Meta(PersonListSerializer.Meta):
        fields = PersonListSerializer.Meta.fields + ["burial_place_detail"]


class PersonSerializer(serializers.ModelSerializer):
    extra_info = serializers.JSONField(validators=[validate_extra_info], required=False)
    children = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        required=False,
    )
    spouses = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        required=False,
    )
    force_children_reassign = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = Person
        fields = [
            "id",
            "first_name",
            "last_name",
            "patronymic",
            "maiden_name",
            "gender",
            "birth_date",
            "birth_date_text",
            "birth_place",
            "status",
            "death_date",
            "death_date_text",
            "father",
            "mother",
            "burial_place",
            "burial_plot_details",
            "photo",
            "grave_photo",
            "extra_info",
            "notes",
            "children",
            "spouses",
            "force_children_reassign",
            "linked_user",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_by", "updated_by", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")

        linked_user = attrs.get("linked_user")
        if linked_user is not None:
            if request is None or linked_user != request.user:
                raise serializers.ValidationError(
                    {"linked_user": "You may only link your own account to a person."}
                )
            if self.instance is not None and self.instance.linked_user_id not in (None, request.user.pk):
                raise serializers.ValidationError(
                    {"linked_user": "This person is already linked to another account."}
                )

        attrs = self._validate_children(attrs)
        attrs = self._validate_spouses(attrs)

        merged = _build_merged_instance(Person, self.instance, attrs)
        try:
            merged.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(_translate_django_error(exc))

        return attrs

    def _validate_children(self, attrs):
        children_ids = attrs.get("children")
        if children_ids is None:
            return attrs

        unique_ids = list(dict.fromkeys(children_ids))
        attrs["children"] = unique_ids
        if not unique_ids:
            return attrs

        gender = attrs.get("gender")
        if gender is None and self.instance is not None:
            gender = self.instance.gender
        if gender not in ("M", "F"):
            raise serializers.ValidationError(
                {"children": "Choose a male or female gender before assigning children."}
            )

        children = list(Person.objects.filter(pk__in=unique_ids).order_by("pk"))
        found_ids = {child.pk for child in children}
        missing = [child_id for child_id in unique_ids if child_id not in found_ids]
        if missing:
            raise serializers.ValidationError(
                {"children": f"Unknown child ids: {', '.join(str(child_id) for child_id in missing)}"}
            )

        if self.instance is not None and self.instance.pk in found_ids:
            raise serializers.ValidationError(
                {"children": "A person cannot be their own child."}
            )

        target_field = "father" if gender == "M" else "mother"
        current_person_id = self.instance.pk if self.instance is not None else None
        force_reassign = attrs.get("force_children_reassign", False)
        conflicts = []
        for child in children:
            current_parent_id = getattr(child, f"{target_field}_id")
            if current_parent_id is None or current_parent_id == current_person_id:
                continue
            conflicts.append(
                {
                    "id": child.pk,
                    "name": str(child),
                    "field": target_field,
                    "current_parent_id": current_parent_id,
                }
            )

        if conflicts and not force_reassign:
            raise serializers.ValidationError(
                {
                    "children": "Some selected children already have this parent field filled.",
                    "children_conflicts": conflicts,
                }
            )

        attrs["_resolved_children"] = children
        attrs["_children_parent_field"] = target_field
        return attrs

    def _validate_spouses(self, attrs):
        spouse_ids = attrs.get("spouses")
        if spouse_ids is None:
            return attrs

        unique_ids = list(dict.fromkeys(spouse_ids))
        attrs["spouses"] = unique_ids

        if self.instance is not None and self.instance.pk in unique_ids:
            raise serializers.ValidationError(
                {"spouses": "A person cannot be married to themselves."}
            )

        spouses = list(Person.objects.filter(pk__in=unique_ids).order_by("pk"))
        found_ids = {spouse.pk for spouse in spouses}
        missing = [spouse_id for spouse_id in unique_ids if spouse_id not in found_ids]
        if missing:
            raise serializers.ValidationError(
                {"spouses": f"Unknown spouse ids: {', '.join(str(spouse_id) for spouse_id in missing)}"}
            )

        attrs["_resolved_spouses"] = spouses
        return attrs

    def _save_children(self, person, validated_data):
        children = validated_data.pop("_resolved_children", None)
        target_field = validated_data.pop("_children_parent_field", None)
        validated_data.pop("force_children_reassign", None)
        if children is None or target_field is None:
            return

        selected_ids = {child.pk for child in children}
        if target_field == "father":
            current_children = Person.objects.filter(father=person).exclude(pk__in=selected_ids)
            for child in current_children:
                child.father = None
                child.full_clean()
                child.save(update_fields=["father"])
        else:
            current_children = Person.objects.filter(mother=person).exclude(pk__in=selected_ids)
            for child in current_children:
                child.mother = None
                child.full_clean()
                child.save(update_fields=["mother"])

        for child in children:
            setattr(child, target_field, person)
            child.full_clean()
            child.save(update_fields=[target_field])

    def _save_spouses(self, person, validated_data):
        spouses = validated_data.pop("_resolved_spouses", None)
        if spouses is None:
            return

        wanted_ids = {spouse.pk for spouse in spouses}
        existing = Union.objects.filter(Q(person1=person) | Q(person2=person))
        existing_partners: dict[int, list[Union]] = {}
        for union in existing:
            other_id = union.person2_id if union.person1_id == person.pk else union.person1_id
            existing_partners.setdefault(other_id, []).append(union)

        for other_id, unions in existing_partners.items():
            if other_id not in wanted_ids:
                for union in unions:
                    union.delete()

        for spouse in spouses:
            if spouse.pk in existing_partners:
                continue
            union = Union(person1=person, person2=spouse)
            union.full_clean()
            union.save()

    def _normalize_linked_user(self, person, validated_data):
        linked_user = validated_data.get("linked_user", serializers.empty)
        if linked_user in (serializers.empty, None):
            return
        Person.objects.filter(linked_user=linked_user).exclude(pk=person.pk).update(linked_user=None)

    @transaction.atomic
    def create(self, validated_data):
        validated_data.pop("children", None)
        validated_data.pop("spouses", None)
        children = validated_data.pop("_resolved_children", None)
        target_field = validated_data.pop("_children_parent_field", None)
        spouses = validated_data.pop("_resolved_spouses", None)
        validated_data.pop("force_children_reassign", None)
        linked_user = validated_data.get("linked_user", serializers.empty)
        if linked_user not in (serializers.empty, None):
            Person.objects.filter(linked_user=linked_user).update(linked_user=None)
        person = super().create(validated_data)
        if children is not None and target_field is not None:
            validated_data["_resolved_children"] = children
            validated_data["_children_parent_field"] = target_field
        if spouses is not None:
            validated_data["_resolved_spouses"] = spouses
        self._save_children(person, validated_data)
        self._save_spouses(person, validated_data)
        return person

    @transaction.atomic
    def update(self, instance, validated_data):
        validated_data.pop("children", None)
        validated_data.pop("spouses", None)
        children = validated_data.pop("_resolved_children", None)
        target_field = validated_data.pop("_children_parent_field", None)
        spouses = validated_data.pop("_resolved_spouses", None)
        validated_data.pop("force_children_reassign", None)
        linked_user = validated_data.get("linked_user", serializers.empty)
        if linked_user not in (serializers.empty, None):
            Person.objects.filter(linked_user=linked_user).exclude(pk=instance.pk).update(linked_user=None)
        person = super().update(instance, validated_data)
        if children is not None and target_field is not None:
            validated_data["_resolved_children"] = children
            validated_data["_children_parent_field"] = target_field
        if spouses is not None:
            validated_data["_resolved_spouses"] = spouses
        self._save_children(person, validated_data)
        self._save_spouses(person, validated_data)
        return person


class PersonRelationSerializer(PersonListSerializer):
    class Meta(PersonListSerializer.Meta):
        fields = PersonListSerializer.Meta.fields


class PersonDetailSerializer(PersonSerializer):
    children = serializers.SerializerMethodField()
    siblings = serializers.SerializerMethodField()
    spouses = serializers.SerializerMethodField()

    class Meta(PersonSerializer.Meta):
        fields = PersonSerializer.Meta.fields + ["siblings"]

    def get_children(self, obj):
        queryset = (
            Person.objects.filter(Q(father=obj) | Q(mother=obj))
            .order_by("last_name", "first_name")
            .distinct()
        )
        return PersonRelationSerializer(queryset, many=True, context=self.context).data

    def get_spouses(self, obj):
        partner_ids = []
        seen = set()
        unions = Union.objects.filter(Q(person1=obj) | Q(person2=obj)).order_by("pk")
        for union in unions:
            other_id = union.person2_id if union.person1_id == obj.pk else union.person1_id
            if other_id in seen:
                continue
            seen.add(other_id)
            partner_ids.append(other_id)
        if not partner_ids:
            return []
        by_id = {
            person.pk: person
            for person in Person.objects.filter(pk__in=partner_ids)
        }
        ordered = [by_id[partner_id] for partner_id in partner_ids if partner_id in by_id]
        return PersonRelationSerializer(ordered, many=True, context=self.context).data

    def get_siblings(self, obj):
        filters = Q()
        if obj.father_id:
            filters |= Q(father_id=obj.father_id)
        if obj.mother_id:
            filters |= Q(mother_id=obj.mother_id)
        if not filters:
            return []
        queryset = (
            Person.objects.filter(filters)
            .exclude(pk=obj.pk)
            .order_by("last_name", "first_name")
            .distinct()
        )
        return PersonRelationSerializer(queryset, many=True, context=self.context).data


class BurialPlaceSerializer(serializers.ModelSerializer):
    persons = PersonListSerializer(many=True, read_only=True)

    class Meta:
        model = BurialPlace
        fields = [
            "id",
            "name",
            "city",
            "latitude",
            "longitude",
            "address",
            "description",
            "persons",
            "created_at",
            "updated_at",
        ]


class UnionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Union
        fields = [
            "id",
            "person1",
            "person2",
            "date_start",
            "date_start_text",
            "date_end",
            "date_end_text",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        merged = _build_merged_instance(Union, self.instance, attrs)
        try:
            merged.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(_translate_django_error(exc))
        return attrs
