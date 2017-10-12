import os

from django.conf import settings
from django.db import models
from django.core.exceptions import ValidationError

from .application import video_player, get_file_type


VALID_TYPES = ['mp4', 'webm', 'ogg']
UNSUPPORTED_ERROR = \
    'Unsupported file type. Supported types: %s' % ', '.join(VALID_TYPES)


def validate_video_type(value):
    ext = os.path.splitext(value.name)[1]  # [0] returns path+filename
    if not ext.lower().lstrip('.') in VALID_TYPES:
        raise ValidationError(UNSUPPORTED_ERROR)


class AbstractVideo(models.Model):
    '''
    Abstract parent class for a video, which requires the child class to
    provide either:
    1. A sources attribute returning a queryset of model instances each with a
    source and optionally mobile_source field; or
    2. A source and (optionally) mobile_source attributes

    This class provides:
    1. Defaults for the following video element properties, which can be
    overridden by a field or attribute of the same name on the child class:
    autoplay, loop, controls, muted
    2. A render_video method which will render a video based on the above
    properties and the source attributes provided by the child.

    Note that this class does not provide a poster image. Using a poster image
    is strongly recommended, and can be provided to render_video via the
    argument 'poster_markup'.

    eg.
    class TestVideo(Image, Video):
        loop = models.BooleanField(default=True)
        muted = models.BooleanField(default=True)

        @property
        def autoplay(self):
            return True

        @property
        def controls(self):
            return False

        def render_video(self, poster_dimensions, **kwargs):
            poster_markup = self.render_image(poster_dimensions, **kwargs)
            return super(TestVideo, self).render_video(
                poster_markup=poster_markup)
    '''
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
        if hasattr(self, 'sources') and self.sources.count():
            for source in self.sources.all():
                mobile_source = \
                    source.mobile_source.url if source.mobile_source else None
                sources.append((source.source.url, mobile_source, source.type))
        elif hasattr(self, 'source'):
            mobile_source = \
                self.mobile_source.url \
                if getattr(self, 'mobile_source', None) else ''
            file_type = 'video/%s' % get_file_type(self.source.url)
            sources.append((self.source.url, mobile_source, file_type))

        return video_player(sources, autoplay=autoplay, loop=loop,
                            controls=controls, muted=muted,
                            **kwargs)


class AbstractVideoSource(models.Model):
    '''
    Abstract parent class for a video source.
    '''
    source = models.FileField(upload_to=settings.UPLOAD_PATH,
                              validators=[validate_video_type])
    mobile_source = models.FileField(upload_to=settings.UPLOAD_PATH,
                                     validators=[validate_video_type],
                                     blank=True, null=True)

    @property
    def type(self):
        return 'video/%s' % get_file_type(self.source.url)

    class Meta:
        abstract = True

    def __str__(self):
        return str(self.source)


class Video(AbstractVideo):
    '''
    Convenience implementation of a basic AbstractVideo.

    See VideoSource below.
    '''
    def __str__(self):
        return str(self.sources.first())


class VideoSource(AbstractVideoSource):
    '''
    Convenience implementation of a basic AbstractVideoSource.

    An inline admin model is provided in ./admin.py that should be included as
    an inline of Video or its subclass (as applicable).
    '''
    video = models.ForeignKey(Video, related_name='sources')
