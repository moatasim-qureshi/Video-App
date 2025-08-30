// import React, { useEffect, useRef, useState } from "react";

// export default function VideoCall() {
//   const localVideoRef = useRef(null);
//   const remoteVideoRef = useRef(null);
//   const pc = useRef(null);
//   const ws = useRef(null);
//   const localStream = useRef(null);

//   const [role, setRole] = useState(null); // "polite" or "impolite"
//   const makingOffer = useRef(false);
//   const pendingCandidates = useRef([]);

//   // get ?room= from URL or default
//   const params = new URLSearchParams(window.location.search);
//   const room = params.get("room") || "default";

//   useEffect(() => {
//     // const SIGNALING_SERVER_URL = "https://video-app-backend-8172.onrender.com"; // use wss:// if deployed on HTTPS
//     const SIGNALING_SERVER_URL = "http://localhost:5000/";
//     ws.current = new WebSocket(SIGNALING_SERVER_URL);

//     // --- WebRTC peer connection ---
//     pc.current = new RTCPeerConnection({
//       iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//     });

//     pc.current.onicecandidate = (event) => {
//       if (event.candidate && ws.current?.readyState === WebSocket.OPEN) {
//         ws.current.send(
//           JSON.stringify({ type: "candidate", candidate: event.candidate })
//         );
//       }
//     };

//     pc.current.ontrack = (event) => {
//       if (remoteVideoRef.current) {
//         remoteVideoRef.current.srcObject = event.streams[0];
//       }
//     };

//     async function getMedia() {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: true,
//           audio: true,
//         });
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

//     // negotiation
//     pc.current.onnegotiationneeded = async () => {
//       try {
//         makingOffer.current = true;
//         const offer = await pc.current.createOffer();
//         await pc.current.setLocalDescription(offer);
//         ws.current.send(JSON.stringify({ type: "offer", offer }));
//       } catch (err) {
//         console.error("Negotiation error:", err);
//       } finally {
//         makingOffer.current = false;
//       }
//     };

//     // --- WebSocket ---
//     ws.current.onopen = () => {
//       console.log("Connected to signaling server");
//       ws.current.send(JSON.stringify({ type: "join", room }));
//     };

//     ws.current.onmessage = async (message) => {
//       let data;
//       try {
//         data = JSON.parse(message.data);
//       } catch (e) {
//         console.error("Invalid JSON:", e);
//         return;
//       }

//       switch (data.type) {
//         case "id":
//           console.log("My id:", data.id);
//           break;

//         case "role":
//           setRole(data.role);
//           console.log("Assigned role:", data.role);
//           break;

//         case "ready":
//           console.log("Peer found — ready");
//           break;

//         case "offer": {
//           const offerCollision =
//             makingOffer.current || pc.current.signalingState !== "stable";

//           if (offerCollision && role === "impolite") {
//             console.warn("Ignoring offer due to collision (impolite)");
//             return;
//           }

//           await pc.current.setRemoteDescription(
//             new RTCSessionDescription(data.offer)
//           );

//           while (pendingCandidates.current.length) {
//             try {
//               await pc.current.addIceCandidate(
//                 pendingCandidates.current.shift()
//               );
//             } catch (e) {
//               console.warn("Failed to add buffered candidate:", e);
//             }
//           }

//           const answer = await pc.current.createAnswer();
//           await pc.current.setLocalDescription(answer);
//           ws.current.send(JSON.stringify({ type: "answer", answer }));
//           break;
//         }

//         case "answer":
//           try {
//             await pc.current.setRemoteDescription(
//               new RTCSessionDescription(data.answer)
//             );
//           } catch (err) {
//             console.error("Error applying answer:", err);
//           }
//           break;

//         case "candidate": {
//           const candidateObj = new RTCIceCandidate(data.candidate);
//           if (!pc.current.remoteDescription) {
//             pendingCandidates.current.push(candidateObj);
//           } else {
//             try {
//               await pc.current.addIceCandidate(candidateObj);
//             } catch (err) {
//               console.error("Error adding ICE:", err);
//             }
//           }
//           break;
//         }

//         case "peer-left":
//           console.log("Peer left");
//           if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
//           break;

//         case "full":
//           console.warn("Room full:", data.msg);
//           break;

//         default:
//           console.log("Unhandled:", data);
//       }
//     };

//     ws.current.onerror = (err) => {
//       console.error("WebSocket error:", err);
//     };

//     return () => {
//       try {
//         if (ws.current?.readyState === WebSocket.OPEN) {
//           ws.current.send(JSON.stringify({ type: "bye" }));
//           ws.current.close();
//         }
//       } catch {}

