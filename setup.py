import setuptools

with open("README.md", "r") as fh:
    long_description = fh.read()

setuptools.setup(
    name="django-videoplayer",
    version="0.0.1",
    author="Paul Bright",
    author_email="paul@sons.co.nz",
    description="Lightweight wrapper around the video API",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/pbright/django-videoplayer.git",
    packages=setuptools.find_packages(),
    classifiers=(
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ),
)
