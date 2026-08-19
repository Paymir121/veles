from django.contrib import admin

from .models import BurialPlace, Person, Union

admin.site.register(BurialPlace)
admin.site.register(Person)
admin.site.register(Union)
