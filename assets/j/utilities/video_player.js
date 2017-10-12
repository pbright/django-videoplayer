import $ from 'jquery';

import {extendObject} from './tools';
import {isPhone} from '../src/constants';

// track loaded videos due to Chrome refusing to load any more than 6
let nextPlayerId = 1;
const LOADED_VIDEOS = [];

/*
  VideoPlayer

  Adds and removes classes to videoWrapper based on playback status.

  Adds handlers for .video-controls, if present.

  Commences playback if there is an autoplay data attribute.

  See src/video_player/application.py for video related gotchas.
*/
export class VideoPlayer {
  constructor (opts = {}, el) {
    // account for scenario where we didn't receive any opts
    if (!el) {
      el = opts;
      opts = {};
    }

    this.videoWrapper = el;
    this.video = this.videoWrapper.find('video');

    if (!this.video || !this.video.length) {
      return;
    }

    const defaultOptions = {
      progressUpperColor: 'currentColor',
      progressLowerColor: 'currentColor',
      volumeUpperColor: 'currentColor',
      volumeLowerColor: 'currentColor'
    };

    this.options = extendObject(defaultOptions, opts);

    this.id = nextPlayerId++;
    this.videoEl = this.video[0];
    this.sources = this.video.find('source');
    this.poster = this.videoWrapper.find('.image');
    this.playpauseControl = this.videoWrapper.find('.playpause');
    this.controls = this.videoWrapper.find('.video-controls');
    this.fallbackProgress = this.videoWrapper.find('.fallback-progress');
    this.fallbackProgressBar = this.fallbackProgress.find('.fallback-progress-bar');
    this.progressBar = this.videoWrapper.find('.progress-bar');
    this.volumeBar = this.controls.find('.volume-bar');

    this.autoplayProp = this.video.prop('autoplay');
    this.autoplayData = this.video.data('autoplay');
    // We don't use the actual preload attribute, see README.md.
    this.preload = this.video.data('preload') || 'none';

    if (this.autoplayData === 'true') {
      this.autoplayData = true;
    }

    if (!isPhone(false) &&
        (this.autoplayData === true ||
         this.autoplayData === 'canplaythrough')) {
      this.videoWrapper.addClass('loading');
    }

    this.videoStateTracking();
    this.fullscreenStateTracking();

    if (this.controls && this.controls.length) {
      this.controlHandlers();
      this.progressUpdaters();
      // disable default controls
      this.videoWrapper.addClass('has-custom-controls');
      this.videoEl.controls = false;
    }

    // If the video is to autoplay, enforce preload auto.
    if ((this.autoplayData === true ||
          this.autoplayData === 'canplaythrough') &&
         !isPhone(false)) {
      this.preload = 'auto';
    }

    if (this.preload !== 'none') {
      this.loadVideo(this.preload);
    }
  }

  assignSources () {
    this.sources.each(function () {
      const source = $(this);
      const desktopSrc = source.data('src');
      let mobileSrc = '';
      if (isPhone(false)) {
        mobileSrc = source.data('mobile-src');
      }
      if (mobileSrc) {
        source.attr('src', mobileSrc);
      } else {
        source.attr('src', desktopSrc);
      }
    });
  }

  videoStateTracking () {
    const that = this;

    this.video.on('loadstart', function () {
      that.videoWrapper
          .removeClass('playing paused metadata-loaded loaded canplaythrough');

      if ((that.autoplayData === true ||
          that.autoplayData === 'canplaythrough') &&
          !isPhone(false)) {
        that.videoWrapper.addClass('loading');
      }
    });

    this.video.on('loadedmetadata', function () {
      that.videoWrapper.addClass('metadata-loaded');
    });

    this.video.on('canplay', function () {
      that.videoWrapper.removeClass('loading')
                       .addClass('canplay');

      if (that.autoplayData === true &&
          !isPhone(false)) {
        $.proxy(that.play, that)();
      }
    });

    this.video.on('canplaythrough', function () {
      that.videoWrapper.removeClass('loading')
                       .addClass('canplaythrough');

      if (that.autoplayData === 'canplaythrough' &&
          !isPhone(false)) {
        $.proxy(that.play, that)();
      }
    });

    this.video.on('playing', function () {
      that.videoWrapper.addClass('playing')
                       .removeClass('loading')
                       .removeClass('paused');
    });

    this.video.on('pause', function () {
      that.videoWrapper.addClass('paused').removeClass('playing');
    });

    this.video.on('ended', function () {
      that.videoWrapper.removeClass('paused').removeClass('playing')
          .removeClass('player-paused').removeClass('player-playing');
      $.proxy(that.toggleFullscreen, that)(false);
    });

    this.video.on('volumechange', function () {
      if (that.videoEl.volume === 0 || that.videoEl.muted) {
        that.videoWrapper.addClass('muted');
      } else {
        that.videoWrapper.removeClass('muted');
      }
    });

    if (this.controls && this.controls.length) {
      let fadeout = null;
      this.video.add(this.controls).mousemove(function () {
        that.videoWrapper.addClass('user-activity');
        if (fadeout != null) {
          clearTimeout(fadeout);
        }
        fadeout = setTimeout(function () {
          that.videoWrapper.removeClass('user-activity');
        }, 2000);
      });
    }
  }

