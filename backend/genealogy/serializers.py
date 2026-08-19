from django.core.exceptions import ValidationError as DjangoValidationError
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
            "death_date",
            "death_date_text",
            "photo",
        ]


class PersonSerializer(serializers.ModelSerializer):
    # Declared explicitly (not just relying on DRF auto-picking up the model
    # field's validators) so the shape rule is visible on the serializer.
    extra_info = serializers.JSONField(validators=[validate_extra_info], required=False)

    class Meta:
        model = Person
        fields = "__all__"
        read_only_fields = ["created_by", "updated_by", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")

        linked_user = attrs.get("linked_user")
        if linked_user is not None:
            if request is None or linked_user != request.user:
                raise serializers.ValidationError(
                    {"linked_user": "You may only link your own account to a person."}
                )

        merged = _build_merged_instance(Person, self.instance, attrs)
        try:
            merged.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(_translate_django_error(exc))

        return attrs


class BurialPlaceSerializer(serializers.ModelSerializer):
    # Reverse accessor Person.burial_place -> related_name="persons".
    persons = PersonListSerializer(many=True, read_only=True)

    class Meta:
        model = BurialPlace
        fields = "__all__"


class UnionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Union
        fields = "__all__"

    def validate(self, attrs):
        merged = _build_merged_instance(Union, self.instance, attrs)
        try:
            merged.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(_translate_django_error(exc))
        return attrs
