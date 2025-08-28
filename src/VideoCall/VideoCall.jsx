// import React, { useEffect, useRef, useState } from "react";

// export default function VideoCall() {
//   const localVideoRef = useRef(null);
//   const remoteVideoRef = useRef(null);
//   const pc = useRef(null);
//   const ws = useRef(null);
//   const localStream = useRef(null);

//   const [role, setRole] = useState(null); // "polite" or "impolite"
//   const makingOffer = useRef(false);
//   const ignoreOffer = useRef(false);
//   const pendingCandidates = useRef([]);

//   useEffect(() => {
//     const SIGNALING_SERVER_URL = "http://localhost:5000/"; // use wss if server supports TLS
//     ws.current = new WebSocket(SIGNALING_SERVER_URL);

//     // Use STUN — required for NAT traversal (replace/add TURN if you have one)
//     pc.current = new RTCPeerConnection({
//       iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//     });

//     // --- ICE candidates: send to signaling ---
//     pc.current.onicecandidate = (event) => {
//       if (event.candidate && ws.current && ws.current.readyState === WebSocket.OPEN) {
//         ws.current.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
//       }
//     };

//     // --- Remote track arrived ---
//     pc.current.ontrack = (event) => {
//       // event.streams[0] is the remote MediaStream
//       if (remoteVideoRef.current) {
//         remoteVideoRef.current.srcObject = event.streams[0];
//       }
//       console.log("Remote stream attached", event.streams);
//     };

//     // Buffer local media tracks
//     async function getMedia() {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
//         localStream.current = stream;
//         if (localVideoRef.current) localVideoRef.current.srcObject = stream;

//         stream.getTracks().forEach((track) => {
//           pc.current.addTrack(track, stream);
//         });
//       } catch (err) {
//         console.error("Media error:", err);
//       }
//     }
//     getMedia();

//     // negotiation handling (single handler)
//     pc.current.onnegotiationneeded = async () => {
//       try {
//         makingOffer.current = true;
//         const offer = await pc.current.createOffer();
//         await pc.current.setLocalDescription(offer);
//         ws.current.send(JSON.stringify({ type: "offer", offer: offer }));
//       } catch (err) {
//         console.error("Negotiation error:", err);
//       } finally {
//         makingOffer.current = false;
//       }
//     };

//     // --- WebSocket handlers ---
//     ws.current.onopen = () => {
//       console.log("Connected to signaling server");
//       // tell server we joined (server assigns roles)
//       ws.current.send(JSON.stringify({ type: "join" }));
//     };

//     ws.current.onmessage = async (message) => {
//       let data;
//       try {
//         data = JSON.parse(message.data);
//       } catch (e) {
//         console.error("Invalid JSON from signaling:", e);
//         return;
//       }
//       console.log("Signaling message:", data);

//       try {
//         switch (data.type) {
//           case "id":
//             // optional: server-sent id
//             console.log("My signaling id:", data.id);
//             break;

//           case "role":
//             setRole(data.role);
//             console.log("Assigned role:", data.role);
//             break;

//           case "ready":
//             console.log("Peer found — ready");
//             break;

//           case "offer": {
//             // RFC 8445 style collision avoidance
//             const offerCollision =
//               makingOffer.current || pc.current.signalingState !== "stable";

//             if (offerCollision) {
//               if (role === "impolite") {
//                 // impolite: ignore incoming offer if collision
//                 console.warn("Ignoring incoming offer due to collision (impolite)");
//                 return;
//               } else {
//                 // polite: handle collision by accepting remote offer
//                 console.log("Offer collision: polite peer will accept remote offer");
//               }
//             }

//             // apply remote offer
//             await pc.current.setRemoteDescription(new RTCSessionDescription(data.offer));

//             // add any pending remote candidates that were buffered earlier
//             while (pendingCandidates.current.length) {
//               try {
//                 await pc.current.addIceCandidate(pendingCandidates.current.shift());
//               } catch (e) {
//                 console.warn("Failed to add buffered candidate:", e);
//               }
//             }

//             const answer = await pc.current.createAnswer();
//             await pc.current.setLocalDescription(answer);
//             ws.current.send(JSON.stringify({ type: "answer", answer }));
//             break;
//           }

//           case "answer": {
//             if (pc.current.signalingState === "have-local-offer" || pc.current.signalingState === "have-remote-offer" || pc.current.signalingState === "stable") {
//               await pc.current.setRemoteDescription(new RTCSessionDescription(data.answer));
//             } else {
//               // unexpected but try anyway
//               await pc.current.setRemoteDescription(new RTCSessionDescription(data.answer));
//             }
//             break;
//           }

//           case "candidate": {
//             const candidateObj = new RTCIceCandidate(data.candidate);
//             // If remoteDescription not set yet, buffer candidate
//             if (!pc.current.remoteDescription || !pc.current.remoteDescription.type) {
//               pendingCandidates.current.push(candidateObj);
//             } else {
//               try {
//                 await pc.current.addIceCandidate(candidateObj);
//               } catch (err) {
//                 console.error("Error adding ICE candidate:", err);
//               }
//             }
//             break;
//           }

//           case "peer-left":
//             console.log("Peer left");
//             // optionally clean up remote video
//             if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
//             break;

//           case "full":
//             console.warn("Room full:", data.msg);
//             break;

//           default:
//             console.log("Unhandled signaling type:", data.type);
//             break;
//         }
//       } catch (err) {
//         console.error("Signaling error:", err);
//       }
//     };

//     ws.current.onerror = (err) => {
//       console.error("WebSocket error:", err);
//     };

