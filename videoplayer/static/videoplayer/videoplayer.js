// TODO: Replace these with node modules?

function getWindowWidth () {
  var e = window;
  var a = 'inner';
  if (!('innerWidth' in window)) {
    a = 'client';
    e = document.documentElement || document.body;
  }
  return e[a + 'Width'];
}

function extendObject () {
  for (let i = 1; i < arguments.length; i++) {
    for (let key in arguments[i]) {
      if (arguments[i].hasOwnProperty(key)) {
        arguments[0][key] = arguments[i][key];
      }
    }
  }
  return arguments[0];
}

function addEventListener (el, eventName, handler) {
  if (el.addEventListener) {
    el.addEventListener(eventName, handler);
  } else {
    el.attachEvent('on' + eventName, () => {
      handler.call(el);
    });
  }
}

function triggerEvent (el, eventName, options) {
  let event;
  if (window.CustomEvent) {
    event = new window.CustomEvent(eventName, options);
  } else {
    event = document.createEvent('CustomEvent');
    event.initCustomEvent(eventName, true, true, options);
  }
  el.dispatchEvent(event);
}

function addListenerMulti (el, s, fn) {
  s.split(' ').forEach(e => addEventListener(el, e, fn));
}

// track loaded videos due to Chrome refusing to load any more than 6
let nextPlayerId = 1;
const LOADED_VIDEOS = [];

/**
  * @class ScrollableCarousel
  *
  * Lightweight HTML5 video player.
  *
  * 1. Adds and removes classes to videoWrapper based on playback status.
  * 2. Adds handlers for .video-controls, if present.
  * 3. Commences playback based on autoplay data attribute.
  * 4. Worksaround various browser bugs.
  */
export class VideoPlayer {
  /**
   * Constructs an instance of VideoPlayer.
   *
   * @param {object} opts
   * @param {HtmlElement} el
   * @constructs VideoPlayer
   */
  constructor (opts = {}, el) {
    // account for scenario where we didn't receive any opts
    if (!el) {
      el = opts;
      opts = {};
    }

    this.videoWrapper = el;
    this.video = this.videoWrapper.getElementsByTagName('video')[0];

    const defaultOptions = {
      progressUpperColor: 'currentColor',
      progressLowerColor: 'currentColor',
      volumeUpperColor: 'currentColor',
      volumeLowerColor: 'currentColor',
      phoneMax: 667
    };

    this.options = extendObject(defaultOptions, opts);

    this.id = nextPlayerId++;
    this.sources = this.video.getElementsByTagName('source');
    this.posters = this.videoWrapper.getElementsByClassName('image');
    this.playpauseControls = this.videoWrapper.getElementsByClassName('playpause');
    this.controls = this.videoWrapper.getElementsByClassName('video-controls');
    this.fallbackProgresses = this.videoWrapper.getElementsByClassName('fallback-progress');
    this.fallbackProgressBars = this.videoWrapper.getElementsByClassName('fallback-progress-bar');
    this.progressBars = this.videoWrapper.getElementsByClassName('progress-bar');
    this.volumeBars = this.videoWrapper.getElementsByClassName('volume-bar');

    this.autoplayProp = this.video.getAttribute('autoplay');
    this.autoplayData = this.video.dataset.autoplay;
    // We don't use the actual preload attribute, see README.md.
    this.preload = this.video.dataset.preload || 'none';

    if (this.autoplayData === 'true') {
      this.autoplayData = true;
    }

    if (getWindowWidth() > this.options.phoneMax &&
        (this.autoplayData === true ||
         this.autoplayData === 'canplaythrough')) {
      this.videoWrapper.classList.add('loading');
      this.callStateChangeHandler('loading');
    }

    this.videoStateTracking();
    this.fullscreenStateTracking();

    if (this.controls && this.controls.length) {
      this.controlHandlers();
      this.progressUpdaters();
      // disable default controls
      this.videoWrapper.classList.add('has-custom-controls');
      this.video.controls = false;
    }

    // If the video is to autoplay, enforce preload auto.
    if ((this.autoplayData === true ||
         this.autoplayData === 'canplaythrough') &&
        getWindowWidth() > this.options.phoneMax) {
      this.preload = 'auto';
    }

    this.callHandler('initialised');

    if (this.preload !== 'none') {
      this.loadVideo(this.preload);
    }
  }

