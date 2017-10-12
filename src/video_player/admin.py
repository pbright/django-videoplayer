from django.contrib import admin

from .models import VideoSource
from .forms import VideoSourceForm


class VideoSourceInline(admin.StackedInline):
    model = VideoSource
    form = VideoSourceForm
    extra = 0
    min_num = 1