//       if (pc.current) {
//         pc.current.getSenders().forEach((s) => s.track?.stop());
//         pc.current.close();
//       }

//       if (localStream.current) {
//         localStream.current.getTracks().forEach((t) => t.stop());
//       }
//     };
//   }, [role, room]);

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

// -------------------------------------------------------------------
// src/VideoCall.jsx
// import React, { useEffect, useRef, useState } from 'react';
// import { ZegoExpressEngine } from 'zego-express-engine-webrtc';

// const SIGNALING_BACKEND = 'http://localhost:4000'; // your token server

// export default function VideoCall({ roomID = 'testRoom', userID = 'user_' + Date.now() }) {
//   const localRef = useRef(null);
//   const remoteRef = useRef(null);
//   const engineRef = useRef(null);
//   const [joined, setJoined] = useState(false);

//   useEffect(() => {
//     let engine;
//     async function start() {
//       // 1) get token from your backend
//       const res = await fetch(`${SIGNALING_BACKEND}/api/get-token`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ userID, roomID }),
//       });
//       const data = await res.json();
//       const { token, appID } = data;

//       // 2) init engine
//       engine = new ZegoExpressEngine(Number(appID));
//       engineRef.current = engine;

//       // 3) preview local camera
//       const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
//       // attach to local video element
//       if (localRef.current) localRef.current.srcObject = stream;

//       // 4) login to room
//       await engine.loginRoom(roomID, token, { userID, userName: userID });

//       // 5) start publishing
//       await engine.startPublishingStream('stream_' + userID);
//       // publish local tracks to engine
//       await engine.startPreview(localRef.current);

//       // 6) listen for remote stream added
//       engine.on('playStateUpdate', (streamID, state) => {
//         // optional: monitor playing state
//       });

//       engine.on('remoteCameraStateUpdate', (user, state) => {
//         // older: some SDK events differ; zego-express emits stream updates
//       });

//       // recommended: use 'streamUpdated' or 'roomStreamUpdate' depending on SDK version:
//       engine.on('roomStreamUpdate', async (roomIDEvent, updateType, streamList) => {
//         if (updateType === 'ADD') {
//           // pick first stream and play
//           const remoteStream = streamList[0];
//           const remoteStreamID = remoteStream.streamID;
//           await engine.startPlayingStream(remoteStreamID, { view: remoteRef.current });
//         } else if (updateType === 'DELETE') {
//           // handle cleanup
//         }
//       });

//       setJoined(true);
//     }

//     start().catch(err => console.error(err));

//     return () => {
//       (async () => {
//         try {
//           if (engineRef.current) {
//             await engineRef.current.stopPublishingStream();
//             await engineRef.current.logoutRoom();
//             engineRef.current.destroy();
//           }
//         } catch (e) { /* ignore */ }
//       })();
//     };
//   }, [roomID, userID]);

//   return (
//     <div style={{ display: 'flex', gap: 10 }}>
//       <div>
//         <h4>Local</h4>
//         <video ref={localRef} autoPlay playsInline muted style={{ width: 320, height: 240, background: '#000' }} />
//       </div>
//       <div>
//         <h4>Remote</h4>
//         <video ref={remoteRef} autoPlay playsInline style={{ width: 320, height: 240, background: '#000' }} />
//       </div>
//       <div>
//         <p>{joined ? 'In room' : 'Joining...'}</p>
//       </div>
//     </div>
//   );
// }
// -------------------------------------------------------------------

import React, { useEffect, useRef } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";

export default function VideoCall() {
  const meetingRef = useRef(null);

  useEffect(() => {
    const appID = 1516433132; // 👈 replace with ZegoCloud AppID
    const serverSecret = "4486740846df91f03d0d7fdd1a84143a"; // 👈 replace with your ServerSecret
    const roomID = new URLSearchParams(window.location.search).get("room") || "default";
    const userID = String(Math.floor(Math.random() * 10000));
    const userName = "User_" + userID;

    // quick test token (not secure, for dev only)
    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      appID,
      serverSecret,
      roomID,
      userID,
      userName
    );

    // Create instance
    const zp = ZegoUIKitPrebuilt.create(kitToken);

    // join room with custom UI
    zp.joinRoom({
      container: meetingRef.current,
      scenario: {
        mode: ZegoUIKitPrebuilt.OneONoneCall, // 👈 like your code: 1-to-1
      },
      showPreJoinView: false, // skip preview, go straight in
    });
  }, []);

  return (
    <div
      ref={meetingRef}
      style={{
        width: "100vw",
        height: "100vh",
        background: "#000",
        position: "relative",
      }}
    />
  );
}
