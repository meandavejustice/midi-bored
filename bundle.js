(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var AudioSource = require('audiosource');
var AudioContext = require('audiocontext');
var vkey = require('vkey');
var context = new AudioContext();
var messageEl = document.querySelector('.message');
var midiAccess=null;	// the MIDIAccess object.
var gainNode = context.createGain();
var deviceEl = document.querySelector('.device');
var urls = ['midi-bored/snare.wav',
            'midi-bored/kick.wav',
            'midi-bored/clap.wav',
            'midi-bored/perc.wav'];
var keys = ['a', 's', 'd', 'f'];
var triggers = document.querySelectorAll('.trigger');
var noteMap = {
  53: 0,
  54: 1,
  55: 2,
  56: 3,
  keys: {
    'a': 0,
    's': 1,
    'd': 2,
    'f': 3
  }
};

for(var i=0; i<triggers.length; i++) {
  triggers[i].setAttribute('data-index', i);

  triggers[i].addEventListener('mousedown', function(ev) {
    noteOn(null, ev.target.getAttribute('data-index'), ev.target);
  });

  triggers[i].addEventListener('mouseup', function(ev) {
    noteOff(null, ev.target.getAttribute('data-index'), ev.target);
  });
}

document.body.addEventListener('keydown', function(ev) {
  if (noteMap.keys[vkey[ev.keyCode].toLowerCase()] !== undefined) {
    noteOn(null, noteMap.keys[vkey[ev.keyCode].toLowerCase()], triggers[noteMap.keys[vkey[ev.keyCode].toLowerCase()]]);
  }
}, false);

document.body.addEventListener('keyup', function(ev) {
  if (noteMap.keys[vkey[ev.keyCode].toLowerCase()] !== undefined) {
    noteOff(null, noteMap.keys[vkey[ev.keyCode].toLowerCase()], triggers[noteMap.keys[vkey[ev.keyCode].toLowerCase()]]);
  }
}, false);

var kit = [];

urls.forEach(function(url, i) {
  kit.push(new AudioSource(context, {
    url: '/'+url,
    gainNode: gainNode
  }));
  kit[i].loadSilent();
});

for(var j=0; j < triggers.length; j++) {
  triggers[j].innerText = keys[j];
}

if (navigator.requestMIDIAccess)
 navigator.requestMIDIAccess().then(onMIDIInit, onMIDIReject);
else {
  messageEl.innerText = 'Your browser does not support web midi, I suggest trying this with the chromium browser';
}

function onMIDIInit(midi) {
	midiAccess = midi;

	if ((typeof(midiAccess.inputs) == "function")) {  //Old Skool MIDI inputs() code
		var inputs=midiAccess.inputs();
		if (inputs.length === 0)
			messageEl.innerText = 'Your midi device is not plugged in, or there was a bug in my code. You can still play notes with ASDF on your keyboard';
		else { // Hook the message handler for all MIDI inputs
			for (var i=0;i<inputs.length;i++)
				inputs[i].onmidimessage = MIDIMessageEventHandler;
		}
	} else {  // new MIDIMap implementation
		var haveAtLeastOneDevice=false;
		var inputs=midiAccess.inputs.values();
    var first = true;
		for ( var input = inputs.next(); input && !input.done; input = inputs.next()) {
      if (first) {
        deviceEl.innerText = input.value.name;
        first = false;
      }
			input.value.onmidimessage = MIDIMessageEventHandler;
			haveAtLeastOneDevice = true;
		}
		if (!haveAtLeastOneDevice)
      messageEl.innerText = 'Your browser does not support web midi, I suggest trying this with the chromium browser';
	}
}

function MIDIMessageEventHandler(event) {
  console.log(event.data);
	// Mask off the lower nibble (MIDI channel, which we don't care about)
	switch (event.data[0] & 0xf0) {
	case 0x90:
		if (event.data[2]!=0) {  // if velocity != 0, this is a note-on message
			noteOn(event.data[1], noteMap[event.data[1]], triggers[noteMap[event.data[1]]]);
			return;
		}
		// if velocity == 0, fall thru: it's a note-off.  MIDI's weird, ya'll.
	case 0x80:
		noteOff(event.data[1], noteMap[event.data[1]], triggers[noteMap[event.data[1]]]);
		return;
	}
}

function onMIDIReject(err) {
	alert("The MIDI system failed to start.  Try again.");
}

function noteOn(noteNumber, idx, el) {
  if (idx === undefined) return;
  if (el) el.classList.add('active');
  kit[idx].play();
  // activeNotes.push( noteNumber );
}

function noteOff(noteNumber, idx, el) {
  if (idx === undefined) return;
  if (el) el.classList.remove('active');
}

},{"audiocontext":2,"audiosource":3,"vkey":4}],2:[function(require,module,exports){
/*
 * Web Audio API AudioContext shim
 */
(function (definition) {
    if (typeof exports === "object") {
        module.exports = definition();
    }
})(function () {
  return window.AudioContext || window.webkitAudioContext;
});

},{}],3:[function(require,module,exports){
/*
 * AudioSource
 *
 * * MUST pass an audio context
 *
 */
function AudioSource (context, opts) {
  if (!context) {
    throw new Error('You must pass an audio context to use this module');
  }
  if (opts === undefined) opts = {};

  this.context = context;
  this.buffer = undefined;
  this.url = opts.url ? opts.url : undefined;
  this.ffts = opts.ffts ? opts.ffts : [];
  this.gainNode = opts.gainNode ? opts.gainNode : undefined;
}

AudioSource.prototype = {
  needBuffer: function() {
    return this.buffer === undefined;
  },
  loadSound: function(url, cb) {
    var req = new XMLHttpRequest();
    req.open('GET', url, true);
    req.responseType = 'arraybuffer';
    var self = this;
    req.onloadend = function() {
      self.decode.call(self, req.response, cb);
    };
    req.send();
  },
  getBuffer: function(cb) {
    if (!this.needBuffer()) return;
    var self = this;
    this.loadSound(this.url, function(data) {
      self.onLoaded.call(self, data, true);
    });
  },
  getSource: function(cb) {
    if (this.source) {
      cb(this.source);
    } else {
      var self = this;
      this.disconnect();
      this.loadSound(this.url, function(data) {
        this.source = self.createSource.call(self, data, true);
        cb(this.source);
      });
    }
  },

  onLoaded: function(source, silent) {
    this.buffer = source;
    this.disconnect();
    this.source = this.context.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.gainNode);
    this.ffts.forEach(function(fft) {
      this.gainNode.connect(fft.input);
    }, this);
    this.gainNode.connect(this.context.destination);
    this.ffts.forEach(function(fft) {
      fft.connect(this.context.destination);
    }, this);
    if (!silent) this.playSound();
  },
  disconnect: function() {
    if (this.source) {
      this.source.disconnect(this.context.destination);
    }
  },
  playSound: function() {
    if (this.playTime) {
      this.source.start(0, this.offset);
    }

    this.playTime = this.context.currentTime;
  },
  loadSilent: function() {
    if (!this.needBuffer()) return;
    var self = this;
    this.loadSound(this.url, function(data) {
      self.onLoaded.call(self, data, true);
    });
  },
  play: function(starttime, offset) {
    this.playTime = starttime ? starttime : this.context.currentTime;
    this.offset = offset ? offset : 0;

    if (this.needBuffer()) {
      var self = this;
      this.loadSound(this.url, function(data) {
        self.onLoaded.call(self, data);
      });
    } else {
      this.onLoaded(this.buffer);
    }
  },
  stop: function() {
    this.source.stop(this.context.currentTime);
  },
  decode: function(data, success, error) {
    this.context.decodeAudioData(data, success, error);
  }
};

module.exports = AudioSource;

},{}],4:[function(require,module,exports){
var ua = typeof window !== 'undefined' ? window.navigator.userAgent : ''
  , isOSX = /OS X/.test(ua)
  , isOpera = /Opera/.test(ua)
  , maybeFirefox = !/like Gecko/.test(ua) && !isOpera

var i, output = module.exports = {
  0:  isOSX ? '<menu>' : '<UNK>'
, 1:  '<mouse 1>'
, 2:  '<mouse 2>'
, 3:  '<break>'
, 4:  '<mouse 3>'
, 5:  '<mouse 4>'
, 6:  '<mouse 5>'
, 8:  '<backspace>'
, 9:  '<tab>'
, 12: '<clear>'
, 13: '<enter>'
, 16: '<shift>'
, 17: '<control>'
, 18: '<alt>'
, 19: '<pause>'
, 20: '<caps-lock>'
, 21: '<ime-hangul>'
, 23: '<ime-junja>'
, 24: '<ime-final>'
, 25: '<ime-kanji>'
, 27: '<escape>'
, 28: '<ime-convert>'
, 29: '<ime-nonconvert>'
, 30: '<ime-accept>'
, 31: '<ime-mode-change>'
, 27: '<escape>'
, 32: '<space>'
, 33: '<page-up>'
, 34: '<page-down>'
, 35: '<end>'
, 36: '<home>'
, 37: '<left>'
, 38: '<up>'
, 39: '<right>'
, 40: '<down>'
, 41: '<select>'
, 42: '<print>'
, 43: '<execute>'
, 44: '<snapshot>'
, 45: '<insert>'
, 46: '<delete>'
, 47: '<help>'
, 91: '<meta>'  // meta-left -- no one handles left and right properly, so we coerce into one.
, 92: '<meta>'  // meta-right
, 93: isOSX ? '<meta>' : '<menu>'      // chrome,opera,safari all report this for meta-right (osx mbp).
, 95: '<sleep>'
, 106: '<num-*>'
, 107: '<num-+>'
, 108: '<num-enter>'
, 109: '<num-->'
, 110: '<num-.>'
, 111: '<num-/>'
, 144: '<num-lock>'
, 145: '<scroll-lock>'
, 160: '<shift-left>'
, 161: '<shift-right>'
, 162: '<control-left>'
, 163: '<control-right>'
, 164: '<alt-left>'
, 165: '<alt-right>'
, 166: '<browser-back>'
, 167: '<browser-forward>'
, 168: '<browser-refresh>'
, 169: '<browser-stop>'
, 170: '<browser-search>'
, 171: '<browser-favorites>'
, 172: '<browser-home>'

  // ff/osx reports '<volume-mute>' for '-'
, 173: isOSX && maybeFirefox ? '-' : '<volume-mute>'
, 174: '<volume-down>'
, 175: '<volume-up>'
, 176: '<next-track>'
, 177: '<prev-track>'
, 178: '<stop>'
, 179: '<play-pause>'
, 180: '<launch-mail>'
, 181: '<launch-media-select>'
, 182: '<launch-app 1>'
, 183: '<launch-app 2>'
, 186: ';'
, 187: '='
, 188: ','
, 189: '-'
, 190: '.'
, 191: '/'
, 192: '`'
, 219: '['
, 220: '\\'
, 221: ']'
, 222: "'"
, 223: '<meta>'
, 224: '<meta>'       // firefox reports meta here.
, 226: '<alt-gr>'
, 229: '<ime-process>'
, 231: isOpera ? '`' : '<unicode>'
, 246: '<attention>'
, 247: '<crsel>'
, 248: '<exsel>'
, 249: '<erase-eof>'
, 250: '<play>'
, 251: '<zoom>'
, 252: '<no-name>'
, 253: '<pa-1>'
, 254: '<clear>'
}

for(i = 58; i < 65; ++i) {
  output[i] = String.fromCharCode(i)
}

// 0-9
for(i = 48; i < 58; ++i) {
  output[i] = (i - 48)+''
}

// A-Z
for(i = 65; i < 91; ++i) {
  output[i] = String.fromCharCode(i)
}

// num0-9
for(i = 96; i < 106; ++i) {
  output[i] = '<num-'+(i - 96)+'>'
}

// F1-F24
for(i = 112; i < 136; ++i) {
  output[i] = 'F'+(i-111)
}

},{}]},{},[1])