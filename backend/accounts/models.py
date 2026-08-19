from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Deliberately empty.

    Having our own AUTH_USER_MODEL from the very first migration is what
    keeps it swappable -- adding fields later is a cheap migration, but
    switching away from django.contrib.auth.models.User after the fact would
    require an early, painful migration. There is nothing project-specific
    to add yet (the tree is shared by all authenticated users, no roles).
    """

    pass
