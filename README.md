# django-videoplayer

A Django and ES6 Javascript video player app.

## Features at a glance

1. Lightweight, customisable wrapper around the video API;

2. Works around Chrome bugs where in certain circumstances requesting the video
can result in a pending request which never resolves (see [this bug
report](https://bugs.chromium.org/p/chromium/issues/detail?id=234779)
for example). One telltale sign of this is a "Waiting for available socket"
message;

3. Sizes the video player based on the poster image, avoiding difficulties with
determining video aspect ratio in responsive layouts;

4. Provides abstract models and a (Django or Jinja2 compatible) template
snippet for an HTML5 video element and its associated sources; and

5. Supports a mobile version of each video source.

## Requirements

- Python 2.7, 3.4 or 3.5
- Django 1.8+
- [Modernizr](https://modernizr.com/) (setclasses, touchevents, pointerevents).
  [[Download minimal build]](https://modernizr.com/download?csspointerevents-touchevents-setclasses)
- 'no-js' class on the html element. [[Modernizr docs]](https://modernizr.com/docs#no-js)


## Installation

1. Download the source from https://pypi.python.org/pypi/django-videoplayer/
   and run `python setup.py install`, or:

        > pip install django-videoplayer

2. Ensure that the `TEMPLATES` setting includes an entry with
`'APP_DIRS': True`, or copy `templates/videoplayer/videoplayer.html` to a
location where django.template.loader.get_template can find it.

3. TODO: Webpack

4. TODO: Static files


## How to Use

Import `AbstractVideo` and create a child model class. The child class must
implement `render_video`, which will typically call the parent's `render_video`
method passing it markup for a poster image via the `poster_markup` keyword
argument. The size and aspect ratio of the video element is determined by the
poster image.

The child model class can either define a `source` (and optionally a
`mobile_source`) field, or a `sources` reverse lookup where the related model defines a `source` (and optionally a `mobile_source`) field. The later case
is provided to support the video element having multiple source elements, and
the abstract class `AbstractVideoSource` is provided for this purpose.

AbstractVideo provides:
1. Defaults for the following video element properties, which can be
overridden by a field or attribute of the same name on the child class:
`autoplay`, `loop`, `controls`, `muted`
2. A `render_video` method. See templating section below.

Example minimal implementation supporting only a single source:

```
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

    def render_video(self, **kwargs):
        poster_markup = '<img src="%s" height="%d" width="%d" />' %
            (self.poster_image.url, self.img_height, self.img_width)
        return super(TestVideo, self).render_video(
            poster_markup=poster_markup)

    def __str__(self):
        return str(self.source)
```

Example implementation overriding some defaults and supporting multiple
sources:

```
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
        poster_markup = '<img src="%s" height="%d" width="%d" />' %
            (self.poster_image.url, self.img_height, self.img_width)
        return super(TestVideo, self).render_video(
            poster_markup=poster_markup)

    def __str__(self):
        return str(self.sources.first())

class VideoSource(AbstractVideoSource):
    video = models.ForeignKey(Video, related_name='sources')
```

To render the video, simple call `render_video` in your template.

Django example:
```
{{ video.render_video }}
```

Jinja2 example:
```
{{ video.render_video() }}
```

Lastly, amend your Javascript to instantiate a new VideoPlayer for each element with the class `.video-player`.

For example:
```
import {VideoPlayer} from './videoplayer/videoplayer';

for (let playerElement of document.body.getElementsByClassName('video-player')) {
  new VideoPlayer(playerElement);
}
```

TODO: replaceSrc and teardown explanation

TODO: Mobile style explanation, including hover

## Options

#### Javascript

TODO

#### SCSS

Colors can be defined by the following variables:  
`$video-background` (defaults to `#000`)  
`$video-controls-background` (defaults to `transparent`)  
`$video-controls-color` (defaults to `#fff`)  
`$video-controls-active-color` (defaults to `transparentize(#fff, .2)`)  
`$video-progress-track-background` (defaults to `$video-background`)  
`$video-progress-thumb-color` (defaults to `$video-controls-color)`  

Responsive breakpoints can be defined by the following variables:  
`$tablet-max` (defaults to `1280px`)  
`$phone-max` (defaults to `667px`)

A number of mixins are defined in `videoplayer.scss` which can also be
overridden on a case by case basis.
