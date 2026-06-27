import fs from "fs";
const env = fs.readFileSync(".env", "utf-8");
for (const line of env.split("\\n")) {
  if (line.startsWith("speechmatics_whisper_key=")) {
    process.env.speechmatics_whisper_key = line.split("=")[1].trim();
  }
}
import { startRecording, stopRecording, transcribeRecording } from './src/agent/utils/voice.mjs';

async function run() {
  try {
    console.log("⏳ Calling startRecording()...");
    await startRecording();
    console.log("🎙️  Recording started! Simulating 4 seconds of speaking...");

    // Wait for 4 seconds to simulate speaking
    await new Promise(resolve => setTimeout(resolve, 4000));

    console.log("🛑 Calling stopRecording()...");
    await stopRecording();

    console.log("📝 Calling transcribeRecording()...");
    const text = await transcribeRecording();
    
    console.log("\n=============================");
    console.log("FINAL TRANSCRIPT:");
    console.log(text);
    console.log("=============================\n");
    
    // Print the debug logs array
    console.log("VOICE DEBUG STEPS:");
    console.log(global.voiceDebugSteps ? global.voiceDebugSteps.join("\n") : "No steps");
    
  } catch (e) {
    console.error("CRASH:", e);
  } finally {
    process.exit(0);
  }
}

run();
