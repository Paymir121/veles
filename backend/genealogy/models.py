from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q

from .validators import (
    validate_extra_info,
    validate_image_max_size,
    validate_no_ancestor_cycle,
    validate_no_self_parent,
    validate_person_status_consistency,
)


class BurialPlace(models.Model):
    """A cemetery/burial site. Reused across people so relatives buried in
    the same place cluster together on the map."""

    name = models.CharField(max_length=255, blank=True)
    # Dedicated field (not parsed out of `address`) so "search by city" is a
    # simple indexed exact/icontains query.
    city = models.CharField(max_length=150, blank=True, db_index=True)
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    address = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(latitude__isnull=True, longitude__isnull=True)
                    | Q(latitude__isnull=False, longitude__isnull=False)
                ),
                name="burialplace_lat_lon_both_or_neither",
            ),
        ]
        ordering = ["city", "name"]

    def __str__(self):
        return self.name or self.city or f"BurialPlace #{self.pk}"


class Person(models.Model):
    GENDER_CHOICES = [("M", "Male"), ("F", "Female"), ("U", "Unknown")]
    STATUS_CHOICES = [("alive", "Alive"), ("deceased", "Deceased")]

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    patronymic = models.CharField(max_length=150, blank=True)
    maiden_name = models.CharField(max_length=150, blank=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default="U")

    birth_date = models.DateField(null=True, blank=True)
    # Free-text fallback for imprecise dates ("около 1920").
    birth_date_text = models.CharField(max_length=255, blank=True)
    birth_place = models.CharField(max_length=255, blank=True)

    # No default: the user must explicitly choose alive/deceased on create.
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)

    death_date = models.DateField(null=True, blank=True)
    death_date_text = models.CharField(max_length=255, blank=True)

    father = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children_as_father",
    )
    mother = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children_as_mother",
    )

    burial_place = models.ForeignKey(
        BurialPlace,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="persons",
    )
    burial_plot_details = models.CharField(max_length=255, blank=True)

    # Both explicitly optional -- "photos are wanted but not required".
    photo = models.ImageField(
        upload_to="photos/%Y/%m/",
        null=True,
        blank=True,
        validators=[validate_image_max_size],
    )
    grave_photo = models.ImageField(
        upload_to="grave_photos/%Y/%m/",
        null=True,
        blank=True,
        validators=[validate_image_max_size],
    )

    extra_info = models.JSONField(default=list, blank=True, validators=[validate_extra_info])
    notes = models.TextField(blank=True)

    linked_user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="person",
    )
    # Audit only -- NOT used for access control, the tree is shared by all
    # authenticated users.
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_persons",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="updated_persons",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["last_name", "first_name"]

    def __str__(self):
        full_name = f"{self.last_name} {self.first_name}".strip()
        return full_name or f"Person #{self.pk}"

    def clean(self):
        super().clean()
        errors: dict[str, list[str]] = {}

        for validator in (
            validate_person_status_consistency,
            validate_no_self_parent,
            validate_no_ancestor_cycle,
        ):
            try:
                validator(self)
            except ValidationError as exc:
                errors.setdefault("__all__", []).extend(exc.messages)

        try:
            validate_extra_info(self.extra_info)
        except ValidationError as exc:
            errors.setdefault("extra_info", []).extend(exc.messages)

        if errors:
            raise ValidationError(errors)


class Union(models.Model):
    """A marriage/partnership between two Persons.

    Modeled separately from Person (rather than a single `spouse` FK)
    because family-chart, and real families, support multiple spouses per
    person over time (divorce + remarriage).
    """

    STATUS_CHOICES = [
        ("married", "Married"),
        ("divorced", "Divorced"),
        ("widowed", "Widowed"),
        ("partnership", "Partnership"),
    ]

    person1 = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="unions_as_person1")
    person2 = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="unions_as_person2")

    date_start = models.DateField(null=True, blank=True)
    date_start_text = models.CharField(max_length=255, blank=True)
    date_end = models.DateField(null=True, blank=True)
    date_end_text = models.CharField(max_length=255, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, blank=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=~Q(person1=F("person2")),
                name="union_no_self_marriage",
            ),
        ]

    def __str__(self):
        return f"Union #{self.pk}: {self.person1_id} + {self.person2_id}"

    def clean(self):
        super().clean()
        errors: dict[str, list[str]] = {}

        if self.person1_id and self.person2_id and self.person1_id == self.person2_id:
            errors.setdefault("__all__", []).append("A person cannot be married to themselves.")
        elif self.person1_id and self.person2_id:
            pair = {self.person1_id, self.person2_id}
            duplicate_exists = (
                Union.objects.filter(
                    person1_id__in=pair,
                    person2_id__in=pair,
                    date_start=self.date_start,
                )
                .exclude(pk=self.pk)
                .exists()
            )
            if duplicate_exists:
                errors.setdefault("__all__", []).append(
                    "This union (same couple and start date) already exists."
                )

        if errors:
            raise ValidationError(errors)