  /**
   * Called prior to a video element being loaded by
   * [loadVideo]{@link VideoPlayer#loadVideo}. Assigns the appropriate source
   * based on window width.
   *
   * @method VideoPlayer#assignSources
   */
  assignSources () {
    for (let source of this.sources) {
      const desktopSrc = source.dataset.src;
      let mobileSrc = '';
      if (getWindowWidth() <= this.options.phoneMax) {
        mobileSrc = source.dataset.mobileSrc;
      }
      if (mobileSrc) {
        source.setAttribute('src', mobileSrc);
      } else {
        source.setAttribute('src', desktopSrc);
      }
    }
  }

  callHandler (eventName) {
    this.options.handlers && this.options.handlers[eventName] &&
      this.options.handlers[eventName]();
  }

  callStateChangeHandler (newStateName) {
    this.options.statechange && this.options.statechange(newStateName);
  }

  /**
   * Assigns handlers to add / remove the following (self-explanatory) classes
   * to / from videoWrapper:
   *
   * playing
   * paused
   * metadata-loaded
   * loaded
   * canplay
   * canplaythrough
   * muted
   * user-activity
   *
   * @method VideoPlayer#videoStateTracking
   */
  videoStateTracking () {
    this.video.addEventListener('loadstart', () => {
      const classList =
        ['playing', 'paused', 'metadata-loaded', 'loaded', 'canplay',
          'canplaythrough'];
      for (let className of classList) {
        this.videoWrapper.classList.remove(className);
      }

      // We only set loading state here if we're delaying playback until we can
      // play through, to avoid any brief flash of the loading state prior to
      // playing.
      if ((this.autoplayData === true ||
          this.autoplayData === 'canplaythrough') &&
          getWindowWidth() > this.options.phoneMax) {
        this.videoWrapper.classList.add('loading');
        this.callStateChangeHandler('loading');
      }

      this.callHandler('loadstart');
    });

    this.video.addEventListener('loadedmetadata', () => {
      this.videoWrapper.classList.add('metadata-loaded');

      this.callHandler('loadedmetadata');
    });

    this.video.addEventListener('canplay', () => {
      this.videoWrapper.classList.remove('loading');
      this.videoWrapper.classList.add('canplay');

      this.callHandler('canplay');

      if (this.autoplayData === true &&
          getWindowWidth() > this.options.phoneMax) {
        this.play();
      }
    });

    this.video.addEventListener('canplaythrough', () => {
      this.videoWrapper.classList.remove('loading');
      this.videoWrapper.classList.add('canplaythrough');

      this.callHandler('canplaythrough');

      if (this.autoplayData === 'canplaythrough' &&
          getWindowWidth() > this.options.phoneMax) {
        this.play();
      }
    });

    this.video.addEventListener('playing', () => {
      this.videoWrapper.classList.add('playing');
      this.videoWrapper.classList.remove('loading');
      this.videoWrapper.classList.remove('paused');

      this.callHandler('playing');
    });

    this.video.addEventListener('pause', () => {
      this.videoWrapper.classList.add('paused');
      this.videoWrapper.classList.remove('playing');
      this.callHandler('pause');
    });

    this.video.addEventListener('ended', () => {
      this.videoWrapper.classList.remove('paused');
      this.videoWrapper.classList.remove('playing');
      this.videoWrapper.classList.remove('player-paused');
      this.videoWrapper.classList.remove('player-playing');
      this.toggleFullscreen(false);
      this.callHandler('ended');
      this.callStateChangeHandler('base');
    });

    this.video.addEventListener('volumechange', () => {
      if (this.video.volume === 0 || this.video.muted) {
        this.videoWrapper.classList.add('muted');
      } else {
        this.videoWrapper.classList.remove('muted');
      }
      this.callHandler('volumechange');
    });

    this.video.addEventListener('loadeddata', () => {
      this.callHandler('loadeddata');
    });

    this.video.addEventListener('progress', () => {
      this.callHandler('progress');
    });

    this.video.addEventListener('suspend', () => {
      this.callHandler('suspend');
    });

    this.video.addEventListener('abort', () => {
      this.callHandler('abort');
    });

    this.video.addEventListener('error', () => {
      this.callHandler('error');
    });

    this.video.addEventListener('emptied', () => {
      this.callHandler('emptied');
    });

    this.video.addEventListener('stalled', () => {
      this.callHandler('stalled');
    });

    this.video.addEventListener('waiting', () => {
      this.callHandler('waiting');
    });

    this.video.addEventListener('seeking', () => {
      this.callHandler('seeking');
    });

    this.video.addEventListener('seeked', () => {
      this.callHandler('seeked');
    });

    this.video.addEventListener('durationchange', () => {
      this.callHandler('durationchange');
    });

    this.video.addEventListener('play', () => {
      this.callHandler('play');
    });

    if (this.controls && this.controls.length) {
      const mousemoveHandler = () => {
        this.videoWrapper.classList.add('user-activity');
        if (fadeout != null) {
          clearTimeout(fadeout);
        }
        fadeout = setTimeout(() => {
          this.videoWrapper.classList.remove('user-activity');
        }, 2000);
      };

      let fadeout = null;
      this.video.addEventListener('mousemove', mousemoveHandler);

      for (let control of this.controls) {
        control.addEventListener('mousemove', mousemoveHandler);
      }
    }
  }

