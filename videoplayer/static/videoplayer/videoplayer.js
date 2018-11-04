/**
 * Converts els into an array.
 *
 * @function makeArray
 * @param {(Array.<HtmlElement>|HtmlElement)} els
 * @returns {Array.<HtmlElement>}
 */
function makeArray (els) {
  if (els === undefined || els === null) {
    return []
  }

  // Some elements can be iterable, for example forms and selects. We
  // specifically check whether els is a DOM node.
  let arr
  if (els.nodeType) {
    arr = [els]
  } else {
    arr = Array.from(els)
  }

  if (!arr.length && els && els.length === undefined) {
    arr = [els]
  }

  return arr
}

/**
 * Calls fn for each element in els.
 *
 * We use this because IE11 is not handled correctly by Babel when we use
 * for ... in.
 *
 * @function forEach
 * @param {(Array.<HtmlElement>|HtmlElement)} els
 * @param {function} fn
 */
function forEach (els, fn) {
  const arr = makeArray(els)
  arr.forEach(fn)
}

function getWindowWidth () {
  var e = window
  var a = 'inner'
  if (!('innerWidth' in window)) {
    a = 'client'
    e = document.documentElement || document.body
  }
  return e[a + 'Width']
}

function extendObject () {
  for (let i = 1; i < arguments.length; i++) {
    for (let key in arguments[i]) {
      if (arguments[i].hasOwnProperty(key)) {
        arguments[0][key] = arguments[i][key]
      }
    }
  }
  return arguments[0]
}

function addEventListener (el, eventName, handler) {
  if (el.addEventListener) {
    el.addEventListener(eventName, handler)
  } else {
    el.attachEvent('on' + eventName, () => {
      handler.call(el)
    })
  }
}

function triggerEvent (el, eventName, options) {
  options = options || { bubbles: false, cancelable: false, detail: undefined }
  var evt = document.createEvent('CustomEvent')
  evt.initCustomEvent(eventName, options.bubbles, options.cancelable,
    options.detail)
  el.dispatchEvent(evt)
}

function addListenerMulti (el, s, fn) {
  s.split(' ').forEach(e => addEventListener(el, e, fn))
}

function closest (element, selector, checkYoSelf) {
  var parent = checkYoSelf ? element : element.parentNode

  while (parent && parent !== document) {
    if (parent.matches(selector)) {
      return parent
    }
    parent = parent.parentNode
  }
}

// track loaded videos due to Chrome refusing to load any more than 6
let nextPlayerId = 1
const LOADED_VIDEOS = []

export const INITIAL_STATE = 1
export const LOADING_STATE = 2
export const PLAYING_STATE = 3
export const PAUSED_STATE = 4
export const ENDED_STATE = 5

