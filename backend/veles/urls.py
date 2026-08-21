from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from veles.spa import spa_view

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("genealogy.urls")),
]

if settings.DEBUG:
    # In production nginx serves /media and /static directly from shared
    # volumes; in local dev (no nginx) the Django dev server serves them.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
elif getattr(settings, "SERVE_SPA", False):
    # `static()` is a no-op when DEBUG is False; portable still needs /media.
    from django.views.static import serve as media_serve

    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            media_serve,
            {"document_root": settings.MEDIA_ROOT},
        ),
    ]

# Last: client-side routes. No-op 404 when SERVE_SPA is False (dev / Docker).
urlpatterns += [
    re_path(r"^(?P<rest>.*)$", spa_view),
]