  /**
   * Assigns handlers to add / remove the fullscreen class to / from
   * videoWrapper, and the fullscreened-element calss to / from the body
   * element.
   *
   * @method VideoPlayer#fullscreenStateTracking
   */
  fullscreenStateTracking () {
    document.addEventListener('fullscreenchange', (e) => {
      const target = e.target || e.srcElement;
      if (this.videoWrapper.is(target)) {
        if (document.fullScreen || document.fullscreenElement) {
          this.videoWrapper.classList.add('fullscreen');
          document.body.classList.add('fullscreened-element');
        } else {
          this.videoWrapper.classList.remove('fullscreen');
          document.body.classList.remove('fullscreened-element');
        }
        this.callHandler('fullscreenchange');
      }
    });

    this.video.addEventListener('webkitendfullscreen', () => {
      this.pause();
    });

    document.addEventListener('webkitfullscreenchange', (e) => {
      const target = e.target || e.srcElement;
      if (this.videoWrapper.is(target)) {
        if (document.webkitIsFullScreen) {
          this.videoWrapper.classList.add('fullscreen');
          document.body.classList.add('fullscreened-element');
        } else {
          this.videoWrapper.classList.remove('fullscreen');
          document.body.classList.remove('fullscreened-element');
        }
        this.callHandler('fullscreenchange');
      }
    });

    document.addEventListener('mozfullscreenchange', (e) => {
      const target = e.target || e.srcElement;
      if (this.videoWrapper.is(target)) {
        if (document.mozFullScreen) {
          this.videoWrapper.classList.add('fullscreen');
          document.body.classList.add('fullscreened-element');
        } else {
          this.videoWrapper.classList.remove('fullscreen');
          document.body.classList.remove('fullscreened-element');
        }
        this.callHandler('fullscreenchange');
      }
    });

    document.addEventListener('msfullscreenchange', (e) => {
      const target = e.target || e.srcElement;
      if (this.videoWrapper.is(target)) {
        if (document.msFullscreenElement) {
          this.videoWrapper.classList.add('fullscreen');
          document.body.classList.add('fullscreened-element');
        } else {
          this.videoWrapper.classList.remove('fullscreen');
          document.body.classList.remove('fullscreened-element');
        }
        this.callHandler('fullscreenchange');
      }
    });
  }