  fullscreenStateTracking () {
    const that = this;

    document.addEventListener('fullscreenchange', function (e) {
      that.videoWrapper
          .toggleClass('fullscreen',
                       !!(document.fullScreen || document.fullscreenElement));
      $('body')
        .toggleClass('fullscreened-element',
                     !!(document.fullScreen || document.fullscreenElement));
    });

    that.video.on('webkitendfullscreen', function () {
      $.proxy(that.pause, that)();
    });

    document.addEventListener('webkitfullscreenchange', function (e) {
      that.videoWrapper.toggleClass('fullscreen',
                                         !!document.webkitIsFullScreen);
      $('body').toggleClass('fullscreened-element',
                            !!document.webkitIsFullScreen);
    });

    document.addEventListener('mozfullscreenchange', function (e) {
      that.videoWrapper.toggleClass('fullscreen',
                                         !!document.mozFullScreen);
      $('body').toggleClass('fullscreened-element',
                            !!document.mozFullScreen);
    });

    document.addEventListener('msfullscreenchange', function (e) {
      that.videoWrapper.toggleClass('fullscreen',
                                         !!document.msFullscreenElement);
      $('body').toggleClass('fullscreened-element',
                            !!document.msFullscreenElement);
    });
  }

  controlHandlers () {
    const that = this;

    // Currently not all browsers support styling the upper and lower parts
    // of the range-track (ie. a different color up to the thumbs location
    // than afterwards). You also can't use pseudo-elements.
    // There is a workaround using box-shadow, but that requires setting
    // overflow: hidden, which doesn't play nicely with a thumb larger than
    // than the track. We therefore use a different workaround, setting a
    // background gradient on both input and change.
    this.progressBar.each(function () {
      const me = $(this);
      const lower = that.options.progressLowerColor;
      const upper = that.options.progressUpperColor;
      me.on('input change', function () {
        const position = me.val() / me.attr('max') * 100;
        me.css('background',
               'linear-gradient(to right, ' + lower + ' 0%, ' +
                                lower + ' ' + position + '%, ' +
                                upper + ' ' + position + '%, ' +
                                upper + ' 100%)');
      });
    }).trigger('input');

    this.volumeBar.each(function () {
      const me = $(this);
      const lower = that.options.volumeLowerColor;
      const upper = that.options.volumeUpperColor;
      me.on('input change', function () {
        const position = me.val() / me.attr('max') * 100;
        me.css('background',
               'linear-gradient(to right, ' + lower + ' 0%, ' +
                                lower + ' ' + position + '%, ' +
                                upper + ' ' + position + '%, ' +
                                upper + ' 100%)');
      });
    }).trigger('input');

    this.poster.click(function (e) {
      e.preventDefault();
      $.proxy(that.play, that)();
    });

    this.playpauseControl.click(function (e) {
      e.preventDefault();
      $.proxy(that.playpause, that)();
    });

    this.controls.find('.mute').click(function (e) {
      e.preventDefault();
      that.videoEl.muted = !that.videoEl.muted;
    });

    this.volumeBar.on('change', function () {
      that.videoEl.volume = that.volumeBar.val();
    });

    this.controls.find('.volinc').click(function (e) {
      e.preventDefault();
      $.proxy(that.alterVolume, that)('+');
    });

    this.controls.find('.voldec').click(function (e) {
      e.preventDefault();
      $.proxy(that.alterVolume, that)('-');
    });

    // Pause playback if user is adjusting playback position.
    this.progressBar.on('mousedown', function () {
      that.videoWrapper.addClass('scrubbing');
      that.videoEl.pause();
    });

    // Use input not change as we'll be triggering change programtically. Also
    // this way it updates as the user slides, not only at the end.
    this.progressBar.on('input', function () {
      const time = that.videoEl.duration *
                   (that.progressBar.val() / that.progressBar.attr('max'));
      that.videoEl.currentTime = time;
    });

    // Resume playback when progress bar released.
    this.progressBar.on('mouseup', function () {
      that.videoWrapper.removeClass('scrubbing');
      that.videoEl.play();
    });

    // Fallback for browsers that don't support range inputs.
    this.fallbackProgress.click(function (e) {
      const pos = (e.pageX - that.fallbackProgress.offset().left) /
                  that.fallbackProgress.width();
      that.videoEl.currentTime = pos * that.videoEl.duration;
      that.fallbackprogressBar.css('width',
        Math.floor((that.videoEl.currentTime /
                    that.videoEl.duration) * 100) + '%');
    });

    const fullScreenEnabled =
      !!(document.fullscreenEnabled ||
         document.mozFullScreenEnabled ||
         document.msFullscreenEnabled ||
         document.webkitSupportsFullscreen ||
         document.webkitFullscreenEnabled ||
         document.createElement('video').webkitRequestFullScreen);

    if (!fullScreenEnabled) {
      this.controls.find('.fs').hide();
    } else {
      this.controls.find('.fs').click(function (e) {
        $.proxy(that.toggleFullscreen, that)();
      });
    }
  }

