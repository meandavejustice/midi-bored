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