  /**
   * Assigns handlers for user interaction with the controls (if any).
   *
   * @method VideoPlayer#controlHandlers
   */
  controlHandlers () {
    // Currently not all browsers support styling the upper and lower parts
    // of the range-track (ie. a different color up to the thumbs location
    // than afterwards). You also can't use pseudo-elements.
    // There is a workaround using box-shadow, but that requires setting
    // overflow: hidden, which doesn't play nicely with a thumb larger than
    // than the track. We therefore use a different workaround, setting a
    // background gradient on both input and change.
    for (let progressBar of this.progressBars) {
      const lower = this.options.progressLowerColor;
      const upper = this.options.progressUpperColor;
      addListenerMulti(progressBar, 'input change', () => {
        const position = progressBar.value / progressBar.getAttribute('max') * 100;
        progressBar.style.background =
          'linear-gradient(to right, ' + lower + ' 0%, ' +
                           lower + ' ' + position + '%, ' +
                           upper + ' ' + position + '%, ' +
                           upper + ' 100%)';
      });
      triggerEvent(progressBar, 'input');

      // Pause playback if user is adjusting playback position.
      progressBar.addEventListener('mousedown', () => {
        this.videoWrapper.classList.add('scrubbing');
        this.video.pause();
      });

      // Use input not change as we'll be triggering change programatically.
      // Also this way it updates as the user slides, not only at the end.
      progressBar.addEventListener('input', () => {
        const time = this.video.duration *
                     (progressBar.value / progressBar.getAttribute('max'));
        this.video.currentTime = time;
      });

      // Resume playback when progress bar released.
      progressBar.addEventListener('mouseup', () => {
        this.videoWrapper.classList.remove('scrubbing');
        this.video.play();
      });
    }

    for (let volumeBar of this.volumeBars) {
      const lower = this.options.progressLowerColor;
      const upper = this.options.progressUpperColor;
      addListenerMulti(volumeBar, 'input change', () => {
        const position = volumeBar.value / volumeBar.getAttribute('max') * 100;
        volumeBar.style.background =
          'linear-gradient(to right, ' + lower + ' 0%, ' +
                           lower + ' ' + position + '%, ' +
                           upper + ' ' + position + '%, ' +
                           upper + ' 100%)';
      });
      triggerEvent(volumeBar, 'input');

      volumeBar.addEventListener('change', () => {
        this.video.volume = volumeBar.value;
      });
    }

    for (let poster of this.posters) {
      poster.addEventListener('click', (e) => {
        e.preventDefault();
        this.play();
      });
    }

    for (let playpauseControl of this.playpauseControls) {
      playpauseControl.addEventListener('click', (e) => {
        e.preventDefault();
        this.playpause();
      });
    }

    const fullScreenEnabled =
      !!(document.fullscreenEnabled ||
         document.mozFullScreenEnabled ||
         document.msFullscreenEnabled ||
         document.webkitSupportsFullscreen ||
         document.webkitFullscreenEnabled ||
         document.createElement('video').webkitRequestFullScreen);

    for (let control of this.controls) {
      for (let muteButton of control.getElementsByClassName('mute')) {
        muteButton.addEventListener('click', (e) => {
          e.preventDefault();
          this.video.muted = !this.video.muted;
        });
      }

      for (let volinc of control.getElementsByClassName('volinc')) {
        volinc.addEventListener('click', (e) => {
          e.preventDefault();
          this.alterVolume('+');
        });
      }

      for (let voldec of control.getElementsByClassName('voldec')) {
        voldec.addEventListener('click', (e) => {
          e.preventDefault();
          this.alterVolume('-');
        });
      }

      if (!fullScreenEnabled) {
        for (let fs of control.getElementsByClassName('fs')) {
          fs.style.display = 'none';
        }
      } else {
        for (let fs of control.getElementsByClassName('fs')) {
          fs.addEventListener('click', (e) => {
            this.toggleFullscreen();
          });
        }
      }
    }

    for (let fallbackProgress of this.fallbackProgresses) {
      fallbackProgress.addEventListener('click', (e) => {
        const boundingRect = fallbackProgress.getBoundingClientRect();
        const pos = (e.pageX - boundingRect.left) / boundingRect.width;
        this.video.currentTime = pos * this.video.duration;
        for (let fallbackProgressBar of
             fallbackProgress.getElementsByClassName('fallback-progress-bar')) {
          fallbackProgressBar.style.width =
            Math.floor((this.video.currentTime / this.video.duration) * 100) + '%';
        }
      });
    }
  }

