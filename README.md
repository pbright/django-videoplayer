django-videoplayer


Requirements
------------

- Python 2.7, 3.4 or 3.5
- Django 1.8+
- [Modernizr](https://modernizr.com/) (setclasses, touchevents, pointerevents).
  [Download the minimal build](https://modernizr.com/download?csspointerevents-touchevents-setclasses).
- 'no-js' class on the html element


Installation
------------

1. Download the source from https://pypi.python.org/pypi/django-videoplayer/
   and run `python setup.py install`, or:

        > pip install django-videoplayer

2. Ensure that the `TEMPLATES` setting includes an entry with
`'APP_DIRS': True`, or copy `templates/videoplayer/videoplayer.html` to a
location where django.template.loader.get_template can find it.
3. TODO: static files


Usage
-----

Import AbstractVideo (and optionally AbstractVideoSource) and create a child
model class. TODO: Copy requirements / details from code comments to here

TODO: Explain js.

TODO: Explain style defaults including responsive logic, and ability to
override.
