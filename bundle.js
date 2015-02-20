(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/home/meandave/Code/midi-bored/index.js":[function(require,module,exports){
var AudioSource = require('audiosource');
var AudioContext = require('audiocontext');
var context = new AudioContext();
var midiAccess=null;	// the MIDIAccess object.
var activeNotes = [];	// the stack of actively-pressed keys
var gainNode = context.createGain();
var deviceEl = document.querySelector('.device');

var drum = new AudioSource(context, {
  url: '/snare.wav',
  gainNode: gainNode
});

drum.loadSilent();

if (navigator.requestMIDIAccess)
	navigator.requestMIDIAccess().then(onMIDIInit, onMIDIReject);
else
	alert("No MIDI support present in your browser.");

function onMIDIInit(midi) {
	midiAccess = midi;

	if ((typeof(midiAccess.inputs) == "function")) {  //Old Skool MIDI inputs() code
		var inputs=midiAccess.inputs();
		if (inputs.length === 0)
			alert("No MIDI input devices present.  You're gonna have a bad time.")
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
			alert("No MIDI input devices present. Try plugging one in.");
	}
}

function MIDIMessageEventHandler(event) {
  console.log(event.data);
	// Mask off the lower nibble (MIDI channel, which we don't care about)
	switch (event.data[0] & 0xf0) {
	case 0x90:
		if (event.data[2]!=0) {  // if velocity != 0, this is a note-on message
			noteOn(event.data[1]);
			return;
		}
		// if velocity == 0, fall thru: it's a note-off.  MIDI's weird, ya'll.
	case 0x80:
		noteOff(event.data[1]);
		return;
	}
}

function onMIDIReject(err) {
	alert("The MIDI system failed to start.  Try again.");
}

function noteOn(noteNumber) {
  drum.play();
  // activeNotes.push( noteNumber );
}

function noteOff(noteNumber) {}

},{"audiocontext":"/home/meandave/Code/midi-bored/node_modules/audiocontext/src/audiocontext.js","audiosource":"/home/meandave/Code/midi-bored/node_modules/audiosource/index.js"}],"/home/meandave/Code/midi-bored/node_modules/audiocontext/src/audiocontext.js":[function(require,module,exports){
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

},{}]},{},["/home/meandave/Code/midi-bored/index.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi91c3IvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvbWVhbmRhdmUvQ29kZS9taWRpLWJvcmVkL2luZGV4LmpzIiwiL2hvbWUvbWVhbmRhdmUvQ29kZS9taWRpLWJvcmVkL25vZGVfbW9kdWxlcy9hdWRpb2NvbnRleHQvc3JjL2F1ZGlvY29udGV4dC5qcyIsIi9ob21lL21lYW5kYXZlL0NvZGUvbWlkaS1ib3JlZC9ub2RlX21vZHVsZXMvYXVkaW9zb3VyY2UvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgQXVkaW9Tb3VyY2UgPSByZXF1aXJlKCdhdWRpb3NvdXJjZScpO1xudmFyIEF1ZGlvQ29udGV4dCA9IHJlcXVpcmUoJ2F1ZGlvY29udGV4dCcpO1xudmFyIGNvbnRleHQgPSBuZXcgQXVkaW9Db250ZXh0KCk7XG52YXIgbWlkaUFjY2Vzcz1udWxsO1x0Ly8gdGhlIE1JRElBY2Nlc3Mgb2JqZWN0LlxudmFyIGFjdGl2ZU5vdGVzID0gW107XHQvLyB0aGUgc3RhY2sgb2YgYWN0aXZlbHktcHJlc3NlZCBrZXlzXG52YXIgZ2Fpbk5vZGUgPSBjb250ZXh0LmNyZWF0ZUdhaW4oKTtcbnZhciBkZXZpY2VFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5kZXZpY2UnKTtcblxudmFyIGRydW0gPSBuZXcgQXVkaW9Tb3VyY2UoY29udGV4dCwge1xuICB1cmw6ICcvc25hcmUud2F2JyxcbiAgZ2Fpbk5vZGU6IGdhaW5Ob2RlXG59KTtcblxuZHJ1bS5sb2FkU2lsZW50KCk7XG5cbmlmIChuYXZpZ2F0b3IucmVxdWVzdE1JRElBY2Nlc3MpXG5cdG5hdmlnYXRvci5yZXF1ZXN0TUlESUFjY2VzcygpLnRoZW4ob25NSURJSW5pdCwgb25NSURJUmVqZWN0KTtcbmVsc2Vcblx0YWxlcnQoXCJObyBNSURJIHN1cHBvcnQgcHJlc2VudCBpbiB5b3VyIGJyb3dzZXIuXCIpO1xuXG5mdW5jdGlvbiBvbk1JRElJbml0KG1pZGkpIHtcblx0bWlkaUFjY2VzcyA9IG1pZGk7XG5cblx0aWYgKCh0eXBlb2YobWlkaUFjY2Vzcy5pbnB1dHMpID09IFwiZnVuY3Rpb25cIikpIHsgIC8vT2xkIFNrb29sIE1JREkgaW5wdXRzKCkgY29kZVxuXHRcdHZhciBpbnB1dHM9bWlkaUFjY2Vzcy5pbnB1dHMoKTtcblx0XHRpZiAoaW5wdXRzLmxlbmd0aCA9PT0gMClcblx0XHRcdGFsZXJ0KFwiTm8gTUlESSBpbnB1dCBkZXZpY2VzIHByZXNlbnQuICBZb3UncmUgZ29ubmEgaGF2ZSBhIGJhZCB0aW1lLlwiKVxuXHRcdGVsc2UgeyAvLyBIb29rIHRoZSBtZXNzYWdlIGhhbmRsZXIgZm9yIGFsbCBNSURJIGlucHV0c1xuXHRcdFx0Zm9yICh2YXIgaT0wO2k8aW5wdXRzLmxlbmd0aDtpKyspXG5cdFx0XHRcdGlucHV0c1tpXS5vbm1pZGltZXNzYWdlID0gTUlESU1lc3NhZ2VFdmVudEhhbmRsZXI7XG5cdFx0fVxuXHR9IGVsc2UgeyAgLy8gbmV3IE1JRElNYXAgaW1wbGVtZW50YXRpb25cblx0XHR2YXIgaGF2ZUF0TGVhc3RPbmVEZXZpY2U9ZmFsc2U7XG5cdFx0dmFyIGlucHV0cz1taWRpQWNjZXNzLmlucHV0cy52YWx1ZXMoKTtcbiAgICB2YXIgZmlyc3QgPSB0cnVlO1xuXHRcdGZvciAoIHZhciBpbnB1dCA9IGlucHV0cy5uZXh0KCk7IGlucHV0ICYmICFpbnB1dC5kb25lOyBpbnB1dCA9IGlucHV0cy5uZXh0KCkpIHtcbiAgICAgIGlmIChmaXJzdCkge1xuICAgICAgICBkZXZpY2VFbC5pbm5lclRleHQgPSBpbnB1dC52YWx1ZS5uYW1lO1xuICAgICAgICBmaXJzdCA9IGZhbHNlO1xuICAgICAgfVxuXHRcdFx0aW5wdXQudmFsdWUub25taWRpbWVzc2FnZSA9IE1JRElNZXNzYWdlRXZlbnRIYW5kbGVyO1xuXHRcdFx0aGF2ZUF0TGVhc3RPbmVEZXZpY2UgPSB0cnVlO1xuXHRcdH1cblx0XHRpZiAoIWhhdmVBdExlYXN0T25lRGV2aWNlKVxuXHRcdFx0YWxlcnQoXCJObyBNSURJIGlucHV0IGRldmljZXMgcHJlc2VudC4gVHJ5IHBsdWdnaW5nIG9uZSBpbi5cIik7XG5cdH1cbn1cblxuZnVuY3Rpb24gTUlESU1lc3NhZ2VFdmVudEhhbmRsZXIoZXZlbnQpIHtcbiAgY29uc29sZS5sb2coZXZlbnQuZGF0YSk7XG5cdC8vIE1hc2sgb2ZmIHRoZSBsb3dlciBuaWJibGUgKE1JREkgY2hhbm5lbCwgd2hpY2ggd2UgZG9uJ3QgY2FyZSBhYm91dClcblx0c3dpdGNoIChldmVudC5kYXRhWzBdICYgMHhmMCkge1xuXHRjYXNlIDB4OTA6XG5cdFx0aWYgKGV2ZW50LmRhdGFbMl0hPTApIHsgIC8vIGlmIHZlbG9jaXR5ICE9IDAsIHRoaXMgaXMgYSBub3RlLW9uIG1lc3NhZ2Vcblx0XHRcdG5vdGVPbihldmVudC5kYXRhWzFdKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Ly8gaWYgdmVsb2NpdHkgPT0gMCwgZmFsbCB0aHJ1OiBpdCdzIGEgbm90ZS1vZmYuICBNSURJJ3Mgd2VpcmQsIHlhJ2xsLlxuXHRjYXNlIDB4ODA6XG5cdFx0bm90ZU9mZihldmVudC5kYXRhWzFdKTtcblx0XHRyZXR1cm47XG5cdH1cbn1cblxuZnVuY3Rpb24gb25NSURJUmVqZWN0KGVycikge1xuXHRhbGVydChcIlRoZSBNSURJIHN5c3RlbSBmYWlsZWQgdG8gc3RhcnQuICBUcnkgYWdhaW4uXCIpO1xufVxuXG5mdW5jdGlvbiBub3RlT24obm90ZU51bWJlcikge1xuICBkcnVtLnBsYXkoKTtcbiAgLy8gYWN0aXZlTm90ZXMucHVzaCggbm90ZU51bWJlciApO1xufVxuXG5mdW5jdGlvbiBub3RlT2ZmKG5vdGVOdW1iZXIpIHt9XG4iLCIvKlxuICogV2ViIEF1ZGlvIEFQSSBBdWRpb0NvbnRleHQgc2hpbVxuICovXG4oZnVuY3Rpb24gKGRlZmluaXRpb24pIHtcbiAgICBpZiAodHlwZW9mIGV4cG9ydHMgPT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBkZWZpbml0aW9uKCk7XG4gICAgfVxufSkoZnVuY3Rpb24gKCkge1xuICByZXR1cm4gd2luZG93LkF1ZGlvQ29udGV4dCB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0O1xufSk7XG4iLCIvKlxuICogQXVkaW9Tb3VyY2VcbiAqXG4gKiAqIE1VU1QgcGFzcyBhbiBhdWRpbyBjb250ZXh0XG4gKlxuICovXG5mdW5jdGlvbiBBdWRpb1NvdXJjZSAoY29udGV4dCwgb3B0cykge1xuICBpZiAoIWNvbnRleHQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXVkaW8gY29udGV4dCB0byB1c2UgdGhpcyBtb2R1bGUnKTtcbiAgfVxuICBpZiAob3B0cyA9PT0gdW5kZWZpbmVkKSBvcHRzID0ge307XG5cbiAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgdGhpcy5idWZmZXIgPSB1bmRlZmluZWQ7XG4gIHRoaXMudXJsID0gb3B0cy51cmwgPyBvcHRzLnVybCA6IHVuZGVmaW5lZDtcbiAgdGhpcy5mZnRzID0gb3B0cy5mZnRzID8gb3B0cy5mZnRzIDogW107XG4gIHRoaXMuZ2Fpbk5vZGUgPSBvcHRzLmdhaW5Ob2RlID8gb3B0cy5nYWluTm9kZSA6IHVuZGVmaW5lZDtcbn1cblxuQXVkaW9Tb3VyY2UucHJvdG90eXBlID0ge1xuICBuZWVkQnVmZmVyOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5idWZmZXIgPT09IHVuZGVmaW5lZDtcbiAgfSxcbiAgbG9hZFNvdW5kOiBmdW5jdGlvbih1cmwsIGNiKSB7XG4gICAgdmFyIHJlcSA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIHJlcS5vcGVuKCdHRVQnLCB1cmwsIHRydWUpO1xuICAgIHJlcS5yZXNwb25zZVR5cGUgPSAnYXJyYXlidWZmZXInO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXEub25sb2FkZW5kID0gZnVuY3Rpb24oKSB7XG4gICAgICBzZWxmLmRlY29kZS5jYWxsKHNlbGYsIHJlcS5yZXNwb25zZSwgY2IpO1xuICAgIH07XG4gICAgcmVxLnNlbmQoKTtcbiAgfSxcbiAgZ2V0QnVmZmVyOiBmdW5jdGlvbihjYikge1xuICAgIGlmICghdGhpcy5uZWVkQnVmZmVyKCkpIHJldHVybjtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5sb2FkU291bmQodGhpcy51cmwsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHNlbGYub25Mb2FkZWQuY2FsbChzZWxmLCBkYXRhLCB0cnVlKTtcbiAgICB9KTtcbiAgfSxcbiAgZ2V0U291cmNlOiBmdW5jdGlvbihjYikge1xuICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgY2IodGhpcy5zb3VyY2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHRoaXMubG9hZFNvdW5kKHRoaXMudXJsLCBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIHRoaXMuc291cmNlID0gc2VsZi5jcmVhdGVTb3VyY2UuY2FsbChzZWxmLCBkYXRhLCB0cnVlKTtcbiAgICAgICAgY2IodGhpcy5zb3VyY2UpO1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIG9uTG9hZGVkOiBmdW5jdGlvbihzb3VyY2UsIHNpbGVudCkge1xuICAgIHRoaXMuYnVmZmVyID0gc291cmNlO1xuICAgIHRoaXMuZGlzY29ubmVjdCgpO1xuICAgIHRoaXMuc291cmNlID0gdGhpcy5jb250ZXh0LmNyZWF0ZUJ1ZmZlclNvdXJjZSgpO1xuICAgIHRoaXMuc291cmNlLmJ1ZmZlciA9IHRoaXMuYnVmZmVyO1xuICAgIHRoaXMuc291cmNlLmNvbm5lY3QodGhpcy5nYWluTm9kZSk7XG4gICAgdGhpcy5mZnRzLmZvckVhY2goZnVuY3Rpb24oZmZ0KSB7XG4gICAgICB0aGlzLmdhaW5Ob2RlLmNvbm5lY3QoZmZ0LmlucHV0KTtcbiAgICB9LCB0aGlzKTtcbiAgICB0aGlzLmdhaW5Ob2RlLmNvbm5lY3QodGhpcy5jb250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICB0aGlzLmZmdHMuZm9yRWFjaChmdW5jdGlvbihmZnQpIHtcbiAgICAgIGZmdC5jb25uZWN0KHRoaXMuY29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgfSwgdGhpcyk7XG4gICAgaWYgKCFzaWxlbnQpIHRoaXMucGxheVNvdW5kKCk7XG4gIH0sXG4gIGRpc2Nvbm5lY3Q6IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLnNvdXJjZSkge1xuICAgICAgdGhpcy5zb3VyY2UuZGlzY29ubmVjdCh0aGlzLmNvbnRleHQuZGVzdGluYXRpb24pO1xuICAgIH1cbiAgfSxcbiAgcGxheVNvdW5kOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5wbGF5VGltZSkge1xuICAgICAgdGhpcy5zb3VyY2Uuc3RhcnQoMCwgdGhpcy5vZmZzZXQpO1xuICAgIH1cblxuICAgIHRoaXMucGxheVRpbWUgPSB0aGlzLmNvbnRleHQuY3VycmVudFRpbWU7XG4gIH0sXG4gIGxvYWRTaWxlbnQ6IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5uZWVkQnVmZmVyKCkpIHJldHVybjtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5sb2FkU291bmQodGhpcy51cmwsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIHNlbGYub25Mb2FkZWQuY2FsbChzZWxmLCBkYXRhLCB0cnVlKTtcbiAgICB9KTtcbiAgfSxcbiAgcGxheTogZnVuY3Rpb24oc3RhcnR0aW1lLCBvZmZzZXQpIHtcbiAgICB0aGlzLnBsYXlUaW1lID0gc3RhcnR0aW1lID8gc3RhcnR0aW1lIDogdGhpcy5jb250ZXh0LmN1cnJlbnRUaW1lO1xuICAgIHRoaXMub2Zmc2V0ID0gb2Zmc2V0ID8gb2Zmc2V0IDogMDtcblxuICAgIGlmICh0aGlzLm5lZWRCdWZmZXIoKSkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdGhpcy5sb2FkU291bmQodGhpcy51cmwsIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgc2VsZi5vbkxvYWRlZC5jYWxsKHNlbGYsIGRhdGEpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub25Mb2FkZWQodGhpcy5idWZmZXIpO1xuICAgIH1cbiAgfSxcbiAgc3RvcDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zb3VyY2Uuc3RvcCh0aGlzLmNvbnRleHQuY3VycmVudFRpbWUpO1xuICB9LFxuICBkZWNvZGU6IGZ1bmN0aW9uKGRhdGEsIHN1Y2Nlc3MsIGVycm9yKSB7XG4gICAgdGhpcy5jb250ZXh0LmRlY29kZUF1ZGlvRGF0YShkYXRhLCBzdWNjZXNzLCBlcnJvcik7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXVkaW9Tb3VyY2U7XG4iXX0=
