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
