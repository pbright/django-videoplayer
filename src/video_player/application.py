import os

from django.template.loader import get_template
from django.utils.safestring import mark_safe


def get_file_type(path):
    ext = os.path.splitext(path)[1]  # [0] returns path+filename
    return ext.lstrip('.').lower()


def video_player(sources, poster_markup='', autoplay=False, loop=False,
                 controls=True, caption='', preload='none',
                 muted=False, **kwargs):
    '''
    Renders a video player with the markup as expected by video_player.js and
    video_player.scss.

    Sources is an iterable of (desktop_src, mobile_src, video_type) tuples,
    where mobile_src is optional. For example:
    import os
    sources = []
    for film in films:
        _, video_type = os.path.splitext(film.file.name)
        sources.append((film.file.url,
                        film.mobile_file.url if film.mobile_file else None,
                        video_type))
    '''
    for desktop, mobile, video_type in sources:
        assert desktop
        assert video_type

    result = get_template('video_player/video_player.html').render({
        'sources': sources,
        'poster_markup': poster_markup,
        'autoplay': autoplay,
        'loop': loop,
        'controls': controls,
        'preload': preload,
        'muted': muted,
        'caption': caption
    })
    return mark_safe(result)
