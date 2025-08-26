// import React, { useEffect, useRef } from "react";

// export default function VideoCall() {
//   const localVideoRef = useRef();
//   const remoteVideoRef = useRef();
//   const pc = useRef(null);
//   const ws = useRef(null);

//   useEffect(() => {
//     const SIGNALING_SERVER_URL = "https://video-app-backend-8172.onrender.com"; // later replace with deployed URL
//     ws.current = new WebSocket(SIGNALING_SERVER_URL);

//     ws.current.onopen = () => {
//       console.log("Connected to signaling server");
//       ws.current.send(JSON.stringify({ type: "join" }));
//     };

//     ws.current.onmessage = async (message) => {
//       const data = JSON.parse(message.data);
//       console.log("Received:", data);

//       switch (data.type) {
//         case "ready":
//           createOffer();
//           break;
//         case "offer":
//           await pc.current.setRemoteDescription(data.offer);
//           const answer = await pc.current.createAnswer();
//           await pc.current.setLocalDescription(answer);
//           ws.current.send(JSON.stringify({ type: "answer", answer }));
//           break;
//         case "answer":
//           await pc.current.setRemoteDescription(data.answer);
//           break;
//         case "candidate":
//           try {
//             await pc.current.addIceCandidate(data.candidate);
//           } catch (err) {
//             console.error("Error adding ICE candidate", err);
//           }
//           break;
//         default:
//           break;
//       }
//     };

//     // Initialize peer connection
//     pc.current = new RTCPeerConnection();

//     pc.current.onicecandidate = (event) => {
//       if (event.candidate) {
//         ws.current.send(
//           JSON.stringify({ type: "candidate", candidate: event.candidate })
//         );
//       }
//     };

//     pc.current.ontrack = (event) => {
//       remoteVideoRef.current.srcObject = event.streams[0];
//     };

//     // Get user media (auto-start)
//     async function getMedia() {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: true,
//           audio: false,
//         });
//         localVideoRef.current.srcObject = stream;
//         stream.getTracks().forEach((track) => pc.current.addTrack(track, stream));
//       } catch (err) {
//         console.error("Media error:", err);
//       }
//     }

//     getMedia();

//     const createOffer = async () => {
//       const offer = await pc.current.createOffer();
//       await pc.current.setLocalDescription(offer);
//       ws.current.send(JSON.stringify({ type: "offer", offer }));
//     };
//   }, []);

//   return (
//     <div 
//       style={{
//         display: "flex",
//         flexDirection: "column",
//         alignItems: "center",
//         gap: "20px",
//         width: "100vw",
//         height: "100vh",
//         backgroundColor: "#000",
//         overflow: "hidden",
//       }}
//     >
//       <video ref={localVideoRef} autoPlay muted playsInline className="w-1/3 border rounded" />
//       <video ref={remoteVideoRef} autoPlay playsInline className="w-1/3 border rounded" />
//     </div>
//   );
// }


import React, { useEffect, useRef } from "react";

export default function VideoCall() {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pc = useRef(null);
  const ws = useRef(null);
  const localStream = useRef(null);

  // We'll assign polite/impolite randomly based on join order
  let polite = false;

  useEffect(() => {
    const SIGNALING_SERVER_URL = "https://video-app-backend-8172.onrender.com";
    ws.current = new WebSocket(SIGNALING_SERVER_URL);

    // --- Setup RTCPeerConnection ---
    pc.current = new RTCPeerConnection();

    // Send ICE candidates to signaling
    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        ws.current.send(
          JSON.stringify({ type: "candidate", candidate: event.candidate })
        );
      }
    };

    // When remote stream arrives
    pc.current.ontrack = (event) => {
      console.log("✅ Remote stream received:", event.streams);
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    // --- Get local media ---
    async function getMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStream.current = stream;
        localVideoRef.current.srcObject = stream;

        stream
          .getTracks()
          .forEach((track) => pc.current.addTrack(track, stream));
      } catch (err) {
        console.error("❌ Media error:", err);
      }
    }
    getMedia();

    // --- Create Offer ---
    async function createOffer() {
      try {
        const offer = await pc.current.createOffer();
        if (pc.current.signalingState !== "stable") return; // guard
        await pc.current.setLocalDescription(offer);
        ws.current.send(JSON.stringify({ type: "offer", offer: offer }));
      } catch (err) {
        console.error("Offer error:", err);
      }
    }

    // --- Handle negotiationneeded ---
    pc.current.onnegotiationneeded = async () => {
      console.log("⚡ Negotiation needed...");
      try {
        await createOffer();
      } catch (err) {
        console.error(err);
      }
    };

    // --- WebSocket Signaling ---
    ws.current.onopen = () => {
      console.log("Connected to signaling server ✅");
      ws.current.send(JSON.stringify({ type: "join" }));
    };

    ws.current.onmessage = async (message) => {
      const data = JSON.parse(message.data);
      console.log("📩 Received:", data);

      try {
        switch (data.type) {
          case "ready":
            // decide if polite or impolite
            // first peer = impolite, second peer = polite
            polite = true;
            break;

          case "offer": {
            const offerCollision =
              pc.current.signalingState !== "stable" || makingOffer;

            if (offerCollision && !polite) {
              console.warn("❌ Ignoring offer due to collision (impolite)");
              return;
            }

            console.log("📩 Applying remote offer...");
            await pc.current.setRemoteDescription(
              new RTCSessionDescription(data.offer)
            );
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            ws.current.send(
              JSON.stringify({ type: "answer", answer: answer })
            );
            break;
          }

          case "answer": {
            console.log("📩 Applying remote answer...");
            await pc.current.setRemoteDescription(
              new RTCSessionDescription(data.answer)
            );
            break;
          }

          case "candidate": {
            try {
              await pc.current.addIceCandidate(
                new RTCIceCandidate(data.candidate)
              );
            } catch (err) {
              if (!pc.current.remoteDescription) {
                console.warn("⚠️ Candidate ignored, no remoteDescription yet");
              } else {
                console.error("❌ Error adding ICE candidate:", err);
              }
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error("Signaling error:", err);
      }
    };

    let makingOffer = false;

    // wrap negotiation events
    pc.current.onnegotiationneeded = async () => {
      try {
        makingOffer = true;
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        ws.current.send(JSON.stringify({ type: "offer", offer }));
      } catch (err) {
        console.error("Negotiation error:", err);
      } finally {
        makingOffer = false;
      }
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000",
        position: "relative",
      }}
    >
      {/* Remote video fullscreen */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          background: "#222",
        }}
      />
      {/* Local video small in corner */}
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: "200px",
          height: "150px",
          position: "absolute",
          bottom: "20px",
          right: "20px",
          border: "2px solid white",
          borderRadius: "8px",
          objectFit: "cover",
        }}
      />
    </div>
  );
}
