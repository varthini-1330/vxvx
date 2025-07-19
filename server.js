require('dotenv').config();
const WebSocket = require('ws');
const axios = require('axios');

const VAPI_WS_URL = process.env.VAPI_WS_URL;

const exotelWSServer = new WebSocket.Server({ port: 5003 });
console.log("🔌 Exotel ↔ Vapi WebSocket bridge listening on ws://localhost:5003");

exotelWSServer.on('connection', (exotelWS) => {
  console.log("📞 Exotel connected");

  let vapiWS = null;
  let streamSid = null;
  let chunkCount = 0;

  vapiWS = new WebSocket(VAPI_WS_URL);
  vapiWS.on('open', () => console.log("🤖 Connected to Vapi WebSocket"));

  vapiWS.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.event === 'media') {
        exotelWS.send(JSON.stringify({
          event: "media",
          stream_sid: streamSid,
          media: {
            chunk: ++chunkCount,
            timestamp: Date.now(),
            payload: data.media.payload
          }
        }));
        exotelWS.send(JSON.stringify({
          event: "mark",
          stream_sid: streamSid,
          mark: { name: "vapi_response" }
        }));
      }
    } catch (err) {
      console.error("❌ Error parsing Vapi response:", err.message);
    }
  });

  exotelWS.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg);
      switch (parsed.event) {
        case "connected":
          console.log("🟢 Exotel WebSocket connected");
          break;
        case "start":
          streamSid = parsed.stream_sid;
          console.log("🚀 Stream started:", streamSid);
          break;
        case "media":
          if (vapiWS.readyState === WebSocket.OPEN) {
            vapiWS.send(JSON.stringify({
              event: "media",
              media: { payload: parsed.media.payload }
            }));
          }
          break;
        case "dtmf":
          console.log("📟 DTMF:", parsed.dtmf.digit);
          break;
        case "stop":
          console.log("🛑 Call ended");
          vapiWS.close();
          break;
        default:
          console.log("⚠️ Unknown Exotel event:", parsed.event);
      }
    } catch (e) {
      console.error("❌ Failed to handle Exotel message:", e.message);
    }
  });

  exotelWS.on('close', () => {
    console.log("❎ Exotel connection closed");
    if (vapiWS && vapiWS.readyState === WebSocket.OPEN) vapiWS.close();
  });
});