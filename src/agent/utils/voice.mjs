import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { execAsync } from './process.mjs';
import ora from 'ora';
import { theme } from '../../ui/theme.mjs';

let recording = null;
let smClient = null;
let smTranscript = "";
let smRecorder = null;
let smResolver = null;
let isSpeechmaticsReady = false;
let file = null;
let audioPath = null;
let voiceDepsPath = null;
let transformersPath = null;

function logDebug(msg) {
  try {
    global.voiceDebugSteps = global.voiceDebugSteps || [];
    global.voiceDebugSteps.push(msg);

    // Ye check ensure karta hai ke voice ke debug logs sirf tab save hon 
    // jab `DEBUG=true` ho, taake hard drive par be-maqsad files na banain.
    if (process.env.DEBUG === 'true') {
      const logDir = path.join(process.cwd(), 'db/debug_logs');
      const logPath = path.join(logDir, 'voice-debug.log');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\\n`);
    }
  } catch (e) { }
}

function resolveSoxPathWindows() {
  const commonDirs = [
    'C:\\Program Files (x86)',
    'C:\\Program Files',
    path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages')
  ];

  for (const baseDir of commonDirs) {
    if (!fs.existsSync(baseDir)) continue;
    try {
      const files = fs.readdirSync(baseDir);
      for (const file of files) {
        const fullPath = path.join(baseDir, file);
        try {
          if (fs.statSync(fullPath).isDirectory()) {
            if (file.toLowerCase().includes('sox')) {
              const exePath = path.join(fullPath, 'sox.exe');
              if (fs.existsSync(exePath)) {
                return fullPath;
              }
            }
            if (baseDir.includes('WinGet') && file.toLowerCase().includes('chrisbagwell.sox')) {
              if (fs.existsSync(path.join(fullPath, 'sox.exe'))) {
                return fullPath;
              }
              const nestedFiles = fs.readdirSync(fullPath);
              for (const nf of nestedFiles) {
                const nfp = path.join(fullPath, nf);
                if (fs.statSync(nfp).isDirectory() && fs.existsSync(path.join(nfp, 'sox.exe'))) {
                  return nfp;
                }
              }
            }
          }
        } catch (err) {}
      }
    } catch (e) {}
  }

  const staticPaths = [
    'C:\\Program Files (x86)\\sox',
    'C:\\Program Files\\sox',
    'C:\\Program Files (x86)\\sox-14-4-2',
    'C:\\Program Files\\sox-14-4-2'
  ];
  for (const p of staticPaths) {
    if (fs.existsSync(path.join(p, 'sox.exe'))) {
      return p;
    }
  }
  return null;
}

export async function ensureVoiceDependencies() {
  const isWin = os.platform() === 'win32';
  if (isWin) {
    const soxDir = resolveSoxPathWindows();
    if (soxDir && !process.env.PATH.includes(soxDir)) {
      process.env.PATH = `${soxDir};${process.env.PATH}`;
    }
    if (!process.env.AUDIODRIVER) {
      process.env.AUDIODRIVER = 'waveaudio';
    }
  }

  const require = createRequire(import.meta.url);
  const homedir = os.homedir();
  voiceDepsPath = path.join(homedir, ".cheap", "voice-deps");

  if (!fs.existsSync(voiceDepsPath)) {
    fs.mkdirSync(voiceDepsPath, { recursive: true });
    fs.writeFileSync(path.join(voiceDepsPath, "package.json"), JSON.stringify({ name: "voice-deps", private: true }));
  }

  transformersPath = path.join(voiceDepsPath, "node_modules", "@xenova/transformers");
  const recordPath = path.join(voiceDepsPath, "node_modules", "node-record-lpcm16");

  let needsInstall = !fs.existsSync(transformersPath) || !fs.existsSync(recordPath);

  if (!needsInstall) {
    try {
      require(recordPath);
      const { pathToFileURL } = await import('url');
      await import(pathToFileURL(transformersPath).href);
    } catch (e) {
      needsInstall = true;
    }
  }

  if (needsInstall) {
    let spinner = ora({ text: theme.dim("Downloading/repairing voice dependencies... (This might take a moment)"), color: false }).start();
    try {
      const nmPath = path.join(voiceDepsPath, "node_modules");
      if (fs.existsSync(nmPath)) {
        fs.rmSync(nmPath, { recursive: true, force: true });
      }

      // Use npm on Windows because Bun has known issues running post-install scripts for native packages like sharp on Windows
      const installCmd = isWin
        ? "npm install @xenova/transformers node-record-lpcm16 --no-audit --no-fund"
        : "bun install @xenova/transformers node-record-lpcm16";
      await execAsync(installCmd, { cwd: voiceDepsPath });
      spinner.succeed(theme.success("Dependencies installed/repaired successfully!"));
    } catch (err) {
      spinner.fail(theme.error("Failed to install dependencies."));
      throw new Error(`Error installing dependencies: ${err.message}`);
    }
  }

  const record = require(recordPath);

  let soxInstalled = false;

  try {
    await execAsync(isWin ? "where sox" : "which sox");
    soxInstalled = true;
  } catch (err) {
    try {
      await execAsync("sox --version");
      soxInstalled = true;
    } catch (e) {
      soxInstalled = false;
    }
  }

  if (!soxInstalled) {
    if (isWin) {
      let spinner = ora({ text: theme.dim("Sox not found. Auto-installing via WinGet... (Please wait)"), color: false }).start();
      try {
        await execAsync("winget install ChrisBagwell.SoX --silent --accept-source-agreements --accept-package-agreements");
        spinner.succeed(theme.success("Sox installed successfully! Please restart your terminal/IDE to refresh PATH."));
      } catch (wingetErr) {
        spinner.fail(theme.error("Failed to auto-install sox via WinGet."));
        throw new Error(
          "Sox (Sound eXchange) is required for offline recording on Windows. Please install it using one of the following:\n" +
          "  1. In PowerShell: winget install ChrisBagwell.SoX\n" +
          "  2. In Scoop: scoop install sox\n" +
          "  3. Manual: Download from SourceForge (https://sourceforge.net/projects/sox/) and add it to your system PATH."
        );
      }
    } else {
      let spinner = ora({ text: theme.dim("Sox not found. Auto-installing via Homebrew... (Please wait)"), color: false }).start();
      try {
        await execAsync("brew install sox");
        spinner.succeed(theme.success("Sox installed successfully!"));
      } catch (brewErr) {
        spinner.fail(theme.error("Failed to auto-install sox."));
        throw new Error("Failed to auto-install sox. Please install it manually using: `brew install sox`");
      }
    }
  }
  return record;
}

export async function startRecording() {
  global.voiceDebugSteps = [];
  logDebug("startRecording called");
  const { getVoiceProviderSetting } = await import("../history.mjs");
  const provider = await getVoiceProviderSetting();
  logDebug("Provider selected: " + provider);

  if (provider === "speechmatics") {
    smTranscript = "";
    global.hasReceivedEndOfTranscript = false;
    isSpeechmaticsReady = false;
    logDebug("Initializing Speechmatics");
    const apiKey = process.env.speechmatics_whisper_key || process.env.SPEECHMATICS_API_KEY;
    if (!apiKey) {
      logDebug("ERROR: API key not found");
      throw new Error("Speechmatics API key not found in .env (speechmatics_whisper_key)");
    }

    let RealtimeClient, createSpeechmaticsJWT;
    try {
      ({ createSpeechmaticsJWT } = await import("@speechmatics/auth"));
      ({ RealtimeClient } = await import("@speechmatics/real-time-client"));
    } catch (importErr) {
      logDebug("ERROR: Failed to import Speechmatics packages: " + importErr.message);
      throw new Error("Speechmatics packages import failed. Run: npm install @speechmatics/auth @speechmatics/real-time-client\n" + importErr.message);
    }

    smClient = new RealtimeClient();
    if (!smClient) {
      logDebug("ERROR: RealtimeClient constructor returned null/undefined");
      throw new Error("RealtimeClient() returned null. Package version may be incompatible. Try: npm update @speechmatics/real-time-client");
    }
    const audio_format = { type: "raw", encoding: "pcm_s16le", sample_rate: 16000 };


    smClient.addEventListener("receiveMessage", ({ data }) => {
      if (data.message === "AddTranscript") {
        const transcript = data.metadata?.transcript;
        logDebug("AddTranscript received: " + transcript);
        if (transcript) smTranscript += (smTranscript ? " " : "") + transcript;
      } else if (data.message === "EndOfTranscript") {
        global.hasReceivedEndOfTranscript = true;
        logDebug("EndOfTranscript received. Final transcript: " + smTranscript.trim());
        if (smResolver) smResolver(smTranscript.trim());
      } else if (data.message === "Error") {
        logDebug(`Speechmatics Error [${data.type}]: ${data.reason}`);
        console.error(`\nSpeechmatics Error [${data.type}]: ${data.reason}`);
        if (smResolver) smResolver(smTranscript.trim() + " [Error: " + data.reason + "]");
      } else {
        logDebug(`Other message received: ${data.message} ${data.reason ? '(' + data.reason + ')' : ''} ${data.type ? '[' + data.type + ']' : ''}`);
      }
    });

    logDebug("Creating Speechmatics JWT...");
    const jwt = await createSpeechmaticsJWT({ type: "rt", apiKey, ttl: 60 });

    logDebug("Starting Speechmatics Client...");
    // We don't await client.start here fully if we want to pipe immediately, but it's safe to await
    await smClient.start(jwt, {
      transcription_config: { language: "ur", enable_partials: true, max_delay: 0.7, model: "standard" },
      audio_format,
    });
    isSpeechmaticsReady = true;
    global.isSpeechmaticsStopping = false;
    logDebug("Speechmatics Client ready. Ensuring voice deps...");

    const record = await ensureVoiceDependencies();
    logDebug("Starting smRecorder...");
    smRecorder = record.record({
      sampleRate: 16000,
      channels: 1,
      audioType: "raw",
    });

    let recordStderr = "";
    if (smRecorder.process && smRecorder.process.stderr) {
      smRecorder.process.stderr.on("data", (chunk) => {
        recordStderr += chunk.toString();
      });
    }

    smRecorder.stream().on("error", (err) => {
      const errMsg = err?.message || err || "Unknown error";
      logDebug("smRecorder stream error: " + errMsg + (recordStderr ? "\nStderr: " + recordStderr : ""));
      console.error("\n[Voice Recording Error]:", errMsg);
      if (recordStderr) {
        console.error("[Voice Recording Stderr]:", recordStderr);
      }
    });

    const isDebugEnabled = process.env.DEBUG === 'true';
    const debugAudioPath = path.join(process.cwd(), 'db/debug_logs', 'debug-audio.raw');
    if (isDebugEnabled && fs.existsSync(debugAudioPath)) fs.unlinkSync(debugAudioPath);

    let audioBuffer = Buffer.alloc(0);

    smRecorder.stream().on("data", (chunk) => {
      try {
        const chunkBuf = typeof chunk === 'string' ? Buffer.from(chunk, 'binary') : chunk;

        if (global.isSpeechmaticsStopping) {
          if (audioBuffer.length > 0) {
            let sendChunk = audioBuffer;
            if (sendChunk.length % 2 !== 0) sendChunk = sendChunk.slice(0, -1);
            smClient.sendAudio(new Uint8Array(sendChunk));
            audioBuffer = Buffer.alloc(0);
          }
          return;
        }

        if (isDebugEnabled) {
          fs.appendFileSync(debugAudioPath, chunkBuf);
        }

        audioBuffer = Buffer.concat([audioBuffer, chunkBuf]);

        while (audioBuffer.length >= 8192) {
          const sendChunk = audioBuffer.slice(0, 8192);
          audioBuffer = audioBuffer.slice(8192);
          smClient.sendAudio(new Uint8Array(sendChunk));
        }
      } catch (err) {
        logDebug("Error sending audio chunk: " + err.message);
      }
    });
    logDebug("smRecorder started piping to Speechmatics");

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

  let recordStderr = "";
  if (recording.process && recording.process.stderr) {
    recording.process.stderr.on("data", (chunk) => {
      recordStderr += chunk.toString();
    });
  }

  recording.stream().on("error", (err) => {
    const errMsg = err?.message || err || "Unknown error";
    logDebug("recording stream error: " + errMsg + (recordStderr ? "\nStderr: " + recordStderr : ""));
    console.error("\n[Voice Recording Error]:", errMsg);
    if (recordStderr) {
      console.error("[Voice Recording Stderr]:", recordStderr);
    }
  });

  recording.stream().pipe(file);
  // Wait 800ms for Sox to initialize
  await new Promise(r => setTimeout(r, 800));
}

export async function stopRecording() {
  logDebug("stopRecording called");
  const { getVoiceProviderSetting } = await import("../history.mjs");
  const provider = await getVoiceProviderSetting();
  logDebug("stopRecording Provider: " + provider);

  if (provider === "speechmatics") {
    global.isSpeechmaticsStopping = true;
    if (smRecorder) {
      logDebug("Stopping smRecorder");
      smRecorder.stop();
      smRecorder = null;
    }
    if (smClient && isSpeechmaticsReady) {
      logDebug("Sending stopRecognition to Speechmatics");
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
}

export async function transcribeRecording(onProgress) {
  logDebug("transcribeRecording called");
  const { getVoiceProviderSetting } = await import("../history.mjs");
  const provider = await getVoiceProviderSetting();
  logDebug("transcribeRecording Provider: " + provider);

  if (provider === "speechmatics") {
    return new Promise((resolve) => {
      if (!smClient || !isSpeechmaticsReady) {
        logDebug("smClient not ready or null. Returning current transcript.");
        resolve(smTranscript.trim());
        return;
      }
      if (global.hasReceivedEndOfTranscript) {
        logDebug("EndOfTranscript already received. Resolving immediately.");
        resolve(smTranscript.trim());
        return;
      }
      logDebug("Setting up smResolver. Waiting for EndOfTranscript...");
      smResolver = (text) => {
        logDebug("smResolver called with text: " + text);
        let finalTxt = smTranscript.trim();
        if (!finalTxt) finalTxt = "[VOICE DEBUG]: " + (global.voiceDebugSteps ? global.voiceDebugSteps.join(" -> ") : "No steps");
        resolve(finalTxt);
      };
      // safety timeout
      setTimeout(() => {
        logDebug("smResolver timed out after 3000ms. Forcing resolve.");
        let finalTxt = smTranscript.trim();
        if (!finalTxt) finalTxt = "[VOICE DEBUG (Timeout)]: " + (global.voiceDebugSteps ? global.voiceDebugSteps.join(" -> ") : "No steps");
        resolve(finalTxt);
      }, 3000);
    });
  }

  const langOption = `{ language: "english", task: "transcribe" }`;
  let workerScriptPath = null;

  return new Promise((resolve, reject) => {
    if (!audioPath) {
      reject(new Error("No audio recorded."));
      return;
    }

    const resultPath = path.join(os.tmpdir(), "voice_result_" + Date.now() + ".json");
    const script = `
      const fs = require("node:fs");
      const { pipeline, env } = require("${transformersPath.replace(/\\/g, "\\\\")}");
      env.allowLocalModels = false;
      env.useBrowserCache = false;
      async function run() {
        try {
          const stat = fs.statSync("${audioPath.replace(/\\/g, "\\\\")}");
          if (stat.size === 0) {
            fs.writeFileSync("${resultPath.replace(/\\/g, "\\\\")}", JSON.stringify({ error: "Audio file is empty. Microphone might not be capturing." }));
            return;
          }
          // Using whisper-base for significantly better accuracy while keeping download size small (~290MB)
          const t = await pipeline("automatic-speech-recognition", "Xenova/whisper-base", {
            progress_callback: (x) => console.error("\\nJSON_PROGRESS:" + JSON.stringify(x) + "\\n")
          });
          const buf = fs.readFileSync("${audioPath.replace(/\\/g, "\\\\")}");
          const f32 = new Float32Array(buf.length / 2);
          for(let i=0; i<buf.length/2; i++) f32[i] = buf.readInt16LE(i*2) / 32768.0;
          const res = await t(f32, ${langOption});
          fs.writeFileSync("${resultPath.replace(/\\/g, "\\\\")}", JSON.stringify({ text: res.text }));
        } catch(e) {
          fs.writeFileSync("${resultPath.replace(/\\/g, "\\\\")}", JSON.stringify({ error: e.message }));
        }
      }
      run();
    `;

    workerScriptPath = path.join(os.tmpdir(), "voice_worker_" + Date.now() + ".js");
    fs.writeFileSync(workerScriptPath, script, "utf-8");

    let stderrData = "";
    const worker = spawn(process.execPath, [workerScriptPath], {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let isTimedOut = false;
    let timeout = setTimeout(() => {
      isTimedOut = true;
      worker.kill();
    }, 60000);

    worker.stderr.on("data", (chunk) => {
      const str = chunk.toString();
      if (str.includes("JSON_PROGRESS:")) {
        // Reset timeout while actively downloading model
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          isTimedOut = true;
          worker.kill();
        }, 60000);

        const parts = str.split("JSON_PROGRESS:");
        for (let i = 1; i < parts.length; i++) {
          const jsonStr = parts[i].split("\n")[0];
          try {
            const data = JSON.parse(jsonStr);
            if (onProgress) {
              onProgress(data);
            } else if (process.stderr.isTTY) {
              if (data.status === "download" || data.status === "progress") {
                const p = Math.round(data.progress || 0);
                process.stderr.write(`\r\x1b[K\x1b[90m⏳ Downloading whisper-base model: ${p}%\x1b[0m`);
              } else if (data.status === "ready" || data.status === "done") {
                process.stderr.write(`\r\x1b[K\x1b[90m⏳ Model ready. Transcribing...\x1b[0m`);
              }
            }
          } catch (e) { }
        }
      } else {
        stderrData += str;
      }
    });

    worker.on("close", () => {
      if (!onProgress && process.stderr.isTTY) {
        process.stderr.write("\r\x1b[K"); // Clear progress line
      }
    });

    worker.on("close", (code) => {
      clearTimeout(timeout);
      if (isTimedOut) {
        reject(new Error("Transcription timed out after 60 seconds of inactivity. Please try again."));
      } else if (code !== 0) {
        const actualErrors = stderrData
          .split('\n')
          .filter(line => !line.includes('onnxruntime') && line.trim())
          .join('\n');
        reject(new Error(actualErrors || `Worker exited with code ${code}`));
      } else {
        try {
          const resultStr = fs.readFileSync(resultPath, "utf-8");
          const result = JSON.parse(resultStr);
          fs.unlinkSync(resultPath);

          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result.text?.trim() || "");
          }
        } catch (e) {
          reject(e);
        }
      }
    });

    worker.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  }).finally(() => {
    try { fs.unlinkSync(audioPath); } catch (e) { }
    try { if (workerScriptPath) fs.unlinkSync(workerScriptPath); } catch (e) { }
    recording = null;
    file = null;
    audioPath = null;
  });
}

export function cancelRecording() {
  if (smRecorder) {
    try { smRecorder.stop(); } catch (e) { }
    smRecorder = null;
  }
  if (smClient) {
    try { smClient.disconnect(); } catch (e) { }
    smClient = null;
  }
  smResolver = null;

  if (recording) recording.stop();
  recording = null;
  file = null;
  try { if (audioPath) fs.unlinkSync(audioPath); } catch (e) { }
  audioPath = null;
}
