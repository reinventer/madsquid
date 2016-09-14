'use strict';

var callButton = document.getElementById('callButton');
var acceptButton = document.getElementById('acceptButton');
var hangupButton = document.getElementById('hangupButton');
callButton.disabled = true;
acceptButton.disabled = true;
hangupButton.disabled = true;

callButton.onclick = call;

// var startTime;
var localVideo = document.getElementById('localVideo');
var remoteVideo = document.getElementById('remoteVideo');


var userNameInput = document.getElementById('userName');
var userCalleeInput = document.getElementById('userCallee');

userNameInput.onkeyup = userChanges;
userCalleeInput.onkeyup = userChanges;

start();

function userChanges(evt) {
	callButton.disabled = !(userNameInput.value && userCalleeInput.value)
}

var localStream;
var pc;
var offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

function gotStream(stream) {
  console.log('Received local stream');
  localVideo.srcObject = stream;
  localStream = stream;
  callButton.disabled = !(userNameInput.value && userCalleeInput.value);
}

function start() {
  console.log('Requesting local stream');
  callButton.disabled = true;
  navigator.mediaDevices.getUserMedia({ audio: true, video: true })
  .then(gotStream)
  .catch(logError);
};

function SignalingChannel() {
	this.start = function() {
		this.getMessages()
	};

	this.getMessages = function() {
		if (userNameInput.value) {
			$.ajax('/messages', {
				headers: {
					'X-User-Name': userNameInput.value
				},

				success: function(data, textStatus, jqXHR) {
					data = JSON.parse(data)
					for (var i=0; i<data.length; i++) {
						parseMsg(data[i])
					}
				}
			})
		}
		var self = this
		this.timerId = setTimeout(function () {self.getMessages()}, 1000)
	};

	this.send = function(callee, type, content) {
		console.log(userNameInput.value + ' => ' + callee)
		if (userNameInput.value) {
			$.ajax('/messages', {
				method: 'PUT',

				data: {
					callee: callee,
					type: type,
					content: content
				},

				headers: {
					'X-User-Name': userNameInput.value
				},

				error: function(jqXHR, textStatus, errorThrown) {
					console.log(textStatus);
				}
			})
		}		
	}
}
var signalingChannel = new SignalingChannel()
signalingChannel.start()

function call() {
	pc = new RTCPeerConnection(null);

    // send any ice candidates to the other peer
    pc.onicecandidate = function (evt) {
    	console.log('Event "onicecandidate"')
        signalingChannel.send(userCallee.value, "candidate", evt.candidate);
    };

    // let the "negotiationneeded" event trigger offer generation
    pc.onnegotiationneeded = function () {
    	console.log('Event "onnegotiationneeded"')
        pc.createOffer().then(function (offer) {
            return pc.setLocalDescription(offer);
        })
        .then(function () {
            // send the offer to the other peer
            signalingChannel.send(userCallee.value, "desc", pc.localDescription);
        })
        .catch(logError);
    };

    // once remote video track arrives, show it in the remote video element
    // pc.ontrack = function (evt) {
    // 	console.log('Event "ontrack"')
    //     if (evt.track.kind === "video")
    //       remoteVideo.srcObject = evt.streams[0];
    // };
    pc.onaddstream = gotRemoteStream;

    // get a local stream, show it in a self-view and add it to be sent
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    .then (function (stream) {
        pc.addStream(stream)
        localVideo.srcObject = stream;

        // var videoTracks = stream.getVideoTracks()
        // var audioTracks = stream.getAudioTracks()
        // if (audioTracks.length > 0)
        //     pc.addTrack(audioTracks[0], stream);
        // if (videoTracks.length > 0)
        //     pc.addTrack(videoTracks[0], stream);
    })
    .catch(logError);
}

function parseMsg(data) {
	if (data.type == "offer") {
		console.log('offer received')
		pc = new RTCPeerConnection(null);

		pc.onicecandidate = function (evt) {
    		console.log('Event "onicecandidate"')
        	signalingChannel.send(userCallee.value, "candidate", evt.candidate);
    	};
    	pc.ontrack = function (evt) {
    		console.log('Event "ontrack"')
        	if (evt.track.kind === "video")
          	remoteVideo.srcObject = evt.streams[0];
    	};
    	pc.onaddstream = gotRemoteStream;

        pc.setRemoteDescription(data.content).then(function () {
            return pc.createAnswer();
        })
        .then(function (answer) {
            return pc.setLocalDescription(answer);
        })
        .then(function () {
            signalingChannel.send(data.from, "desc", pc.localDescription);
        })
        .catch(logError);
	} else if (data.type == "answer") {
		console.log('answer received')
        pc.setRemoteDescription(data.content).catch(logError);
    } else if (data.type == "candidate") {
    	console.log('candidate received')
    	pc.addIceCandidate(data.content).catch(logError);
    } else {
        console.log("Unsupported SDP type. Your code may differ here.");
    }
}

function gotRemoteStream(e) {
  remoteVideo.srcObject = e.stream;
  console.log('received remote stream');
}

function logError(error) {
    console.log(error.name + ": " + error.message);
}