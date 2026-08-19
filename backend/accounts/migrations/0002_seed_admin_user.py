"""Seed a permanent admin/admin superuser for local testing.

Idempotent: only creates the account if no user named "admin" exists yet, so
re-running migrate (or a later manual password change) never resets it.

Security note: admin/admin is an intentionally weak, well-known credential.
Fine for local dev / an internal family app that isn't deployed yet -- do
not carry this into a real internet-facing deployment without changing the
password or removing the account first.
"""
from django.contrib.auth.hashers import make_password
from django.db import migrations


def create_admin_user(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    if User.objects.filter(username="admin").exists():
        return
    User.objects.create(
        username="admin",
        password=make_password("admin"),
        is_staff=True,
        is_superuser=True,
        is_active=True,
    )


def remove_admin_user(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(username="admin").delete()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]
    operations = [migrations.RunPython(create_admin_user, remove_admin_user)]
