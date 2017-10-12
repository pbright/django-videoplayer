from .application import videoplayer


def jinja2_globals():
    return {
        'videoplayer': videoplayer
    }
