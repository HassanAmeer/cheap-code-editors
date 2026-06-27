import fs from "fs";
import { createSpeechmaticsJWT } from "@speechmatics/auth";
import { RealtimeClient } from "@speechmatics/real-time-client";

const env = fs.readFileSync(".env", "utf8");
for(let line of env.split("\n")) {
  if (line.includes("=")) {
    let [k,v] = line.split("=");
    process.env[k.trim()] = v.trim();
  }
}

async function run() {
  try {
    const smClient = new RealtimeClient();
    const apiKey = process.env.speechmatics_whisper_key;

    if (!apiKey) {
      console.error("API Key not found!");
      process.exit(1);
    }

    smClient.addEventListener("receiveMessage", ({ data }) => {
      if (data.message === "AddTranscript") {
        console.log("\n--- AddTranscript Payload ---");
        console.log(JSON.stringify(data, null, 2));
      } else if (data.message === "EndOfTranscript") {
        console.log("\n--- EndOfTranscript ---");
        process.exit(0);
      } else if (data.message === "Error") {
        console.error("\n--- Error ---", data);
        process.exit(1);
      }
    });

    const jwt = await createSpeechmaticsJWT({ type: "rt", apiKey, ttl: 60 });
    await smClient.start(jwt, {
      transcription_config: { language: "en", enable_partials: false, max_delay: 0.7, model: "enhanced" },
      audio_format: { type: "raw", encoding: "pcm_s16le", sample_rate: 44100 },
    });

    console.log("Started. Sending dummy noise audio...");
    // generate 10 seconds of pure noise (white noise) to force it to transcribe something!
    const buf = new Uint8Array(44100 * 2 * 3); 
    for(let i=0; i<buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
    smClient.sendAudio(buf);
    
    setTimeout(() => {
      console.log("Stopping recognition...");
      smClient.stopRecognition();
    }, 2000);
  } catch (err) {
    console.error("CRASH:", err);
  }
}

run();
