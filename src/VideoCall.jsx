import React, { useEffect, useRef, useState } from "react";

export default function VideoCall() {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pc = useRef(null);
  const ws = useRef(null);

  const [hasRemote, setHasRemote] = useState(false);

  useEffect(() => {
    const SIGNALING_SERVER_URL = "https://video-app-backend-8172.onrender.com";
    ws.current = new WebSocket(SIGNALING_SERVER_URL);

    ws.current.onopen = () => {
      console.log("Connected to signaling server");
      ws.current.send(JSON.stringify({ type: "join" }));
    };

    ws.current.onmessage = async (message) => {
      const data = JSON.parse(message.data);
      console.log("Received:", data);

      switch (data.type) {
        case "ready":
          createOffer();
          break;
        case "offer":
          await pc.current.setRemoteDescription(data.offer);
          const answer = await pc.current.createAnswer();
          await pc.current.setLocalDescription(answer);
          ws.current.send(JSON.stringify({ type: "answer", answer }));
          break;
        case "answer":
          await pc.current.setRemoteDescription(data.answer);
          break;
        case "candidate":
          try {
            await pc.current.addIceCandidate(data.candidate);
          } catch (err) {
            console.error("Error adding ICE candidate", err);
          }
          break;
        default:
          break;
      }
    };

    pc.current = new RTCPeerConnection();

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        ws.current.send(
          JSON.stringify({ type: "candidate", candidate: event.candidate })
        );
      }
    };

    pc.current.ontrack = (event) => {
      console.log("Remote stream received");
      remoteVideoRef.current.srcObject = event.streams[0];
      setHasRemote(true); // Switch UI to remote
    };

    async function getMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach((track) => pc.current.addTrack(track, stream));
      } catch (err) {
        console.error("Media error:", err);
      }
    }

    getMedia();

    const createOffer = async () => {
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      ws.current.send(JSON.stringify({ type: "offer", offer }));
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000",
        overflow: "hidden",
      }}
    >
      {/* Show local video if no remote is present */}
      {!hasRemote && (
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}

      {/* Show remote video once another client joins */}
      {hasRemote && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
    </div>
  );
}
