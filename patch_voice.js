const fs = require('fs');
const path = require('path');
const file = path.resolve("src/agent/utils/voice.mjs");
let content = fs.readFileSync(file, 'utf8');

// Add speechmatics state
if (!content.includes('let smClient = null;')) {
  content = content.replace('let recording = null;', `let recording = null;
let smClient = null;
let smTranscript = "";
let smRecorder = null;
let smResolver = null;
let isSpeechmaticsReady = false;`);
}

// Modify startRecording
const startRecTarget = `export async function startRecording() {
  const record = await ensureVoiceDependencies();
  
  audioPath = path.join(os.tmpdir(), "voice_input.wav");
  file = fs.createWriteStream(audioPath, { encoding: "binary" });

  recording = record.record({
    sampleRate: 16000,
    channels: 1,
    audioType: "raw", 
  });

  recording.stream().pipe(file);
  // Wait 800ms for Sox to initialize
  await new Promise(r => setTimeout(r, 800));
}`;

const startRecReplace = `export async function startRecording() {
  const { getVoiceProviderSetting } = await import("../history.mjs");
  const provider = await getVoiceProviderSetting();

  if (provider === "speechmatics") {
    smTranscript = "";
    isSpeechmaticsReady = false;
    const apiKey = process.env.speechmatics_whisper_key || process.env.SPEECHMATICS_API_KEY;
    if (!apiKey) {
      throw new Error("Speechmatics API key not found in .env (speechmatics_whisper_key)");
    }

    const { createSpeechmaticsJWT } = await import("@speechmatics/auth");
    const { RealtimeClient } = await import("@speechmatics/real-time-client");

    smClient = new RealtimeClient();
    const audio_format = { type: "raw", encoding: "pcm_s16le", sample_rate: 44100 };

    smClient.addEventListener("receiveMessage", ({ data }) => {
      if (data.message === "AddTranscript") {
        const transcript = data.metadata?.transcript;
        if (transcript) smTranscript += (smTranscript ? " " : "") + transcript;
      } else if (data.message === "EndOfTranscript") {
         if (smResolver) smResolver(smTranscript.trim());
      } else if (data.message === "Error") {
        console.error(\`Speechmatics Error [\${data.type}]: \${data.reason}\`);
        if (smResolver) smResolver(smTranscript.trim() + " [Error: " + data.reason + "]");
      }
    });

    const jwt = await createSpeechmaticsJWT({ type: "rt", apiKey, ttl: 60 });
    
    // We don't await client.start here fully if we want to pipe immediately, but it's safe to await
    await smClient.start(jwt, {
      transcription_config: { language: "en", enable_partials: false, max_delay: 0.7, operating_point: "enhanced" },
      audio_format,
    });
    isSpeechmaticsReady = true;

    smRecorder = spawn("sox", [
      "-d", "-q", "-r", String(audio_format.sample_rate), "-e", "signed-integer", "-b", "16", "-c", "1", "-t", "raw", "-"
    ]);

    smRecorder.stdout.on("data", (chunk) => smClient.sendAudio(chunk));
    
    // Wait for sox to warm up
    await new Promise(r => setTimeout(r, 800));
    return;
  }

  // Fallback to offline
  const record = await ensureVoiceDependencies();
  
  audioPath = path.join(os.tmpdir(), "voice_input.wav");
  file = fs.createWriteStream(audioPath, { encoding: "binary" });

  recording = record.record({
    sampleRate: 16000,
    channels: 1,
    audioType: "raw", 
  });

  recording.stream().pipe(file);
  // Wait 800ms for Sox to initialize
  await new Promise(r => setTimeout(r, 800));
}`;

if (content.includes(startRecTarget)) {
  content = content.replace(startRecTarget, startRecReplace);
}

// Modify stopRecording
const stopRecTarget = `export async function stopRecording() {
  if (recording) {
    recording.stop();
  }
  
  return new Promise((resolve) => {
    setTimeout(() => {
      let streamClosed = false;
      const done = () => {
        if (!streamClosed) {
          streamClosed = true;
          resolve();
        }
      };
      if (file) {
        file.on('close', done);
        file.on('finish', done);
      } else {
         done();
      }
      setTimeout(done, 1000); // fallback
    }, 800);
  });
}`;

const stopRecReplace = `export async function stopRecording() {
  const { getVoiceProviderSetting } = await import("../history.mjs");
  const provider = await getVoiceProviderSetting();

  if (provider === "speechmatics") {
    if (smRecorder) {
      smRecorder.kill();
      smRecorder = null;
    }
    if (smClient && isSpeechmaticsReady) {
      smClient.stopRecognition();
    }
    return new Promise(r => setTimeout(r, 200)); // brief pause to allow socket to flush
  }

  if (recording) {
    recording.stop();
  }
  
  return new Promise((resolve) => {
    setTimeout(() => {
      let streamClosed = false;
      const done = () => {
        if (!streamClosed) {
          streamClosed = true;
          resolve();
        }
      };
      if (file) {
        file.on('close', done);
        file.on('finish', done);
      } else {
         done();
      }
      setTimeout(done, 1000); // fallback
    }, 800);
  });
}`;

if (content.includes(stopRecTarget)) {
  content = content.replace(stopRecTarget, stopRecReplace);
}

// Modify transcribeRecording
const transcribeTarget = `export async function transcribeRecording(onProgress) {
  const { getVoiceLanguageSetting } = await import("../history.mjs");`;

const transcribeReplace = `export async function transcribeRecording(onProgress) {
  const { getVoiceProviderSetting } = await import("../history.mjs");
  const provider = await getVoiceProviderSetting();

  if (provider === "speechmatics") {
    return new Promise((resolve) => {
      if (!smClient || !isSpeechmaticsReady) {
        resolve(smTranscript.trim());
        return;
      }
      smResolver = resolve;
      // safety timeout
      setTimeout(() => {
        resolve(smTranscript.trim());
      }, 3000);
    });
  }

  const { getVoiceLanguageSetting } = await import("../history.mjs");`;

if (content.includes(transcribeTarget)) {
  content = content.replace(transcribeTarget, transcribeReplace);
}

// Fix final block
const cancelTarget = `export function cancelRecording() {
  if (recording) recording.stop();`;
const cancelReplace = `export function cancelRecording() {
  if (smRecorder) smRecorder.kill();
  smRecorder = null;
  if (smClient) smClient.disconnect();
  smClient = null;
  smResolver = null;
  
  if (recording) recording.stop();`;

if (content.includes(cancelTarget)) {
  content = content.replace(cancelTarget, cancelReplace);
}


fs.writeFileSync(file, content);
console.log("Patched voice.mjs fully");