  progressUpdaters () {
    const that = this;

    this.video.on('loadedmetadata', function () {
      that.progressBar.attr('max', that.videoEl.duration);
    });

    this.video.on('timeupdate', function () {
      // fallback for browsers that don't trigger loadedmetadata correctly.
      if (!that.progressBar.attr('max')) {
        that.progressBar.attr('max', that.videoEl.duration);
      }

      let value = that.videoEl.currentTime;
      // round to nearest .25
      value = (Math.round(value * 4) / 4).toFixed(2);
      that.progressBar.val(value).trigger('change');

      that.fallbackProgressBar.css('width',
        Math.floor((that.videoEl.currentTime /
                    that.videoEl.duration) * 100) + '%');
    });
  }

  loadVideo (preload) {
    // If we've already loaded 6 videos, remove the oldest ones until
    // we only have 5, so the next video can start loading even in Chrome.
    while (LOADED_VIDEOS.length > 5) {
      const removed = LOADED_VIDEOS.shift();
      console.warn('Five videos already loaded. Unloading oldest.');
      $.proxy(removed.unloadVideo, removed)();
    }

    LOADED_VIDEOS.push(this);
    this.assignSources();
    // Results in play being called in canplay handler if autoplay is true
    if (preload === 'metadata') {
      // there's no method we can use to do this, so we have to rely on the
      // preload attribute
      this.attr('preload', preload);
    } else {
      this.videoEl.load();
    }
  }

  unloadVideo () {
    this.teardown();

    const classes = 'metadata-loaded canplay canplaythrough player-paused ' +
                    'paused player-playing playing';
    this.videoWrapper.removeClass(classes);
  }

  // Frequently we may need to differentiate between the video playing, and
  // the video playing due to this module's play / pause methods being
  // called. For example, when changing the video location via the
  // progress bar, the video is temporarily paused (without using these
  // functions), and it is unlikely we want this to be reflected in our
  // style.
  play () {
    if (this.videoEl.readyState === 0) {
      this.loadVideo();
    }

    this.videoEl.play();
    this.videoWrapper
        .removeClass('loading')
        .addClass('player-playing')
        .removeClass('player-paused');
  }

  pause () {
    this.videoEl.pause();
    this.videoWrapper.addClass('player-paused').removeClass('player-playing');
  }

  playpause () {
    if (this.videoWrapper.hasClass('playing')) {
      this.pause();
    } else {
      this.play();
    }
  }

  alterVolume (dir) {
    const currentVolume = Math.floor(this.videoEl.volume * 10) / 10;
    if (dir === '+') {
      if (currentVolume < 1) {
        this.videoEl.volume += 0.1;
      }
    } else if (dir === '-') {
      if (currentVolume > 0) {
        this.videoEl.volume -= 0.1;
      }
    }
    this.videoEl.muted = false;
  }

  isFullScreen () {
    return !!(document.fullScreen ||
              document.webkitIsFullScreen ||
              document.mozFullScreen ||
              document.msFullscreenElement ||
              document.fullscreenElement);
  }

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
      if (this.videoWrapper[0].requestFullscreen) {
        this.videoWrapper[0].requestFullscreen();
      } else if (this.videoWrapper[0].mozRequestFullScreen) {
        this.videoWrapper[0].mozRequestFullScreen();
      } else if (this.videoWrapper[0].webkitRequestFullScreen) {
        this.videoWrapper[0].webkitRequestFullScreen();
      } else if (this.videoWrapper[0].msRequestFullscreen) {
        this.videoWrapper[0].msRequestFullscreen();
      }
    }
  }

  replaceSrc (data, play) {
    // Avoid Chrome bug.
    this.unloadVideo();

    if (play) {
      this.videoWrapper.addClass('loading');
    }

    this.sources.remove();
    for (let sourceDict of data.sources) {
      const newSource = $('<source></source>');
      newSource.data('src', sourceDict.source);
      newSource.data('mobile-src', sourceDict.mobile_source);
      this.video.append(newSource);
    }

    this.sources = this.video.find('source');

    if (play) {
      this.loadVideo();
      this.videoEl.play();
    }
  }

  teardown () {
    // See GOTCHAS.md.
    this.videoEl.pause();
    this.sources.each(function () {
      const source = $(this);
      source.removeAttr('src');
    });
    this.videoEl.load();

    for (let i = LOADED_VIDEOS.length - 1; i >= 0; i--) {
      if (LOADED_VIDEOS[i] === this) {
        LOADED_VIDEOS.splice(i, 1);
      }
    }
  }
}