//     // cleanup on unmount
//     return () => {
//       try {
//         if (ws.current && ws.current.readyState === WebSocket.OPEN) {
//           ws.current.send(JSON.stringify({ type: "bye" }));
//           ws.current.close();
//         }
//       } catch (e) {
//         // ignore
//       }

//       if (pc.current) {
//         pc.current.getSenders().forEach((s) => {
//           try {
//             if (s.track) s.track.stop();
//           } catch (e) {}
//         });
//         try {
//           pc.current.close();
//         } catch (e) {}
//       }

//       if (localStream.current) {
//         localStream.current.getTracks().forEach((t) => t.stop());
//       }
//     };
//   }, [role]); // role included to ensure it's set from server; effect is safe because we only want one connection lifecycle

//   return (
//     <div
//       style={{
//         width: "100vw",
//         height: "100vh",
//         backgroundColor: "#000",
//         position: "relative",
//       }}
//     >
//       <video
//         ref={remoteVideoRef}
//         autoPlay
//         playsInline
//         style={{
//           width: "100%",
//           height: "100%",
//           objectFit: "cover",
//           background: "#222",
//           transform: "scaleX(-1)",
//         }}
//       />
//       <video
//         ref={localVideoRef}
//         autoPlay
//         muted
//         playsInline
//         style={{
//           width: "200px",
//           height: "150px",
//           position: "absolute",
//           bottom: "20px",
//           right: "20px",
//           border: "2px solid white",
//           borderRadius: "8px",
//           objectFit: "cover",
//           transform: "scaleX(-1)",
//         }}
//       />
//     </div>
//   );
// }



import React, { useEffect, useRef, useState } from "react";

export default function VideoCall() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pc = useRef(null);
  const ws = useRef(null);
  const localStream = useRef(null);

  const [role, setRole] = useState(null); // "polite" or "impolite"
  const makingOffer = useRef(false);
  const pendingCandidates = useRef([]);

  // get ?room= from URL or default
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room") || "default";

  useEffect(() => {
    const SIGNALING_SERVER_URL = "https://video-app-backend-8172.onrender.com"; // use wss:// if deployed on HTTPS
    ws.current = new WebSocket(SIGNALING_SERVER_URL);

    // --- WebRTC peer connection ---
    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.current.onicecandidate = (event) => {
      if (event.candidate && ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(
          JSON.stringify({ type: "candidate", candidate: event.candidate })
        );
      }
    };

    pc.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    async function getMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStream.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        stream.getTracks().forEach((track) => {
          pc.current.addTrack(track, stream);
        });
      } catch (err) {
        console.error("Media error:", err);
      }
    }
    getMedia();

    // negotiation
    pc.current.onnegotiationneeded = async () => {
      try {
        makingOffer.current = true;
        const offer = await pc.current.createOffer();
        await pc.current.setLocalDescription(offer);
        ws.current.send(JSON.stringify({ type: "offer", offer }));
      } catch (err) {
        console.error("Negotiation error:", err);
      } finally {
        makingOffer.current = false;
      }
    };

    // --- WebSocket ---
    ws.current.onopen = () => {
      console.log("Connected to signaling server");
      ws.current.send(JSON.stringify({ type: "join", room }));
    };

    ws.current.onmessage = async (message) => {
      let data;
      try {
        data = JSON.parse(message.data);
      } catch (e) {
        console.error("Invalid JSON:", e);
        return;
      }

      switch (data.type) {
        case "id":
          console.log("My id:", data.id);
          break;

        case "role":
          setRole(data.role);
          console.log("Assigned role:", data.role);
          break;

        case "ready":
          console.log("Peer found — ready");
          break;

        case "offer": {
          const offerCollision =
            makingOffer.current || pc.current.signalingState !== "stable";

          if (offerCollision && role === "impolite") {
            console.warn("Ignoring offer due to collision (impolite)");
            return;
          }

          await pc.current.setRemoteDescription(
            new RTCSessionDescription(data.offer)
          );

          while (pendingCandidates.current.length) {
            try {
              await pc.current.addIceCandidate(
                pendingCandidates.current.shift()
              );
            } catch (e) {
              console.warn("Failed to add buffered candidate:", e);
            }
          }

          const answer = await pc.current.createAnswer();
          await pc.current.setLocalDescription(answer);
          ws.current.send(JSON.stringify({ type: "answer", answer }));
          break;
        }

        case "answer":
          try {
            await pc.current.setRemoteDescription(
              new RTCSessionDescription(data.answer)
            );
          } catch (err) {
            console.error("Error applying answer:", err);
          }
          break;

        case "candidate": {
          const candidateObj = new RTCIceCandidate(data.candidate);
          if (!pc.current.remoteDescription) {
            pendingCandidates.current.push(candidateObj);
          } else {
            try {
              await pc.current.addIceCandidate(candidateObj);
            } catch (err) {
              console.error("Error adding ICE:", err);
            }
          }
          break;
        }

        case "peer-left":
          console.log("Peer left");
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
          break;

        case "full":
          console.warn("Room full:", data.msg);
          break;

        default:
          console.log("Unhandled:", data);
      }
    };

    ws.current.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    return () => {
      try {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: "bye" }));
          ws.current.close();
        }
      } catch {}

      if (pc.current) {
        pc.current.getSenders().forEach((s) => s.track?.stop());
        pc.current.close();
      }

      if (localStream.current) {
        localStream.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [role, room]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000",
        position: "relative",
      }}
    >
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          background: "#222",
          transform: "scaleX(-1)",
        }}
      />
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
          transform: "scaleX(-1)",
        }}
      />
    </div>
  );
}
