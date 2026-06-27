import fs from "fs";
import { createSpeechmaticsJWT } from "@speechmatics/auth";
import { RealtimeClient } from "@speechmatics/real-time-client";
import record from "node-record-lpcm16";

const env = fs.readFileSync(".env", "utf8");
for (let line of env.split("\n")) {
  if (line.includes("=")) {
    let [k, v] = line.split("=");
    process.env[k.trim()] = v.trim();
  }
}

async function run() {
  let smRecorder = null;
  let smClient = null;

  try {
    const apiKey = process.env.speechmatics_whisper_key;
    if (!apiKey) {
      console.error("❌ ERROR: API Key (speechmatics_whisper_key) not found in .env");
      process.exit(1);
    }

    console.log("⏳ Connecting to Speechmatics...");
    smClient = new RealtimeClient();

    let fullTranscript = "";
    smClient.addEventListener("receiveMessage", ({ data }) => {
      if (data.message === "AddTranscript") {
        const transcript = data.metadata?.transcript;
        if (transcript) {
          fullTranscript += (fullTranscript ? " " : "") + transcript;
          // Clear current line and print the updated full transcript
          process.stdout.write("\r\x1b[K🗣️ Transcribed: " + fullTranscript);
        }
      } else if (data.message === "EndOfTranscript") {
        console.log("\n✅ EndOfTranscript received.");
        console.log("\n👉 FINAL RESULT: " + fullTranscript);
        process.exit(0);
      } else if (data.message === "Error") {
        console.error("\n❌ Speechmatics Error:", data);
        process.exit(1);
      }
    });

    console.log("⏳ Authenticating...");
    const jwt = await createSpeechmaticsJWT({ type: "rt", apiKey, ttl: 60 });

    console.log("⏳ Starting WebSocket (Urdu model)...");
    await smClient.start(jwt, {
      transcription_config: { language: "ur", enable_partials: true, max_delay: 0.7, model: "enhanced" },
      audio_format: { type: "raw", encoding: "pcm_s16le", sample_rate: 16000 },
    });

    console.log("🎙️ WebSocket connected! Starting microphone...");
    smRecorder = record.record({
      sampleRate: 16000,
      channels: 1,
      audioType: "raw",
    });

    smRecorder.stream().on("data", (chunk) => {
      try {
        smClient.sendAudio(new Uint8Array(chunk));
      } catch (e) {
        console.error("❌ Error sending audio:", e.message);
      }
    });

    console.log("\n🔊 SPEAK NOW IN URDU! (Recording for 30 seconds...)\n");

    setTimeout(() => {
      console.log("🛑 Stopping microphone...");
      smRecorder.stop();
      smClient.stopRecognition();
    }, 30000);

  } catch (err) {
    console.error("❌ CRASH ERROR:", err.message || err);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

run();