  /**
   * Assigns handlers for advancing the progress bar as the video plays.
   *
   * @method VideoPlayer#progressUpdaters
   */
  progressUpdaters () {
    this.video.addEventListener('loadedmetadata', () => {
      for (let progressBar of this.progressBars) {
        progressBar.setAttribute('max', this.video.duration);
      }
    });

    this.video.addEventListener('timeupdate', () => {
      let value = this.video.currentTime;
      // round to nearest .25
      value = (Math.round(value * 4) / 4).toFixed(2);

      for (let progressBar of this.progressBars) {
        // fallback for browsers that don't trigger loadedmetadata correctly.
        if (!progressBar.getAttribute('max')) {
          progressBar.setAttribute('max', this.video.duration);
        }

        progressBar.value = value;
        triggerEvent(progressBar, 'change');
      }

      for (let fallbackProgressBar of this.fallbackProgressBars) {
        fallbackProgressBar.style.width =
          Math.floor((this.video.currentTime / this.video.duration) * 100) + '%';
      }

      this.callHandler('timeupdate');
    });
  }

  /**
   * Loads the video in an appropriate manner based on the preload parameter.
   * Unloads an already loaded video if necessary to avoid Chrome's six video
   * limit (see GOTCHAS.md).
   *
   * @method VideoPlayer#loadVideo
   * @param {string} preload
   */
  loadVideo (preload) {
    // If we've already loaded 6 videos, remove the oldest ones until
    // we only have 5, so the next video can start loading even in Chrome.
    while (LOADED_VIDEOS.length > 5) {
      const removed = LOADED_VIDEOS.shift();
      console.warn('Five videos already loaded. Unloading oldest.');
      removed.unloadVideo.bind(removed)();
    }

    LOADED_VIDEOS.push(this);
    this.assignSources();
    // Results in play being called in canplay handler if autoplay is true
    if (preload === 'metadata') {
      // there's no method we can use to do this, so we have to rely on the
      // preload attribute
      this.setAttribute('preload', preload);
    } else {
      this.video.load();
    }
  }

  /**
   * Unloads the video, resetting the markup such that the poster is displayed.
   *
   * @method VideoPlayer#unloadVideo
   */
  unloadVideo () {
    this.teardown();

    const classNames = ['metadata-loaded', 'canplay', 'canplaythrough',
      'player-paused', 'paused', 'player-playing', 'playing'];
    for (let className of classNames) {
      this.videoWrapper.classList.remove(className);
    }
    this.callStateChangeHandler('base');
  }

  /**
   * Plays the video.
   *
   * @method VideoPlayer#play
   */
  play () {
    if (this.video.readyState === 0) {
      this.loadVideo();
    }

    this.video.play();
    this.videoWrapper.classList.remove('loading');
    // Frequently we may need to differentiate between the video playing, and
    // the video playing due to this module's play / pause methods being
    // called. For example, when changing the video location via the
    // progress bar, the video is temporarily paused (without using these
    // functions), and it is unlikely we want this to be reflected in our
    // style.
    this.videoWrapper.classList.add('player-playing');
    this.videoWrapper.classList.remove('player-paused');
    this.callStateChangeHandler('player-playing');
  }

