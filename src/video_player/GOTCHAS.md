Video related gotchas:

1. Chrome has some annoying bugs which can result in a loading new video or an
   ajax page load never completing, because it doesn't release resources from
   previously played videos correctly, and "concurrent" videos are limited
   to 6. The telltale sign for this is "Waiting for available socket" message
   in the bottom left of your browser (it may require attempting reload to see
   this). This is mostly a problem if you are updating videos dynamically or
   have ajax page loads.

   This can be worked around (except for videos that remain in the DOM between
   page loads, see below) by setting the src to '', detaching the video element
   from the dom, then calling it's load method, to force Chrome to release the
   resources. See points 2 - 4 below.
   https://bugs.chromium.org/p/chromium/issues/detail?id=234779
   https://bugs.chromium.org/p/chromium/issues/detail?id=31014

2. We don't include the preload attribute in the html, but swap it in after the
   initial window load using js, because otherwise Chrome massively exacerbates
   the above problem by loading a single video up to 5 times if the preload
   attribute is set to anything other than none.

3. On iOS, if a call to the video element's play() method is not
   based on user input with a reasonable level of proximity, the video
   will not play. This can conflict with our requirement in point 1. See
   point 4 below.

4. A replaceSrc method is provided which can be used to replace the
   existing source in a way that will keep both Chrome and iPhones happy.

5. On iPhones running <= iOS9, videos non-optionally open in a
   separate player. On iOS10 the video can be made to play inline. On
   non-iOS devices and iPads, the video typically plays inline.

6. If you are providing a fullscreen button, make sure you test it on every
   page. Browsers use z-index to place the fullscreen element on top, but
   that can be messed up by the stacking context, and in my testing
   position: fixed gave unexpected results. Some browsers attempt to
   resolve this by setting all ancestors of the fullscreened element to
   position: static, but this can cause other issues. Some browsers may also
   meddle with other css properties on ancestors of the video element, such as
   transforms.

7. Videos set to loop may not loop on Django's runserver, as runserver
   doesn't support partial content requests.
   http://stackoverflow.com/questions/8088364/html5-video-will-not-loop

8. Seeking using the progress bar may not work on Django's runserver.
