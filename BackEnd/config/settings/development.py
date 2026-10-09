"""NexAI – Development Settings"""
from .base import *  # noqa: F401, F403

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Use local file storage in dev (comment out to test with MinIO)
DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"

# Django Debug Toolbar
INSTALLED_APPS += ["debug_toolbar"]  # noqa: F405
MIDDLEWARE = ["debug_toolbar.middleware.DebugToolbarMiddleware"] + MIDDLEWARE  # noqa: F405
INTERNAL_IPS = ["127.0.0.1"]

# The SQL panel crashes (sqlparse >10k tokens) while pretty-printing bulk
# UPDATE/INSERT statements, turning successful responses into 500s.
# Disabled panels never run generate_stats — see debug_toolbar/middleware.py.
DEBUG_TOOLBAR_CONFIG = {
    "DISABLE_PANELS": {
        "debug_toolbar.panels.profiling.ProfilingPanel",
        "debug_toolbar.panels.redirects.RedirectsPanel",
        "debug_toolbar.panels.sql.SQLPanel",
    },
}

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Use SQLite for development to avoid PostgreSQL setup
DATABASES = {
    'default': {
        'ENGINE': 'core.db_backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
        'OPTIONS': {
            'timeout': 30,
            'init_command': 'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=30000; PRAGMA synchronous=NORMAL;',
        },
    }
}

# Use local memory cache instead of Redis for development
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# Use local memory channel layer for development
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer"
    }
}


CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_STORE_EAGER_RESULT = True

# trigger reload
