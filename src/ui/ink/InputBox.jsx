import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from './TextInput.jsx';
import Spinner from 'ink-spinner';
import cliSpinners from 'cli-spinners';
import Gradient from 'ink-gradient';
import { uiBridge } from './utils.mjs';
import { theme } from '../../ui/theme.mjs';

export const InputBox = ({ onSubmit, placeholder, isThinking, activeSpinnerText, isVoiceOn, hasActiveMenu, isSearchActive, focus }) => {
  const [input, setInput] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isCharming, setIsCharming] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState('');

  const handleVoiceSubmit = async () => {
    // 1. Turn off voice in loops state
    if (uiBridge.loopState && uiBridge.updateUIStatusBar) {
      uiBridge.loopState.isVoiceOn = false;
      uiBridge.updateUIStatusBar();
    }

    const origInput = input;
    setIsTranscribing(true);
    setInput(origInput + (origInput.length > 0 ? " " : "") + "[⏳ Transcribing...]");

    try {
      const { stopRecording, transcribeRecording } = await import('../../agent/utils/voice.mjs');
      await stopRecording();
      const text = await transcribeRecording();
      setIsTranscribing(false);
      if (text) {
        setInput(origInput + (origInput.length > 0 ? " " : "") + text);
      } else {
        setInput(origInput);
      }
    } catch (err) {
      setIsTranscribing(false);
      setInput(origInput + (origInput.length > 0 ? " " : "") + `[Voice Error: ${err.message}]`);
    }
  };

  const handleCharm = async () => {
    const origInput = input;
    if (!origInput.trim()) {
      setInput("[Please write something to charm]");
      setTimeout(() => {
        setInput(origInput);
      }, 2000);
      return;
    }

    setIsCharming(true);
    setInput(origInput + "\n[✨ Charming your prompt...]");

    try {
      const { getClientForModel } = await import('../../providers_models/index.mjs');
      const loopState = uiBridge.loopState || {};

      const aiClient = getClientForModel((loopState.modelRoles && loopState.modelRoles['adviser AI']) || loopState.currentModel);
      const TEAM_MODE_NAMES = ['auto', 'planner', 'coder', 'system&web agent'];
      const activeRole = TEAM_MODE_NAMES[loopState.teamModeIndex - 1] || 'auto';

      let enhancedText = "";
      if (loopState.isManagerAgentEnabled) {
        const { runManagerCharm } = await import('../../agent/core/manager_agent.mjs');
        enhancedText = await runManagerCharm(origInput, loopState, aiClient, activeRole);
      } else {
        const response = await aiClient.chat.completions.create({
          model: loopState.currentModel,
          messages: [
            { role: 'system', content: 'You are an AI assistant that enhances and improves user prompts for a coding agent. Make the prompt clearer, more professional, and more detailed, but keep it concise and direct. Output ONLY the enhanced prompt, with no additional commentary, quotes, or markdown formatting.' },
            { role: 'user', content: origInput }
          ]
        });
        enhancedText = response.choices[0].message.content.trim();
      }

      setIsCharming(false);
      if (enhancedText) {
        setInput(enhancedText);
      } else {
        setInput(origInput);
      }
    } catch (err) {
      setIsCharming(false);
      setInput(origInput + `\n[Charm Error: ${err.message}]`);
      setTimeout(() => {
        setInput(origInput);
      }, 3000);
    }
  };

  const handleHistoryUp = () => {
    if (history.length === 0) return;
    let nextIdx = historyIndex + 1;
    if (nextIdx >= history.length) {
      nextIdx = history.length - 1; // Clamp to oldest history item
    }

    if (historyIndex === -1) {
      setTempInput(input);
    }
    setHistoryIndex(nextIdx);
    setInput(history[history.length - 1 - nextIdx]);
  };

  const handleHistoryDown = () => {
    if (historyIndex === -1) return;
    let nextIdx = historyIndex - 1;
    if (nextIdx < -1) nextIdx = -1;

    setHistoryIndex(nextIdx);
    if (nextIdx === -1) {
      setInput(tempInput);
    } else {
      setInput(history[history.length - 1 - nextIdx]);
    }
  };

  return (
    <Box flexDirection="column">
      {isVoiceOn && (
        <Box paddingX={1} marginY={0}>
          <Gradient name="pastel">
            <Text bold>🎙️ Listening... (Speak now, press ENTER to stop and transcribe)</Text>
          </Gradient>
        </Box>
      )}
      {isTranscribing && (
        <Box paddingX={1} marginY={0}>
          <Text color="yellow" bold>⏳ Transcribing voice to text via API...</Text>
        </Box>
      )}
      {isCharming && (
        <Box paddingX={1} marginY={0}>
          <Gradient name="pastel">
            <Text bold>✨ Charming your prompt via AI Adviser...</Text>
          </Gradient>
        </Box>
      )}
      <Box flexDirection="row" marginY={0} paddingX={0}>
        {/* Left indicators side column */}
        <Box flexDirection="column">
          <Text>{theme.accent('▌')}</Text>
          <Text>{theme.accent('▌')}</Text>
          <Text>{theme.accent('▌')}</Text>
        </Box>
        {/* Right input field card */}
        <Box
          flexGrow={1}
          marginLeft={1}
          backgroundColor="#2b2b2b"
          paddingX={1}
          minHeight={3}
          flexDirection="column"
        >
          <Box flexGrow={1}>
            <TextInput
              value={input}
              onChange={(val) => {
                if (val === '/') {
                  onSubmit('/');
                  setInput('');
                } else {
                  setInput(val);
                }
              }}
              onSubmit={(value) => {
                if (isVoiceOn) {
                  handleVoiceSubmit();
                } else {
                  if (value.trim()) {
                    if (isThinking) {
                      if (uiBridge.loopState) {
                        uiBridge.loopState.globalTaskQueue.push(value);
                        uiBridge.rerender();
                      }
                    } else {
                      // Add to session history
                      setHistory((prev) => [...prev, value]);
                      setHistoryIndex(-1);
                      setTempInput('');

                      onSubmit(value);
                    }
                    setInput('');
                  }
                }
              }}
              onHistoryUp={handleHistoryUp}
              onHistoryDown={handleHistoryDown}
              onCharm={handleCharm}
              hasActiveMenu={hasActiveMenu}
              isSearchActive={isSearchActive}
              focus={focus}
              placeholder={placeholder || 'ask anything or type / for commands'}
            />
          </Box>
          <Text> </Text>
          <Text> </Text>
        </Box>
      </Box>
    </Box>
  );
};
