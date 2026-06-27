import fs from "fs";
const env = fs.readFileSync(".env", "utf-8");
for (const line of env.split("\n")) {
  if (line.includes("=")) {
    let [k, v] = line.split("=");
    process.env[k.trim()] = v.trim();
  }
}

import { createSpeechmaticsJWT } from "@speechmatics/auth";
import { RealtimeClient } from "@speechmatics/real-time-client";

async function run() {
  const apiKey = process.env.speechmatics_whisper_key;
  const smClient = new RealtimeClient();
  let fullTranscript = "";
  
  smClient.addEventListener("receiveMessage", ({ data }) => {
    if (data.message === "AddTranscript") {
      console.log("FINAL:", data.metadata?.transcript);
      fullTranscript += data.metadata?.transcript + " ";
    } else if (data.message === "AddPartialTranscript") {
      console.log("PARTIAL:", data.metadata?.transcript);
    } else if (data.message === "Error") {
      console.error("ERROR:", data);
    } else {
      console.log("OTHER:", data.message, data.type, data.reason || "");
    }
  });

  const jwt = await createSpeechmaticsJWT({ type: "rt", apiKey, ttl: 60 });
  await smClient.start(jwt, {
    transcription_config: { language: "ur", enable_partials: true, max_delay: 0.7, model: "standard" },
    audio_format: { type: "raw", encoding: "pcm_s16le", sample_rate: 16000 },
  });
  
  console.log("Streaming user's raw audio...");
  const buffer = fs.readFileSync("/Users/mac/logs/debug-audio.raw");
  
  // Stream in chunks of 8192 bytes
  for (let i = 0; i < buffer.length; i += 8192) {
    const chunk = buffer.slice(i, i + 8192);
    smClient.sendAudio(new Uint8Array(chunk));
    await new Promise(r => setTimeout(r, 200)); // simulate realtime streaming
  }
  
  console.log("Sending stopRecognition...");
  smClient.stopRecognition();
  
  // Wait for EndOfTranscript
  await new Promise(r => setTimeout(r, 3000));
  
  console.log("Done! Final transcript:", fullTranscript);
  process.exit(0);
}

run();
