import os

from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError

from .application import videoplayer


VALID_TYPES = ['mp4', 'webm', 'ogg']
UNSUPPORTED_ERROR = \
    'Unsupported file type. Supported types: %s' % ', '.join(VALID_TYPES)


def validate_video_type(value):
    ext = os.path.splitext(value.name)[1]  # [0] returns path+filename
    if not ext.lower().lstrip('.') in VALID_TYPES:
        raise ValidationError(UNSUPPORTED_ERROR)


def get_file_type(path):
    ext = os.path.splitext(path)[1].split('?')[0]
    return ext.lstrip('.').lower()


class AbstractVideo(models.Model):
    """
    Abstract parent class for a video. Requires the child class to either
    define get_source, get_mobile_source, and get_type methods, or to define
    a get_sources method that return an iterable of objects each of which
    has those methods.

    This class provides:
    1. Defaults for the following video element properties, which can be
    overridden by a field or attribute of the same name on the child class:
    autoplay, loop, controls, muted
    2. A render_video method which will render a video based on the above
    properties and the source (and mobile_source if present) attribute on
    self.sources or (if self.sources not present) self.

    Note that this class does not provide a poster image. Using a poster image
    is required in the default implementation as it is used to determine the
    aspect ratio of the video, and can be provided to render_video via the
    poster_markup keyword argument.

    Minimal implementation example:

    from videoplayer.models import \
        AbstractVideo, validate_video_type, get_file_type

    class TestVideo(AbstractVideo):
        img_height = models.PositiveSmallIntegerField(null=True, blank=True,
                                                      editable=False)
        img_width = models.PositiveSmallIntegerField(null=True, blank=True,
                                                     editable=False)
        poster_image = models.ImageField(upload_to=settings.UPLOAD_PATH,
                                         width_field='img_width',
                                         height_field='img_height')

        source = models.FileField(upload_to=settings.UPLOAD_PATH,
                                  validators=[validate_video_type])
        mobile_source = models.FileField(upload_to=settings.UPLOAD_PATH,
                                         validators=[validate_video_type],
                                         blank=True, null=True)

        loop = models.BooleanField(default=True)
        muted = models.BooleanField(default=True)

        @property
        def autoplay(self):
            return True

        @property
        def controls(self):
            return False

        def get_source(self):
            return self.source.url

        def get_mobile_source(self):
            return self.mobile_source.url

        def get_type(self):
            return 'video/%s' % get_file_type(self.source.url)

        def render_video(self, **kwargs):
            poster_markup = '<img src="%s" height="%d" width="%d" />' % (
                self.poster_image.url, self.img_height, self.img_width)
            return super(TestVideo, self).render_video(
                poster_markup=poster_markup)

        def __str__(self):
            return str(self.source)
    """

    class Meta:
        abstract = True

    def get_autoplay(self):
        return getattr(self, 'autoplay', False)

    def get_loop(self):
        return getattr(self, 'loop', False)

    def get_controls(self):
        return getattr(self, 'controls', True)

    def get_muted(self):
        return getattr(self, 'muted', False)

    def render_video(self, **kwargs):
        autoplay = kwargs.pop('autoplay', self.get_autoplay())
        loop = kwargs.pop('loop', self.get_loop())
        controls = kwargs.pop('controls', self.get_controls())
        muted = kwargs.pop('muted', self.get_muted())

        sources = []
        if hasattr(self, 'get_sources'):
            for source_obj in self.get_sources():
                mobile_source = \
                    source_obj.get_mobile_source() \
                    if hasattr(source_obj, 'get_mobile_source') \
                    else ''
                source = \
                    source_obj.get_source() \
                    if hasattr(source_obj, 'get_source') \
                    else ''
                source_type = \
                    source_obj.get_type() \
                    if hasattr(source_obj, 'get_type') \
                    else ''
                sources.append((source, mobile_source, source_type))
        else:
            mobile_source = \
                self.get_mobile_source() \
                if hasattr(self, 'get_mobile_source') \
                else ''
            source = \
                self.get_source() \
                if hasattr(self, 'get_source') \
                else ''
            source_type = \
                self.get_type() \
                if hasattr(self, 'get_type') \
                else ''
            sources.append((source, mobile_source, source_type))

        return videoplayer(sources, autoplay=autoplay, loop=loop,
                           controls=controls, muted=muted,
                           **kwargs)


class AbstractVideoSource(models.Model):
    """
    Abstract parent class for a video source.

    Minimal implementation example:

    from videoplayer.models import AbstractVideo, AbstractVideoSource

    class TestVideo(AbstractVideo):
        img_height = models.PositiveSmallIntegerField(null=True, blank=True,
                                                      editable=False)
        img_width = models.PositiveSmallIntegerField(null=True, blank=True,
                                                     editable=False)
        poster_image = models.ImageField(upload_to=settings.UPLOAD_PATH,
                                         width_field='img_width',
                                         height_field='img_height')

        autoplay = models.BooleanField(default=True)
        loop = models.BooleanField(default=True)

        @property
        def muted(self):
            return not self.autoplay

        @property
        def controls(self):
            if self.autoplay and self.loop:
                return False
            return True

        def render_video(self, **kwargs):
            poster_markup = '<img src="%s" height="%d" width="%d" />' % (
                self.poster_image.url, self.img_height, self.img_width)
            return super(TestVideo, self).render_video(
                poster_markup=poster_markup)

        def __str__(self):
            return str(self.sources.first())

    class VideoSource(AbstractVideoSource):
        video = models.ForeignKey(Video, related_name='sources')
    """
    source = models.FileField(upload_to=settings.UPLOAD_PATH,
                              validators=[validate_video_type])
    mobile_source = models.FileField(upload_to=settings.UPLOAD_PATH,
                                     validators=[validate_video_type],
                                     blank=True, null=True)

    def get_source(self):
        return self.source.url

    def get_mobile_source(self):
        return self.mobile_source.url if self.mobile_source else ''

    def get_type(self):
        return 'video/%s' % get_file_type(self.source.url)

    class Meta:
        abstract = True