/**
  * @class VideoPlayer
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
      el = opts
      opts = {}
    }

    this.videoWrapper = el
    this.video = this.videoWrapper.querySelector('.video')

    const defaultOptions = {
      progressUpperColor: 'currentColor',
      progressLowerColor: 'currentColor',
      volumeUpperColor: 'currentColor',
      volumeLowerColor: 'currentColor',
      phoneMax: 667,
      // We don't use the actual autoplay attribute so that we can support
      // autoplay on canplaythrough, or on phone only
      autoplay: this.video.dataset.autoplay === 'true',
      autoplayMinWidth: 0
    }

    // We don't use the actual preload attribute, see README.md.
    if (this.video.dataset.preload) {
      defaultOptions.preload = this.video.dataset.preload.toLowerCase()
    } else {
      defaultOptions.preload = 'none'
    }

    if (this.video.dataset.autoplayMinWidth) {
      defaultOptions.autoplayMinWidth =
        parseInt(this.video.dataset.autoplayMinWidth, 10)
    }

    this.options = extendObject(defaultOptions, opts)

    this.changeState(INITIAL_STATE)

    this.id = nextPlayerId++
    this.sources = this.video.getElementsByTagName('source')
    this.posters = this.videoWrapper.getElementsByClassName('image')
    this.playpauseControls =
      this.videoWrapper.getElementsByClassName('playpause')
    this.controls = this.videoWrapper.getElementsByClassName('video-controls')
    this.fallbackProgresses =
      this.videoWrapper.getElementsByClassName('fallback-progress')
    this.fallbackProgressBars =
      this.videoWrapper.getElementsByClassName('fallback-progress-bar')
    this.progressBars =
      this.videoWrapper.getElementsByClassName('progress-bar')
    this.volumeBars = this.videoWrapper.getElementsByClassName('volume-bar')

    this.videoStateTracking()
    this.fullscreenStateTracking()

    if (this.controls && this.controls.length) {
      this.controlHandlers()
      this.progressUpdaters()
      // disable default controls
      this.videoWrapper.classList.add('has-custom-controls')
      this.video.controls = false
    }

    if ((this.options.autoplay === true ||
         this.options.autoplay === 'canplaythrough') &&
         getWindowWidth() >= this.options.autoplayMinWidth) {
      this.changeState(LOADING_STATE)
      // If the video is to autoplay, enforce preload auto.
      this.options.preload = 'auto'
    }

    this.callHandler('initialised')

    if (this.options.preload !== 'none') {
      this.loadVideo(this.options.preload)
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
    forEach(this.sources, source => {
      const desktopSrc = source.dataset.src
      let mobileSrc = ''
      if (getWindowWidth() <= this.options.phoneMax) {
        mobileSrc = source.dataset.mobileSrc
      }
      if (mobileSrc) {
        source.setAttribute('src', mobileSrc)
      } else {
        source.setAttribute('src', desktopSrc)
      }
    })
  }

  /**
   * @method VideoPlayer#callHandler
   * @param {string} eventName
   */
  callHandler (eventName) {
    this.options.handlers && this.options.handlers[eventName] &&
      this.options.handlers[eventName].call(this)
  }

  /**
   * @method VideoPlayer#changeState
   * @param {int} newState
   */
  changeState (newState) {
    this.state = newState
    this.options.statechange && this.options.statechange.call(this)
  }

  /**
   * Assigns handlers to add / remove the following (self-explanatory) classes
   * to / from videoWrapper:
   *
   * videoplayer-playing
   * videoplayer-paused
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
    addEventListener(this.video, 'loadstart', () => {
      const classList =
        ['videoplayer-playing', 'videoplayer-paused', 'metadata-loaded',
          'loaded', 'canplay', 'canplaythrough', 'videoplayer-ended',
          'videoplayer-preplay']
      forEach(classList, className => {
        this.videoWrapper.classList.remove(className)
      })

      // We only set loading state here if we're delaying playback until we can
      // play through, to avoid any brief flash of the loading state prior to
      // playing.
      if ((this.options.autoplay === true ||
           this.options.autoplay === 'canplaythrough') &&
          getWindowWidth() >= this.options.autoplayMinWidth) {
        this.videoWrapper.classList.add('videoplayer-loading')
        this.changeState(LOADING_STATE)
      }

      this.callHandler('loadstart')
    })

    addEventListener(this.video, 'loadedmetadata', () => {
      this.videoWrapper.classList.add('metadata-loaded')

      this.callHandler('loadedmetadata')
    })

    addEventListener(this.video, 'canplay', () => {
      this.videoWrapper.classList.add('canplay')

      this.callHandler('canplay')

      if (this.options.autoplay === true &&
          getWindowWidth() >= this.options.autoplayMinWidth &&
          this.state < PLAYING_STATE) {
        this.play()
      }
    })

    addEventListener(this.video, 'canplaythrough', () => {
      this.videoWrapper.classList.add('canplaythrough')

      this.callHandler('canplaythrough')

      if (this.options.autoplay === 'canplaythrough' &&
          getWindowWidth() >= this.options.autoplayMinWidth &&
          this.state < PLAYING_STATE) {
        this.play()
      }
    })

    addEventListener(this.video, 'playing', () => {
      this.videoWrapper.classList.remove('videoplayer-loading')
      this.videoWrapper.classList.add('videoplayer-playing')
      this.videoWrapper.classList.remove('videoplayer-paused')

      this.callHandler('playing')
    })

    addEventListener(this.video, 'pause', () => {
      if (this.video.currentTime !== 0) {
        this.videoWrapper.classList.add('videoplayer-paused')
      }
      this.videoWrapper.classList.remove('videoplayer-playing')

      this.callHandler('pause')
    })

    addEventListener(this.video, 'ended', () => {
      this.videoWrapper.classList.remove('videoplayer-paused')
      this.videoWrapper.classList.remove('videoplayer-playing')
      this.videoWrapper.classList.add('videoplayer-ended')
      this.toggleFullscreen(false)
      this.callHandler('ended')
      this.changeState(ENDED_STATE)
    })

    addEventListener(this.video, 'volumechange', () => {
      if (this.video.volume === 0 || this.video.muted) {
        this.videoWrapper.classList.add('muted')
      } else {
        this.videoWrapper.classList.remove('muted')
      }
      this.callHandler('volumechange')
    })

    addEventListener(this.video, 'loadeddata', () => {
      this.callHandler('loadeddata')
    })

    addEventListener(this.video, 'progress', () => {
      this.callHandler('progress')
    })

    addEventListener(this.video, 'suspend', () => {
      this.callHandler('suspend')
    })

    addEventListener(this.video, 'abort', () => {
      this.callHandler('abort')
    })

    addEventListener(this.video, 'error', () => {
      this.callHandler('error')
    })

    addEventListener(this.video, 'emptied', () => {
      this.callHandler('emptied')
    })

    addEventListener(this.video, 'stalled', () => {
      this.callHandler('stalled')
    })

    addEventListener(this.video, 'waiting', () => {
      this.callHandler('waiting')
    })

    addEventListener(this.video, 'seeking', () => {
      this.callHandler('seeking')
    })

    addEventListener(this.video, 'seeked', () => {
      this.callHandler('seeked')
    })

    addEventListener(this.video, 'durationchange', () => {
      this.callHandler('durationchange')
    })

    addEventListener(this.video, 'play', () => {
      this.callHandler('play')
    })

    if (this.controls && this.controls.length) {
      const mousemoveHandler = () => {
        this.videoWrapper.classList.add('user-activity')
        if (fadeout != null) {
          clearTimeout(fadeout)
        }
        fadeout = setTimeout(() => {
          this.videoWrapper.classList.remove('user-activity')
        }, 1350)
      }

      let fadeout = null
      addEventListener(this.video, 'mousemove', mousemoveHandler)

      forEach(this.controls, control => {
        addEventListener(control, 'mousemove', mousemoveHandler)
      })
    }
  }

  /**
   * Assigns handlers to add / remove the fullscreen class to / from
   * videoWrapper, and the fullscreened-element class to / from the body
   * element.
   *
   * @method VideoPlayer#fullscreenStateTracking
   */
  fullscreenStateTracking () {
    addEventListener(document, 'fullscreenchange', (e) => {
      const target = e.target || e.srcElement
      if (this.videoWrapper === target) {
        if (document.fullScreen || document.fullscreenElement) {
          this.videoWrapper.classList.add('fullscreen')
          document.body.classList.add('fullscreened-element')
        } else {
          this.videoWrapper.classList.remove('fullscreen')
          document.body.classList.remove('fullscreened-element')
        }
        this.callHandler('fullscreenchange')
      }
    })

    addEventListener(this.video, 'webkitendfullscreen', () => {
      this.pause()
    })

    addEventListener(document, 'webkitfullscreenchange', (e) => {
      const target = e.target || e.srcElement
      if (this.videoWrapper === target) {
        if (document.webkitIsFullScreen) {
          this.videoWrapper.classList.add('fullscreen')
          document.body.classList.add('fullscreened-element')
        } else {
          this.videoWrapper.classList.remove('fullscreen')
          document.body.classList.remove('fullscreened-element')
        }
        this.callHandler('fullscreenchange')
      }
    })

    addEventListener(document, 'mozfullscreenchange', (e) => {
      const target = e.target || e.srcElement
      if (this.videoWrapper === target) {
        if (document.mozFullScreen) {
          this.videoWrapper.classList.add('fullscreen')
          document.body.classList.add('fullscreened-element')
        } else {
          this.videoWrapper.classList.remove('fullscreen')
          document.body.classList.remove('fullscreened-element')
        }
        this.callHandler('fullscreenchange')
      }
    })

    addEventListener(document, 'msfullscreenchange', (e) => {
      const target = e.target || e.srcElement
      if (this.videoWrapper === target) {
        if (document.msFullscreenElement) {
          this.videoWrapper.classList.add('fullscreen')
          document.body.classList.add('fullscreened-element')
        } else {
          this.videoWrapper.classList.remove('fullscreen')
          document.body.classList.remove('fullscreened-element')
        }
        this.callHandler('fullscreenchange')
      }
    })
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
    forEach(this.progressBars, progressBar => {
      const lower = this.options.progressLowerColor
      const upper = this.options.progressUpperColor
      addListenerMulti(progressBar, 'input change', () => {
        const position = progressBar.value / progressBar.getAttribute('max') *
                         100
        progressBar.style.background =
          'linear-gradient(to right, ' + lower + ' 0%, ' +
                           lower + ' ' + position + '%, ' +
                           upper + ' ' + position + '%, ' +
                           upper + ' 100%)'
      })
      triggerEvent(progressBar, 'input')

      // Pause playback if user is adjusting playback position.
      // addEventListener(progressBar, 'mousedown', () => {
      //   this.videoWrapper.classList.add('scrubbing');
      //   this.video.pause();
      // });

      // Use input not change as we'll be triggering change programatically.
      // Also this way it updates as the user slides, not only at the end.
      addEventListener(progressBar, 'input', () => {
        const time = this.video.duration *
                     (progressBar.value / progressBar.getAttribute('max'))
        this.video.currentTime = time
      })

      // Resume playback when progress bar released.
      // addEventListener(progressBar, 'mouseup', () => {
      //   this.videoWrapper.classList.remove('scrubbing');
      //   this.video.play();
      // });
    })

    forEach(this.volumeBars, volumeBar => {
      const lower = this.options.progressLowerColor
      const upper = this.options.progressUpperColor
      addListenerMulti(volumeBar, 'input change', () => {
        const position = volumeBar.value / volumeBar.getAttribute('max') * 100
        volumeBar.style.background =
          'linear-gradient(to right, ' + lower + ' 0%, ' +
                           lower + ' ' + position + '%, ' +
                           upper + ' ' + position + '%, ' +
                           upper + ' 100%)'
      })
      triggerEvent(volumeBar, 'input')

      addEventListener(volumeBar, 'change', () => {
        this.video.volume = volumeBar.value
      })
    })

    addEventListener(this.video, 'click', (e) => {
      const target = e.target || e.srcElement
      if (!closest(target, 'a')) {
        e.preventDefault()
        this.playpause()
      }
    })

    forEach(this.posters, poster => {
      addEventListener(poster, 'click', (e) => {
        const target = e.target || e.srcElement
        if (!closest(target, 'a')) {
          e.preventDefault()
          this.play()
        }
      })
    })

    forEach(this.playpauseControls, playpauseControl => {
      addEventListener(playpauseControl, 'click', (e) => {
        e.preventDefault()
        this.playpause()
      })
    })

    const fullScreenEnabled =
      !!(document.fullscreenEnabled ||
         document.mozFullScreenEnabled ||
         document.msFullscreenEnabled ||
         document.webkitSupportsFullscreen ||
         document.webkitFullscreenEnabled ||
         document.createElement('video').webkitRequestFullScreen)

    forEach(this.controls, control => {
      forEach(control.getElementsByClassName('mute'), muteButton => {
        addEventListener(muteButton, 'click', (e) => {
          e.preventDefault()
          this.video.muted = !this.video.muted
        })
      })

      forEach(control.getElementsByClassName('volinc'), volinc => {
        addEventListener(volinc, 'click', (e) => {
          e.preventDefault()
          this.alterVolume('+')
        })
      })

      forEach(control.getElementsByClassName('voldec'), voldec => {
        addEventListener(voldec, 'click', (e) => {
          e.preventDefault()
          this.alterVolume('-')
        })
      })

      if (!fullScreenEnabled) {
        forEach(control.getElementsByClassName('fs'), fs => {
          fs.style.display = 'none'
        })
      } else {
        forEach(control.getElementsByClassName('fs'), fs => {
          addEventListener(fs, 'click', (e) => {
            this.toggleFullscreen()
          })
        })
      }
    })

    forEach(this.fallbackProgresses, fallbackProgress => {
      addEventListener(fallbackProgress, 'click', (e) => {
        const boundingRect = fallbackProgress.getBoundingClientRect()
        const pos = (e.pageX - boundingRect.left) / boundingRect.width
        this.video.currentTime = pos * this.video.duration
        for (let fallbackProgressBar of
          fallbackProgress.getElementsByClassName(
            'fallback-progress-bar')) {
          fallbackProgressBar.style.width =
            Math.floor((this.video.currentTime /
                        this.video.duration) * 100) + '%'
        }
      })
    })
  }

  /**
   * Assigns handlers for advancing the progress bar as the video plays.
   *
   * @method VideoPlayer#progressUpdaters
   */
  progressUpdaters () {
    addEventListener(this.video, 'loadedmetadata', () => {
      forEach(this.progressBars, progressBar => {
        progressBar.setAttribute('max', this.video.duration)
      })
    })

    addEventListener(this.video, 'timeupdate', () => {
      let value = this.video.currentTime
      // round to nearest .25
      value = (Math.round(value * 4) / 4).toFixed(2)

      forEach(this.progressBars, progressBar => {
        // fallback for browsers that don't trigger loadedmetadata correctly.
        if (!progressBar.getAttribute('max')) {
          progressBar.setAttribute('max', this.video.duration)
        }

        progressBar.value = value
        triggerEvent(progressBar, 'change')
      })

      forEach(this.fallbackProgressBars, fallbackProgressBar => {
        fallbackProgressBar.style.width =
          Math.floor((this.video.currentTime /
                      this.video.duration) * 100) + '%'
      })

      this.callHandler('timeupdate')
    })
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
    if (LOADED_VIDEOS.indexOf(this) === -1) {
      // If we've already loaded 6 videos, remove the oldest ones until
      // we only have 5, so the next video can start loading even in Chrome.
      while (LOADED_VIDEOS.length > 5) {
        const removed = LOADED_VIDEOS.shift()
        console.warn('Five videos already loaded. Unloading oldest.')
        removed.unloadVideo.bind(removed)()
      }

      LOADED_VIDEOS.push(this)

      this.assignSources()
      // Results in play being called in canplay handler if autoplay is true
      if (preload === 'metadata') {
        // there's no method we can use to do this, so we have to rely on the
        // preload attribute
        this.setAttribute('preload', preload)
      } else {
        this.video.load()
      }
    }
  }

  /**
   * Unloads the video, resetting the markup such that the poster is displayed.
   *
   * @method VideoPlayer#unloadVideo
   */
  unloadVideo () {
    this.teardown()

    const classNames = ['metadata-loaded', 'canplay', 'canplaythrough',
      'videoplayer-paused', 'videoplayer-playing', 'videoplayer-ended',
      'videoplayer-preplay']
    forEach(classNames, className => {
      this.videoWrapper.classList.remove(className)
    })
    this.changeState(INITIAL_STATE)
  }

  /**
   * Plays the video.
   *
   * @method VideoPlayer#_play
   */
  _play () {
    const promise = this.video.play()
    promise.then(() => {
      this.changeState(PLAYING_STATE)
    }).catch((err) => {
      // If error is because user hasn't interacted with document, simply
      // remove loading state so user sees play button
      if (err.code === 0) {
        this.videoWrapper.classList.remove('videoplayer-loading')

      // don't enter error state for "The play() request was interrupted by a
      // call to pause()".
      } else if (err.code !== 20) {
        this.videoWrapper.classList.add('videoplayer-error')
      }
      console.error(err)
    })
  }

  /**
   * Entry point for playing a video. Plays the video after loading it first,
   * if necessary.
   *
   * @method VideoPlayer#play
   */
  play () {
    this.videoWrapper.classList.remove('videoplayer-ended')
    if (this.video.readyState === 0) {
      this.videoWrapper.classList.add('videoplayer-preplay')
      const loadingTimeout = window.setTimeout(() => {
        this.videoWrapper.classList.add('videoplayer-loading')
        this.videoWrapper.classList.remove('videoplayer-preplay')
      }, 2000)

      var that = this
      addEventListener(this.video, 'canplay', function callPlay () {
        if (loadingTimeout) {
          window.clearTimeout(loadingTimeout)
          that.videoWrapper.classList.remove('videoplayer-preplay')
        }
        that.video.removeEventListener('canplay', callPlay)
        that._play()
      })
      this.loadVideo()
    } else {
      this._play()
    }
  }

  /**
   * Pauses the video.
   *
   * @method VideoPlayer#pause
   */
  pause () {
    this.video.pause()
    this.changeState(PAUSED_STATE)
  }

  /**
   * Toggles between play / pause.
   *
   * @method VideoPlayer#playpause
   */
  playpause () {
    if (this.state === PLAYING_STATE) {
      this.pause()
    } else {
      this.play()
    }
  }

  /**
   * Changes the video volume.
   *
   * @method VideoPlayer#alterVolume
   * @param {string} dir - '+' or '-'
   */
  alterVolume (dir) {
    const currentVolume = Math.floor(this.video.volume * 10) / 10
    if (dir === '+') {
      if (currentVolume < 1) {
        this.video.volume += 0.1
      }
    } else if (dir === '-') {
      if (currentVolume > 0) {
        this.video.volume -= 0.1
      }
    }
    this.video.muted = false
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
              document.fullscreenElement)
  }

  /**
   * Toggles whether the videoplayer is fullscreen or not.
   *
   * @method VideoPlayer#toggleFullscreen
   */
  toggleFullscreen (toggle) {
    if (this.isFullScreen() || toggle === false) {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen()
      } else if (document.webkitCancelFullScreen) {
        document.webkitCancelFullScreen()
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen()
      }
    } else {
      if (this.videoWrapper.requestFullscreen) {
        this.videoWrapper.requestFullscreen()
      } else if (this.videoWrapper.mozRequestFullScreen) {
        this.videoWrapper.mozRequestFullScreen()
      } else if (this.videoWrapper.webkitRequestFullScreen) {
        this.videoWrapper.webkitRequestFullScreen()
      } else if (this.videoWrapper.msRequestFullscreen) {
        this.videoWrapper.msRequestFullscreen()
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
   * @param {Object} data - {sources: [{source: '', mobileSource: '', type: ''}, ...]}
   * @param {string} play - whether to play the video immediately after loading
   */
  replaceSrc (data, play) {
    // Avoid Chrome bug.
    this.unloadVideo()

    if (play) {
      this.videoWrapper.classList.add('videoplayer-loading')
      this.changeState(LOADING_STATE)
    }

    forEach(this.sources, source => {
      source.parentNode.removeChild(source)
    })

    if (data.sources) {
      forEach(data.sources, sourceDict => {
        const newSource = document.createElement('source')
        newSource.dataset.src = sourceDict.source
        newSource.dataset.mobileSrc = sourceDict.mobileSource
        newSource.setAttribute('type', sourceDict.type)
        this.video.appendChild(newSource)
      })
    }

    this.sources = this.video.getElementsByTagName('source')

    if (play) {
      this.loadVideo()
      this._play()
    }
  }

  /**
   * Replaces the entire video-player based on data. See docstring for
   * replaceSrc regarding data.sources.
   *
   * @method VideoPlayer#replaceVideoPlayer
   * @param {Object} data - a JSON representation of a video-player.
   */
  replaceVideoPlayer (data) {
    const videoplayerInner =
      this.videoWrapper.querySelector('.videoplayer-inner')

    let posterEls = Array.from(videoplayerInner.children).filter(
      (el) => el.matches(
        ':not(noscript):not(.video):not(.playpause):not(.video-controls)'))

    forEach(posterEls, posterEl => {
      posterEl.parentNode.removeChild(posterEl)
    })

    if (data.poster_markup) {
      const newPoster = document.createElement('div')
      newPoster.innerHTML = data.poster_markup
      posterEls = Array.from(newPoster.children)
      forEach(posterEls, posterEl => {
        videoplayerInner.appendChild(posterEl)
      })
    }

    let playImmediately = !!data.autoplay
    if (data.autoplayMinWidth) {
      playImmediately = playImmediately &&
        getWindowWidth() >= data.autoplayMinWidth
    }

    if (playImmediately) {
      // If the video is to autoplay, enforce preload auto.
      data.preload = 'auto'
    }

    this.video.setAttribute('preload', data.preload)

    if (data.muted) {
      this.video.setAttribute('muted', '')
    } else {
      this.video.removeAttribute('muted')
    }

    if (data.playsinline) {
      this.video.setAttribute('playsinline', '')
    } else {
      this.video.removeAttribute('playsinline')
    }

    this.replaceSrc(data, playImmediately)

    if (data.loop) {
      this.video.setAttribute('loop', '')
    } else {
      this.video.removeAttribute('loop')
    }

    this.videoWrapper.classList.toggle('show-controls', !!data.controls)

    let caption = this.videoWrapper.querySelector('.caption')
    if (caption) {
      caption.parentNode.removeChild(caption)
    }
    if (data.caption) {
      caption = document.createElement('p')
      caption.setAttribute('class', 'caption')
      caption.innerHTML = data.caption
      this.videoWrapper.appendChild(caption)
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
    this.video.pause()

    forEach(this.sources, source => {
      source.removeAttribute('src')
    })
    this.video.load()

    for (let i = LOADED_VIDEOS.length - 1; i >= 0; i--) {
      if (LOADED_VIDEOS[i] === this) {
        LOADED_VIDEOS.splice(i, 1)
      }
    }
  }
}