  /**
   * Pauses the video.
   *
   * @method VideoPlayer#pause
   */
  pause () {
    this.video.pause();
    this.videoWrapper.classList.add('player-paused');
    this.videoWrapper.classList.remove('player-playing');
    this.callStateChangeHandler('playing-paused');
  }

  /**
   * Toggles between play / pause.
   *
   * @method VideoPlayer#playpause
   */
  playpause () {
    if (this.videoWrapper.classList.contains('playing')) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Changes the video volume.
   *
   * @method VideoPlayer#alterVolume
   * @param {string} dir - '+' or '-'
   */
  alterVolume (dir) {
    const currentVolume = Math.floor(this.video.volume * 10) / 10;
    if (dir === '+') {
      if (currentVolume < 1) {
        this.video.volume += 0.1;
      }
    } else if (dir === '-') {
      if (currentVolume > 0) {
        this.video.volume -= 0.1;
      }
    }
    this.video.muted = false;
  }

  /**
   * Checks whether there is a fullscreen element or not.
   *
   * @method VideoPlayer#isFullScreen
   */
  isFullScreen () {
    return !!(document.fullScreen ||
              document.webkitIsFullScreen ||
              document.mozFullScreen ||
              document.msFullscreenElement ||
              document.fullscreenElement);
  }

  /**
   * Toggles whether the videoplayer is fullscreen or not.
   *
   * @method VideoPlayer#toggleFullscreen
   */
  toggleFullscreen (toggle) {
    if (this.isFullScreen() || toggle === false) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitCancelFullScreen) {
        document.webkitCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    } else {
      if (this.videoWrapper.requestFullscreen) {
        this.videoWrapper.requestFullscreen();
      } else if (this.videoWrapper.mozRequestFullScreen) {
        this.videoWrapper.mozRequestFullScreen();
      } else if (this.videoWrapper.webkitRequestFullScreen) {
        this.videoWrapper.webkitRequestFullScreen();
      } else if (this.videoWrapper.msRequestFullscreen) {
        this.videoWrapper.msRequestFullscreen();
      }
    }
  }

  /**
   * Unloads the existing video, then replaces it's sources with those
   * contained in data.sources, which is expected to be a list of objects,
   * each with a source and (optionally) mobileSource property.
   *
   * Note that this function does not alter the poster.
   *
   * @method VideoPlayer#replaceSrc
   * @param {Object} data - {sources: [{source: '...', mobileSource: '...'}, ...]}
   * @param {string} play - whether to play the video immediately after loading
   */
  replaceSrc (data, play) {
    // Avoid Chrome bug.
    this.unloadVideo();

    if (play) {
      this.videoWrapper.classList.add('loading');
      this.callStateChangeHandler('loading');
    }

    for (let source of this.sources) {
      source.parentNode.removeChild(source);
    }

    for (let sourceDict of data.sources) {
      const newSource = document.createElement('<source></source>');
      newSource.dataset.src = sourceDict.source;
      newSource.dataset.mobileSrc = sourceDict.mobileSource;
      this.video.appendChild(newSource);
    }

    this.sources = this.video.getElementsByTagName('source');

    if (play) {
      this.loadVideo();
      this.video.play();
    }
  }

  /**
   * Ensures resources consumed by this video are released. This should be
   * called whenever a video element is about to be removed from the DOM or
   * wheever its sources are about to be changed (which it is recommended be
   * done via replaceSrc).
   *
   * @method VideoPlayer#teardown
   */
  teardown () {
    // See GOTCHAS.md.
    this.video.pause();

    for (let source of this.sources) {
      source.removeAttribute('src');
    }
    this.video.load();

    for (let i = LOADED_VIDEOS.length - 1; i >= 0; i--) {
      if (LOADED_VIDEOS[i] === this) {
        LOADED_VIDEOS.splice(i, 1);
      }
    }
  }
}
