from json import dumps

from django.template.loader import get_template
from django.utils.safestring import mark_safe


def videoplayer(sources, poster_markup='', autoplay=False, loop=False,
                controls=True, caption='', preload='none', classes='',
                muted=False, playsinline=False, autoplay_min_width=0,
                **kwargs):
    """
    Renders a video player with the markup expected by videoplayer.js and
    videoplayer.scss.

    Sources is an iterable of (desktop_src, mobile_src, video_type) tuples,
    where mobile_src is optional. For example:

    from videoplayer.models import get_file_type

    sources = []
    for film in films:
        mobile_source = None
        if video.mobile_source:
            mobile_source = video.mobile_source.url
        sources.append((video.source.url, mobile_source,
                        get_file_type(video.source.url)))
    """
    for desktop, mobile, video_type in sources:
        assert desktop
        assert video_type

    result = get_template('videoplayer/videoplayer.html').render({
        'sources': sources,
        'poster_markup': poster_markup,
        'autoplay': autoplay,
        'loop': loop,
        'controls': controls,
        'preload': preload,
        'muted': muted,
        'caption': caption,
        'playsinline': playsinline,
        'autoplay_min_width': autoplay_min_width,
        'classes': classes
    })
    return mark_safe(result)


def video_json(sources, poster_markup='', autoplay=False, loop=False,
               controls=True, caption='', preload='none', classes='',
               muted=False, playsinline=False, autoplay_min_width=0, **kwargs):
    """
    Returns a JSON object representing a video.

    Sources is an iterable of (desktop_src, mobile_src, video_type) tuples,
    where mobile_src is optional. For example:

    from videoplayer.models import get_file_type

    sources = []
    for film in films:
        mobile_source = None
        if video.mobile_source:
            mobile_source = video.mobile_source.url
        sources.append((video.source.url, mobile_source,
                        get_file_type(video.source.url)))
    """
    for desktop, mobile, video_type in sources:
        assert desktop
        assert video_type

    data = {
        'sources': sources,
        'poster_markup': poster_markup,
        'autoplay': autoplay,
        'loop': loop,
        'controls': controls,
        'preload': preload,
        'muted': muted,
        'caption': caption,
        'playsinline': playsinline,
        'classes': classes
    }

    if autoplay_min_width:
        data['autoplay_min_width'] = autoplay_min_width

    return dumps(data)
