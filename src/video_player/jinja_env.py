from .application import video_player


def jinja2_globals():
    return {
        'video_player': video_player
    }
