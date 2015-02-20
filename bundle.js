(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/home/meandave/Code/midi-bored/index.js":[function(require,module,exports){
var AudioSource = require('audiosource');
var AudioContext = require('audiocontext');
var vkey = require('vkey');
var context = new AudioContext();
var messageEl = document.querySelector('.message');
var midiAccess=null;	// the MIDIAccess object.
var gainNode = context.createGain();
var deviceEl = document.querySelector('.device');
var urls = ['snare.wav', 'kick.wav', 'clap.wav', 'perc.wav'];
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

},{"audiocontext":"/home/meandave/Code/midi-bored/node_modules/audiocontext/src/audiocontext.js","audiosource":"/home/meandave/Code/midi-bored/node_modules/audiosource/index.js","vkey":"/home/meandave/Code/midi-bored/node_modules/vkey/index.js"}],"/home/meandave/Code/midi-bored/node_modules/audiocontext/src/audiocontext.js":[function(require,module,exports){
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

},{}],"/home/meandave/Code/midi-bored/node_modules/audiosource/index.js":[function(require,module,exports){
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

},{}],"/home/meandave/Code/midi-bored/node_modules/vkey/index.js":[function(require,module,exports){
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

},{}]},{},["/home/meandave/Code/midi-bored/index.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi91c3IvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvbWVhbmRhdmUvQ29kZS9taWRpLWJvcmVkL2luZGV4LmpzIiwiL2hvbWUvbWVhbmRhdmUvQ29kZS9taWRpLWJvcmVkL25vZGVfbW9kdWxlcy9hdWRpb2NvbnRleHQvc3JjL2F1ZGlvY29udGV4dC5qcyIsIi9ob21lL21lYW5kYXZlL0NvZGUvbWlkaS1ib3JlZC9ub2RlX21vZHVsZXMvYXVkaW9zb3VyY2UvaW5kZXguanMiLCIvaG9tZS9tZWFuZGF2ZS9Db2RlL21pZGktYm9yZWQvbm9kZV9tb2R1bGVzL3ZrZXkvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIEF1ZGlvU291cmNlID0gcmVxdWlyZSgnYXVkaW9zb3VyY2UnKTtcbnZhciBBdWRpb0NvbnRleHQgPSByZXF1aXJlKCdhdWRpb2NvbnRleHQnKTtcbnZhciB2a2V5ID0gcmVxdWlyZSgndmtleScpO1xudmFyIGNvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG52YXIgbWVzc2FnZUVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLm1lc3NhZ2UnKTtcbnZhciBtaWRpQWNjZXNzPW51bGw7XHQvLyB0aGUgTUlESUFjY2VzcyBvYmplY3QuXG52YXIgZ2Fpbk5vZGUgPSBjb250ZXh0LmNyZWF0ZUdhaW4oKTtcbnZhciBkZXZpY2VFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5kZXZpY2UnKTtcbnZhciB1cmxzID0gWydzbmFyZS53YXYnLCAna2ljay53YXYnLCAnY2xhcC53YXYnLCAncGVyYy53YXYnXTtcbnZhciBrZXlzID0gWydhJywgJ3MnLCAnZCcsICdmJ107XG52YXIgdHJpZ2dlcnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcudHJpZ2dlcicpO1xudmFyIG5vdGVNYXAgPSB7XG4gIDUzOiAwLFxuICA1NDogMSxcbiAgNTU6IDIsXG4gIDU2OiAzLFxuICBrZXlzOiB7XG4gICAgJ2EnOiAwLFxuICAgICdzJzogMSxcbiAgICAnZCc6IDIsXG4gICAgJ2YnOiAzXG4gIH1cbn07XG5cbmZvcih2YXIgaT0wOyBpPHRyaWdnZXJzLmxlbmd0aDsgaSsrKSB7XG4gIHRyaWdnZXJzW2ldLnNldEF0dHJpYnV0ZSgnZGF0YS1pbmRleCcsIGkpO1xuXG4gIHRyaWdnZXJzW2ldLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGZ1bmN0aW9uKGV2KSB7XG4gICAgbm90ZU9uKG51bGwsIGV2LnRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtaW5kZXgnKSwgZXYudGFyZ2V0KTtcbiAgfSk7XG5cbiAgdHJpZ2dlcnNbaV0uYWRkRXZlbnRMaXN0ZW5lcignbW91c2V1cCcsIGZ1bmN0aW9uKGV2KSB7XG4gICAgbm90ZU9mZihudWxsLCBldi50YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLWluZGV4JyksIGV2LnRhcmdldCk7XG4gIH0pO1xufVxuXG5kb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBmdW5jdGlvbihldikge1xuICBpZiAobm90ZU1hcC5rZXlzW3ZrZXlbZXYua2V5Q29kZV0udG9Mb3dlckNhc2UoKV0gIT09IHVuZGVmaW5lZCkge1xuICAgIG5vdGVPbihudWxsLCBub3RlTWFwLmtleXNbdmtleVtldi5rZXlDb2RlXS50b0xvd2VyQ2FzZSgpXSwgdHJpZ2dlcnNbbm90ZU1hcC5rZXlzW3ZrZXlbZXYua2V5Q29kZV0udG9Mb3dlckNhc2UoKV1dKTtcbiAgfVxufSwgZmFsc2UpO1xuXG5kb2N1bWVudC5ib2R5LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgZnVuY3Rpb24oZXYpIHtcbiAgaWYgKG5vdGVNYXAua2V5c1t2a2V5W2V2LmtleUNvZGVdLnRvTG93ZXJDYXNlKCldICE9PSB1bmRlZmluZWQpIHtcbiAgICBub3RlT2ZmKG51bGwsIG5vdGVNYXAua2V5c1t2a2V5W2V2LmtleUNvZGVdLnRvTG93ZXJDYXNlKCldLCB0cmlnZ2Vyc1tub3RlTWFwLmtleXNbdmtleVtldi5rZXlDb2RlXS50b0xvd2VyQ2FzZSgpXV0pO1xuICB9XG59LCBmYWxzZSk7XG5cbnZhciBraXQgPSBbXTtcblxudXJscy5mb3JFYWNoKGZ1bmN0aW9uKHVybCwgaSkge1xuICBraXQucHVzaChuZXcgQXVkaW9Tb3VyY2UoY29udGV4dCwge1xuICAgIHVybDogJy8nK3VybCxcbiAgICBnYWluTm9kZTogZ2Fpbk5vZGVcbiAgfSkpO1xuICBraXRbaV0ubG9hZFNpbGVudCgpO1xufSk7XG5cbmZvcih2YXIgaj0wOyBqIDwgdHJpZ2dlcnMubGVuZ3RoOyBqKyspIHtcbiAgdHJpZ2dlcnNbal0uaW5uZXJUZXh0ID0ga2V5c1tqXTtcbn1cblxuaWYgKG5hdmlnYXRvci5yZXF1ZXN0TUlESUFjY2VzcylcbiBuYXZpZ2F0b3IucmVxdWVzdE1JRElBY2Nlc3MoKS50aGVuKG9uTUlESUluaXQsIG9uTUlESVJlamVjdCk7XG5lbHNlIHtcbiAgbWVzc2FnZUVsLmlubmVyVGV4dCA9ICdZb3VyIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCB3ZWIgbWlkaSwgSSBzdWdnZXN0IHRyeWluZyB0aGlzIHdpdGggdGhlIGNocm9taXVtIGJyb3dzZXInO1xufVxuXG5mdW5jdGlvbiBvbk1JRElJbml0KG1pZGkpIHtcblx0bWlkaUFjY2VzcyA9IG1pZGk7XG5cblx0aWYgKCh0eXBlb2YobWlkaUFjY2Vzcy5pbnB1dHMpID09IFwiZnVuY3Rpb25cIikpIHsgIC8vT2xkIFNrb29sIE1JREkgaW5wdXRzKCkgY29kZVxuXHRcdHZhciBpbnB1dHM9bWlkaUFjY2Vzcy5pbnB1dHMoKTtcblx0XHRpZiAoaW5wdXRzLmxlbmd0aCA9PT0gMClcblx0XHRcdG1lc3NhZ2VFbC5pbm5lclRleHQgPSAnWW91ciBtaWRpIGRldmljZSBpcyBub3QgcGx1Z2dlZCBpbiwgb3IgdGhlcmUgd2FzIGEgYnVnIGluIG15IGNvZGUuIFlvdSBjYW4gc3RpbGwgcGxheSBub3RlcyB3aXRoIEFTREYgb24geW91ciBrZXlib2FyZCc7XG5cdFx0ZWxzZSB7IC8vIEhvb2sgdGhlIG1lc3NhZ2UgaGFuZGxlciBmb3IgYWxsIE1JREkgaW5wdXRzXG5cdFx0XHRmb3IgKHZhciBpPTA7aTxpbnB1dHMubGVuZ3RoO2krKylcblx0XHRcdFx0aW5wdXRzW2ldLm9ubWlkaW1lc3NhZ2UgPSBNSURJTWVzc2FnZUV2ZW50SGFuZGxlcjtcblx0XHR9XG5cdH0gZWxzZSB7ICAvLyBuZXcgTUlESU1hcCBpbXBsZW1lbnRhdGlvblxuXHRcdHZhciBoYXZlQXRMZWFzdE9uZURldmljZT1mYWxzZTtcblx0XHR2YXIgaW5wdXRzPW1pZGlBY2Nlc3MuaW5wdXRzLnZhbHVlcygpO1xuICAgIHZhciBmaXJzdCA9IHRydWU7XG5cdFx0Zm9yICggdmFyIGlucHV0ID0gaW5wdXRzLm5leHQoKTsgaW5wdXQgJiYgIWlucHV0LmRvbmU7IGlucHV0ID0gaW5wdXRzLm5leHQoKSkge1xuICAgICAgaWYgKGZpcnN0KSB7XG4gICAgICAgIGRldmljZUVsLmlubmVyVGV4dCA9IGlucHV0LnZhbHVlLm5hbWU7XG4gICAgICAgIGZpcnN0ID0gZmFsc2U7XG4gICAgICB9XG5cdFx0XHRpbnB1dC52YWx1ZS5vbm1pZGltZXNzYWdlID0gTUlESU1lc3NhZ2VFdmVudEhhbmRsZXI7XG5cdFx0XHRoYXZlQXRMZWFzdE9uZURldmljZSA9IHRydWU7XG5cdFx0fVxuXHRcdGlmICghaGF2ZUF0TGVhc3RPbmVEZXZpY2UpXG4gICAgICBtZXNzYWdlRWwuaW5uZXJUZXh0ID0gJ1lvdXIgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IHdlYiBtaWRpLCBJIHN1Z2dlc3QgdHJ5aW5nIHRoaXMgd2l0aCB0aGUgY2hyb21pdW0gYnJvd3Nlcic7XG5cdH1cbn1cblxuZnVuY3Rpb24gTUlESU1lc3NhZ2VFdmVudEhhbmRsZXIoZXZlbnQpIHtcbiAgY29uc29sZS5sb2coZXZlbnQuZGF0YSk7XG5cdC8vIE1hc2sgb2ZmIHRoZSBsb3dlciBuaWJibGUgKE1JREkgY2hhbm5lbCwgd2hpY2ggd2UgZG9uJ3QgY2FyZSBhYm91dClcblx0c3dpdGNoIChldmVudC5kYXRhWzBdICYgMHhmMCkge1xuXHRjYXNlIDB4OTA6XG5cdFx0aWYgKGV2ZW50LmRhdGFbMl0hPTApIHsgIC8vIGlmIHZlbG9jaXR5ICE9IDAsIHRoaXMgaXMgYSBub3RlLW9uIG1lc3NhZ2Vcblx0XHRcdG5vdGVPbihldmVudC5kYXRhWzFdLCBub3RlTWFwW2V2ZW50LmRhdGFbMV1dLCB0cmlnZ2Vyc1tub3RlTWFwW2V2ZW50LmRhdGFbMV1dXSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIGlmIHZlbG9jaXR5ID09IDAsIGZhbGwgdGhydTogaXQncyBhIG5vdGUtb2ZmLiAgTUlESSdzIHdlaXJkLCB5YSdsbC5cblx0Y2FzZSAweDgwOlxuXHRcdG5vdGVPZmYoZXZlbnQuZGF0YVsxXSwgbm90ZU1hcFtldmVudC5kYXRhWzFdXSwgdHJpZ2dlcnNbbm90ZU1hcFtldmVudC5kYXRhWzFdXV0pO1xuXHRcdHJldHVybjtcblx0fVxufVxuXG5mdW5jdGlvbiBvbk1JRElSZWplY3QoZXJyKSB7XG5cdGFsZXJ0KFwiVGhlIE1JREkgc3lzdGVtIGZhaWxlZCB0byBzdGFydC4gIFRyeSBhZ2Fpbi5cIik7XG59XG5cbmZ1bmN0aW9uIG5vdGVPbihub3RlTnVtYmVyLCBpZHgsIGVsKSB7XG4gIGlmIChpZHggPT09IHVuZGVmaW5lZCkgcmV0dXJuO1xuICBpZiAoZWwpIGVsLmNsYXNzTGlzdC5hZGQoJ2FjdGl2ZScpO1xuICBraXRbaWR4XS5wbGF5KCk7XG4gIC8vIGFjdGl2ZU5vdGVzLnB1c2goIG5vdGVOdW1iZXIgKTtcbn1cblxuZnVuY3Rpb24gbm90ZU9mZihub3RlTnVtYmVyLCBpZHgsIGVsKSB7XG4gIGlmIChpZHggPT09IHVuZGVmaW5lZCkgcmV0dXJuO1xuICBpZiAoZWwpIGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZScpO1xufVxuIiwiLypcbiAqIFdlYiBBdWRpbyBBUEkgQXVkaW9Db250ZXh0IHNoaW1cbiAqL1xuKGZ1bmN0aW9uIChkZWZpbml0aW9uKSB7XG4gICAgaWYgKHR5cGVvZiBleHBvcnRzID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gZGVmaW5pdGlvbigpO1xuICAgIH1cbn0pKGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHdpbmRvdy5BdWRpb0NvbnRleHQgfHwgd2luZG93LndlYmtpdEF1ZGlvQ29udGV4dDtcbn0pO1xuIiwiLypcbiAqIEF1ZGlvU291cmNlXG4gKlxuICogKiBNVVNUIHBhc3MgYW4gYXVkaW8gY29udGV4dFxuICpcbiAqL1xuZnVuY3Rpb24gQXVkaW9Tb3VyY2UgKGNvbnRleHQsIG9wdHMpIHtcbiAgaWYgKCFjb250ZXh0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBwYXNzIGFuIGF1ZGlvIGNvbnRleHQgdG8gdXNlIHRoaXMgbW9kdWxlJyk7XG4gIH1cbiAgaWYgKG9wdHMgPT09IHVuZGVmaW5lZCkgb3B0cyA9IHt9O1xuXG4gIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gIHRoaXMuYnVmZmVyID0gdW5kZWZpbmVkO1xuICB0aGlzLnVybCA9IG9wdHMudXJsID8gb3B0cy51cmwgOiB1bmRlZmluZWQ7XG4gIHRoaXMuZmZ0cyA9IG9wdHMuZmZ0cyA/IG9wdHMuZmZ0cyA6IFtdO1xuICB0aGlzLmdhaW5Ob2RlID0gb3B0cy5nYWluTm9kZSA/IG9wdHMuZ2Fpbk5vZGUgOiB1bmRlZmluZWQ7XG59XG5cbkF1ZGlvU291cmNlLnByb3RvdHlwZSA9IHtcbiAgbmVlZEJ1ZmZlcjogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyID09PSB1bmRlZmluZWQ7XG4gIH0sXG4gIGxvYWRTb3VuZDogZnVuY3Rpb24odXJsLCBjYikge1xuICAgIHZhciByZXEgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICByZXEub3BlbignR0VUJywgdXJsLCB0cnVlKTtcbiAgICByZXEucmVzcG9uc2VUeXBlID0gJ2FycmF5YnVmZmVyJztcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmVxLm9ubG9hZGVuZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgc2VsZi5kZWNvZGUuY2FsbChzZWxmLCByZXEucmVzcG9uc2UsIGNiKTtcbiAgICB9O1xuICAgIHJlcS5zZW5kKCk7XG4gIH0sXG4gIGdldEJ1ZmZlcjogZnVuY3Rpb24oY2IpIHtcbiAgICBpZiAoIXRoaXMubmVlZEJ1ZmZlcigpKSByZXR1cm47XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMubG9hZFNvdW5kKHRoaXMudXJsLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICBzZWxmLm9uTG9hZGVkLmNhbGwoc2VsZiwgZGF0YSwgdHJ1ZSk7XG4gICAgfSk7XG4gIH0sXG4gIGdldFNvdXJjZTogZnVuY3Rpb24oY2IpIHtcbiAgICBpZiAodGhpcy5zb3VyY2UpIHtcbiAgICAgIGNiKHRoaXMuc291cmNlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdGhpcy5kaXNjb25uZWN0KCk7XG4gICAgICB0aGlzLmxvYWRTb3VuZCh0aGlzLnVybCwgZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICB0aGlzLnNvdXJjZSA9IHNlbGYuY3JlYXRlU291cmNlLmNhbGwoc2VsZiwgZGF0YSwgdHJ1ZSk7XG4gICAgICAgIGNiKHRoaXMuc291cmNlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSxcblxuICBvbkxvYWRlZDogZnVuY3Rpb24oc291cmNlLCBzaWxlbnQpIHtcbiAgICB0aGlzLmJ1ZmZlciA9IHNvdXJjZTtcbiAgICB0aGlzLmRpc2Nvbm5lY3QoKTtcbiAgICB0aGlzLnNvdXJjZSA9IHRoaXMuY29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKTtcbiAgICB0aGlzLnNvdXJjZS5idWZmZXIgPSB0aGlzLmJ1ZmZlcjtcbiAgICB0aGlzLnNvdXJjZS5jb25uZWN0KHRoaXMuZ2Fpbk5vZGUpO1xuICAgIHRoaXMuZmZ0cy5mb3JFYWNoKGZ1bmN0aW9uKGZmdCkge1xuICAgICAgdGhpcy5nYWluTm9kZS5jb25uZWN0KGZmdC5pbnB1dCk7XG4gICAgfSwgdGhpcyk7XG4gICAgdGhpcy5nYWluTm9kZS5jb25uZWN0KHRoaXMuY29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgdGhpcy5mZnRzLmZvckVhY2goZnVuY3Rpb24oZmZ0KSB7XG4gICAgICBmZnQuY29ubmVjdCh0aGlzLmNvbnRleHQuZGVzdGluYXRpb24pO1xuICAgIH0sIHRoaXMpO1xuICAgIGlmICghc2lsZW50KSB0aGlzLnBsYXlTb3VuZCgpO1xuICB9LFxuICBkaXNjb25uZWN0OiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5zb3VyY2UpIHtcbiAgICAgIHRoaXMuc291cmNlLmRpc2Nvbm5lY3QodGhpcy5jb250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICB9XG4gIH0sXG4gIHBsYXlTb3VuZDogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMucGxheVRpbWUpIHtcbiAgICAgIHRoaXMuc291cmNlLnN0YXJ0KDAsIHRoaXMub2Zmc2V0KTtcbiAgICB9XG5cbiAgICB0aGlzLnBsYXlUaW1lID0gdGhpcy5jb250ZXh0LmN1cnJlbnRUaW1lO1xuICB9LFxuICBsb2FkU2lsZW50OiBmdW5jdGlvbigpIHtcbiAgICBpZiAoIXRoaXMubmVlZEJ1ZmZlcigpKSByZXR1cm47XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHRoaXMubG9hZFNvdW5kKHRoaXMudXJsLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICBzZWxmLm9uTG9hZGVkLmNhbGwoc2VsZiwgZGF0YSwgdHJ1ZSk7XG4gICAgfSk7XG4gIH0sXG4gIHBsYXk6IGZ1bmN0aW9uKHN0YXJ0dGltZSwgb2Zmc2V0KSB7XG4gICAgdGhpcy5wbGF5VGltZSA9IHN0YXJ0dGltZSA/IHN0YXJ0dGltZSA6IHRoaXMuY29udGV4dC5jdXJyZW50VGltZTtcbiAgICB0aGlzLm9mZnNldCA9IG9mZnNldCA/IG9mZnNldCA6IDA7XG5cbiAgICBpZiAodGhpcy5uZWVkQnVmZmVyKCkpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIHRoaXMubG9hZFNvdW5kKHRoaXMudXJsLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIHNlbGYub25Mb2FkZWQuY2FsbChzZWxmLCBkYXRhKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9uTG9hZGVkKHRoaXMuYnVmZmVyKTtcbiAgICB9XG4gIH0sXG4gIHN0b3A6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc291cmNlLnN0b3AodGhpcy5jb250ZXh0LmN1cnJlbnRUaW1lKTtcbiAgfSxcbiAgZGVjb2RlOiBmdW5jdGlvbihkYXRhLCBzdWNjZXNzLCBlcnJvcikge1xuICAgIHRoaXMuY29udGV4dC5kZWNvZGVBdWRpb0RhdGEoZGF0YSwgc3VjY2VzcywgZXJyb3IpO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1ZGlvU291cmNlO1xuIiwidmFyIHVhID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudCA6ICcnXG4gICwgaXNPU1ggPSAvT1MgWC8udGVzdCh1YSlcbiAgLCBpc09wZXJhID0gL09wZXJhLy50ZXN0KHVhKVxuICAsIG1heWJlRmlyZWZveCA9ICEvbGlrZSBHZWNrby8udGVzdCh1YSkgJiYgIWlzT3BlcmFcblxudmFyIGksIG91dHB1dCA9IG1vZHVsZS5leHBvcnRzID0ge1xuICAwOiAgaXNPU1ggPyAnPG1lbnU+JyA6ICc8VU5LPidcbiwgMTogICc8bW91c2UgMT4nXG4sIDI6ICAnPG1vdXNlIDI+J1xuLCAzOiAgJzxicmVhaz4nXG4sIDQ6ICAnPG1vdXNlIDM+J1xuLCA1OiAgJzxtb3VzZSA0PidcbiwgNjogICc8bW91c2UgNT4nXG4sIDg6ICAnPGJhY2tzcGFjZT4nXG4sIDk6ICAnPHRhYj4nXG4sIDEyOiAnPGNsZWFyPidcbiwgMTM6ICc8ZW50ZXI+J1xuLCAxNjogJzxzaGlmdD4nXG4sIDE3OiAnPGNvbnRyb2w+J1xuLCAxODogJzxhbHQ+J1xuLCAxOTogJzxwYXVzZT4nXG4sIDIwOiAnPGNhcHMtbG9jaz4nXG4sIDIxOiAnPGltZS1oYW5ndWw+J1xuLCAyMzogJzxpbWUtanVuamE+J1xuLCAyNDogJzxpbWUtZmluYWw+J1xuLCAyNTogJzxpbWUta2Fuamk+J1xuLCAyNzogJzxlc2NhcGU+J1xuLCAyODogJzxpbWUtY29udmVydD4nXG4sIDI5OiAnPGltZS1ub25jb252ZXJ0PidcbiwgMzA6ICc8aW1lLWFjY2VwdD4nXG4sIDMxOiAnPGltZS1tb2RlLWNoYW5nZT4nXG4sIDI3OiAnPGVzY2FwZT4nXG4sIDMyOiAnPHNwYWNlPidcbiwgMzM6ICc8cGFnZS11cD4nXG4sIDM0OiAnPHBhZ2UtZG93bj4nXG4sIDM1OiAnPGVuZD4nXG4sIDM2OiAnPGhvbWU+J1xuLCAzNzogJzxsZWZ0PidcbiwgMzg6ICc8dXA+J1xuLCAzOTogJzxyaWdodD4nXG4sIDQwOiAnPGRvd24+J1xuLCA0MTogJzxzZWxlY3Q+J1xuLCA0MjogJzxwcmludD4nXG4sIDQzOiAnPGV4ZWN1dGU+J1xuLCA0NDogJzxzbmFwc2hvdD4nXG4sIDQ1OiAnPGluc2VydD4nXG4sIDQ2OiAnPGRlbGV0ZT4nXG4sIDQ3OiAnPGhlbHA+J1xuLCA5MTogJzxtZXRhPicgIC8vIG1ldGEtbGVmdCAtLSBubyBvbmUgaGFuZGxlcyBsZWZ0IGFuZCByaWdodCBwcm9wZXJseSwgc28gd2UgY29lcmNlIGludG8gb25lLlxuLCA5MjogJzxtZXRhPicgIC8vIG1ldGEtcmlnaHRcbiwgOTM6IGlzT1NYID8gJzxtZXRhPicgOiAnPG1lbnU+JyAgICAgIC8vIGNocm9tZSxvcGVyYSxzYWZhcmkgYWxsIHJlcG9ydCB0aGlzIGZvciBtZXRhLXJpZ2h0IChvc3ggbWJwKS5cbiwgOTU6ICc8c2xlZXA+J1xuLCAxMDY6ICc8bnVtLSo+J1xuLCAxMDc6ICc8bnVtLSs+J1xuLCAxMDg6ICc8bnVtLWVudGVyPidcbiwgMTA5OiAnPG51bS0tPidcbiwgMTEwOiAnPG51bS0uPidcbiwgMTExOiAnPG51bS0vPidcbiwgMTQ0OiAnPG51bS1sb2NrPidcbiwgMTQ1OiAnPHNjcm9sbC1sb2NrPidcbiwgMTYwOiAnPHNoaWZ0LWxlZnQ+J1xuLCAxNjE6ICc8c2hpZnQtcmlnaHQ+J1xuLCAxNjI6ICc8Y29udHJvbC1sZWZ0PidcbiwgMTYzOiAnPGNvbnRyb2wtcmlnaHQ+J1xuLCAxNjQ6ICc8YWx0LWxlZnQ+J1xuLCAxNjU6ICc8YWx0LXJpZ2h0PidcbiwgMTY2OiAnPGJyb3dzZXItYmFjaz4nXG4sIDE2NzogJzxicm93c2VyLWZvcndhcmQ+J1xuLCAxNjg6ICc8YnJvd3Nlci1yZWZyZXNoPidcbiwgMTY5OiAnPGJyb3dzZXItc3RvcD4nXG4sIDE3MDogJzxicm93c2VyLXNlYXJjaD4nXG4sIDE3MTogJzxicm93c2VyLWZhdm9yaXRlcz4nXG4sIDE3MjogJzxicm93c2VyLWhvbWU+J1xuXG4gIC8vIGZmL29zeCByZXBvcnRzICc8dm9sdW1lLW11dGU+JyBmb3IgJy0nXG4sIDE3MzogaXNPU1ggJiYgbWF5YmVGaXJlZm94ID8gJy0nIDogJzx2b2x1bWUtbXV0ZT4nXG4sIDE3NDogJzx2b2x1bWUtZG93bj4nXG4sIDE3NTogJzx2b2x1bWUtdXA+J1xuLCAxNzY6ICc8bmV4dC10cmFjaz4nXG4sIDE3NzogJzxwcmV2LXRyYWNrPidcbiwgMTc4OiAnPHN0b3A+J1xuLCAxNzk6ICc8cGxheS1wYXVzZT4nXG4sIDE4MDogJzxsYXVuY2gtbWFpbD4nXG4sIDE4MTogJzxsYXVuY2gtbWVkaWEtc2VsZWN0PidcbiwgMTgyOiAnPGxhdW5jaC1hcHAgMT4nXG4sIDE4MzogJzxsYXVuY2gtYXBwIDI+J1xuLCAxODY6ICc7J1xuLCAxODc6ICc9J1xuLCAxODg6ICcsJ1xuLCAxODk6ICctJ1xuLCAxOTA6ICcuJ1xuLCAxOTE6ICcvJ1xuLCAxOTI6ICdgJ1xuLCAyMTk6ICdbJ1xuLCAyMjA6ICdcXFxcJ1xuLCAyMjE6ICddJ1xuLCAyMjI6IFwiJ1wiXG4sIDIyMzogJzxtZXRhPidcbiwgMjI0OiAnPG1ldGE+JyAgICAgICAvLyBmaXJlZm94IHJlcG9ydHMgbWV0YSBoZXJlLlxuLCAyMjY6ICc8YWx0LWdyPidcbiwgMjI5OiAnPGltZS1wcm9jZXNzPidcbiwgMjMxOiBpc09wZXJhID8gJ2AnIDogJzx1bmljb2RlPidcbiwgMjQ2OiAnPGF0dGVudGlvbj4nXG4sIDI0NzogJzxjcnNlbD4nXG4sIDI0ODogJzxleHNlbD4nXG4sIDI0OTogJzxlcmFzZS1lb2Y+J1xuLCAyNTA6ICc8cGxheT4nXG4sIDI1MTogJzx6b29tPidcbiwgMjUyOiAnPG5vLW5hbWU+J1xuLCAyNTM6ICc8cGEtMT4nXG4sIDI1NDogJzxjbGVhcj4nXG59XG5cbmZvcihpID0gNTg7IGkgPCA2NTsgKytpKSB7XG4gIG91dHB1dFtpXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUoaSlcbn1cblxuLy8gMC05XG5mb3IoaSA9IDQ4OyBpIDwgNTg7ICsraSkge1xuICBvdXRwdXRbaV0gPSAoaSAtIDQ4KSsnJ1xufVxuXG4vLyBBLVpcbmZvcihpID0gNjU7IGkgPCA5MTsgKytpKSB7XG4gIG91dHB1dFtpXSA9IFN0cmluZy5mcm9tQ2hhckNvZGUoaSlcbn1cblxuLy8gbnVtMC05XG5mb3IoaSA9IDk2OyBpIDwgMTA2OyArK2kpIHtcbiAgb3V0cHV0W2ldID0gJzxudW0tJysoaSAtIDk2KSsnPidcbn1cblxuLy8gRjEtRjI0XG5mb3IoaSA9IDExMjsgaSA8IDEzNjsgKytpKSB7XG4gIG91dHB1dFtpXSA9ICdGJysoaS0xMTEpXG59XG4iXX0=
