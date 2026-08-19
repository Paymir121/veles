from djoser.serializers import UserSerializer as DjoserUserSerializer
from rest_framework import serializers

from .models import User


class UserSerializer(DjoserUserSerializer):
    linked_person_id = serializers.SerializerMethodField()

    class Meta(DjoserUserSerializer.Meta):
        model = User
        fields = tuple(DjoserUserSerializer.Meta.fields) + ("linked_person_id",)

    def get_linked_person_id(self, obj):
        person = getattr(obj, "person", None)
        return person.pk if person is not None else None
