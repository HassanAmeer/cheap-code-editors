import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput, render } from 'ink';
import Spinner from 'ink-spinner';
import cliSpinners from 'cli-spinners';
import { marked } from 'marked';
import Gradient from 'ink-gradient';

import { uiBridge } from './utils.mjs';
import { GridPrompt } from './GridPrompt.jsx';
import { HistoryPrompt } from './HistoryPrompt.jsx';
import SelectPrompt from './SelectPrompt.jsx';
import ConfirmPrompt from './ConfirmPrompt.jsx';
import InputPrompt from './InputPrompt.jsx';
import SearchPrompt from './SearchPrompt.jsx';
import { InputBox } from './InputBox.jsx';

// Custom Markdown Code Block Parser
const parseBlocks = (text) => {
  if (!text) return [];
  const blocks = [];
  const lines = text.split('\n');
  let inCode = false;
  let codeLang = '';
  let currentBlock = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        blocks.push({ type: 'code', lang: codeLang, content: currentBlock.join('\n'), isComplete: true });
        inCode = false;
        codeLang = '';
        currentBlock = [];
      } else {
        if (currentBlock.length > 0) {
          blocks.push({ type: 'text', content: currentBlock.join('\n'), isComplete: true });
          currentBlock = [];
        }
        inCode = true;
        codeLang = line.slice(3).trim();
      }
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push({ type: inCode ? 'code' : 'text', lang: codeLang, content: currentBlock.join('\n'), isComplete: !inCode });
  }

  return blocks;
};

export const AssistantMessageView = ({ content, collapseCode }) => {
  const blocks = parseBlocks(content);

  return (
    <Box flexDirection="column">
      {blocks.map((block, i) => {
        if (block.type === 'text') {
          return (
            <Box key={i} marginY={0}>
              <Text>{marked(block.content)}</Text>
            </Box>
          );
        }
        if (block.type === 'code') {
          if (collapseCode) {
            return (
              <Box key={i} borderStyle="single" borderColor="blue" paddingX={1} marginY={1}>
                <Text color="blue">▶ Code Block: {block.lang || 'text'} (Collapsed - Press Ctrl+O to expand)</Text>
              </Box>
            );
          } else {
            return (
              <Box key={i} flexDirection="column" marginY={1}>
                <Box backgroundColor="blue" paddingX={1}>
                  <Text color="white" bold> {block.lang || 'code'} </Text>
                </Box>
                <Box borderStyle="single" borderColor="gray" paddingX={1}>
                  <Text color="cyan">{block.content}</Text>
                </Box>
              </Box>
            );
          }
        }
        return null;
      })}
    </Box>
  );
};

export const ChatView = ({ messages, isStreaming, currentContent, collapseCode }) => {
  // Render last 18 messages/logs to fit screen heights cleanly
  const visibleMessages = messages.slice(-18);

  return (
    <Box flexDirection="column" paddingX={1}>
      {visibleMessages.map((msg, i) => {
        if (msg.role === 'system') return null;

        if (msg.role === 'system_log') {
          return (
            <Box key={i} marginY={0}>
              <Text color="gray">{msg.content}</Text>
            </Box>
          );
        }

        if (msg.role === 'user') {
          return (
            <Box key={i} marginY={1}>
              <Text color="cyan" bold>❯ </Text>
              <Text color="white" bold>{msg.content}</Text>
            </Box>
          );
        }

        if (msg.role === 'assistant') {
          return (
            <Box key={i} flexDirection="column" marginY={1}>
              <Box borderStyle="single" borderColor="blue" paddingX={1}>
                <AssistantMessageView content={msg.content} collapseCode={collapseCode} />
              </Box>
            </Box>
          );
        }

        if (msg.role === 'tool') {
          const contentLines = msg.content ? msg.content.split('\n') : [];
          const isTooLong = contentLines.length > 20;
          const displayContent = isTooLong
            ? contentLines.slice(0, 15).join('\n') + `\n\n... (truncated ${contentLines.length - 15} lines. Press Ctrl+O to expand/collapse) ...`
            : msg.content;

          return (
            <Box key={i} flexDirection="column" marginY={0}>
              <Box borderStyle="round" borderColor="yellow" paddingX={1}>
                <Text color="yellow" bold>🛠 Tool [{msg.name}]:</Text>
                <Text color="gray">{collapseCode && isTooLong ? displayContent : msg.content}</Text>
              </Box>
            </Box>
          );
        }

        return null;
      })}

      {isStreaming && currentContent && (
        <Box flexDirection="column" marginY={1}>
          <Box borderStyle="single" borderColor="cyan" paddingX={1}>
            <Text color="cyan">{currentContent}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export const ToolDisplay = ({ currentTool }) => {
  if (!currentTool) return null;

  return (
    <Box marginTop={1} paddingX={1}>
      <Text color="yellow">
        <Spinner spinner={cliSpinners.bouncingBar} />
      </Text>
      <Gradient name="pastel">
        <Text> {currentTool}</Text>
      </Gradient>
    </Box>
  );
};

export const StatusBarComponent = ({ statusBar }) => {
  const modelRoles = statusBar.modelRoles || {};
  const teamModeIndex = statusBar.teamModeIndex || 1;

  // Circles
  let circles = '';
  for (let i = 1; i <= 4; i++) {
    circles += (i === teamModeIndex) ? '●' : '○';
  }

  const modeNames = ['auto', 'planner', 'coder', 'system&web agent'];
  const currentModeName = modeNames[teamModeIndex - 1] || 'watcher';

  // Role model
  const roleModel = modelRoles[currentModeName];
  const activeModel = roleModel || statusBar.model || 'unknown';

  // Context bar
  const BAR_WIDTH = 16;
  const tokensUsed = statusBar.tokensUsed || 0;
  const MAX_TOKENS = 200000;
  const pct = Math.round(Math.min(100, (tokensUsed / MAX_TOKENS) * 100));
  const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round((pct / 100) * BAR_WIDTH)));

  // Permission color
  const permColor = statusBar.permissions === 'full' ? 'red' :
    statusBar.permissions === 'ask' ? 'green' : 'yellow';

  // Voice state
  const voiceColor = statusBar.isVoiceOn ? 'green' : 'gray';
  const voiceIndicator = statusBar.isVoiceOn ? '● on' : '○ off';

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="row" justifyContent="space-between" width="100%">
      <Box flexDirection="row">
        <Text color="cyan">{circles} </Text>
        <Text color="white" bold>{currentModeName} </Text>
        <Text color="gray">→ shift+tab </Text>

        <Text color="gray"> · </Text>
        <Text color="magenta" bold>{activeModel} </Text>

        <Text color="gray"> · </Text>
        <Text color="green">{'█'.repeat(filled)}</Text>
        <Text color="gray">{'░'.repeat(BAR_WIDTH - filled)}</Text>
        <Text color="green"> {pct}% </Text>
        <Text color="gray">ctx </Text>

        <Text color="gray"> · </Text>
        <Text color="gray">permissions: </Text>
        <Text color={permColor} bold>{statusBar.permissions || 'sensitive'} </Text>

        <Text color="gray"> · </Text>
        <Text color="gray">voice: </Text>
        <Text color={voiceColor}>{voiceIndicator} </Text>
        <Text color="gray">→ shift+v </Text>

        <Text color="gray"> · </Text>
        <Text color="gray">charm: → shift+c </Text>

        <Text color="gray"> · </Text>
        <Text color="gray">Ctrl+O toggle collapse</Text>
      </Box>
      <Box>
        <Text color="gray">/ for commands</Text>
      </Box>
    </Box>
  );
};

export const InkChatApp = () => {
  const { exit } = useApp();
  const [appState, setAppState] = useState(uiBridge.state);
  const [collapseCode, setCollapseCode] = useState(true); // Default to collapsed for safety
  const [collapseQueue, setCollapseQueue] = useState(true); // Collapsed task list by default

  useEffect(() => {
    uiBridge.rerender = () => {
      setAppState({
        ...uiBridge.state,
        messages: uiBridge.state.messages ? [...uiBridge.state.messages] : []
      });
    };
    return () => {
      uiBridge.rerender = () => { };
    };
  }, []);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
      process.exit(0);
    }
    if (key.ctrl && input === 'o') {
      setCollapseCode((prev) => !prev);
    }
    if (key.ctrl && (input === 'q' || key.name === 'q')) {
      setCollapseQueue((prev) => !prev);
    }

    // Status bar hotkeys mapping
    if (key.tab && key.shift) {
      if (uiBridge.loopState && uiBridge.updateUIStatusBar) {
        uiBridge.loopState.teamModeIndex = ((uiBridge.loopState.teamModeIndex || 1) % 4) + 1;
        uiBridge.updateUIStatusBar();
        import('../../agent/history.mjs').then(m => m.saveTeamModeSettings(uiBridge.loopState.teamModeIndex, uiBridge.loopState.isTeamModeEnabled)).catch(() => { });
      }
    }
    if (input === 'V' || (key.name === 'v' && key.shift)) {
      if (uiBridge.loopState && uiBridge.updateUIStatusBar) {
        uiBridge.lastVoiceToggleTime = Date.now();
        uiBridge.loopState.isVoiceOn = !uiBridge.loopState.isVoiceOn;
        uiBridge.updateUIStatusBar();
        if (uiBridge.loopState.isVoiceOn) {
          import('../../agent/utils/voice.mjs').then(m => m.startRecording()).catch(() => { });
        } else {
          import('../../agent/utils/voice.mjs').then(m => m.cancelRecording()).catch(() => { });
        }
      }
    }
    if (key.ctrl && key.name === 'l') {
      if (uiBridge.onInputSubmit) {
        uiBridge.onInputSubmit('/model');
      }
    }
    if (key.ctrl && key.name === 'p') {
      if (uiBridge.loopState && uiBridge.updateUIStatusBar) {
        import('../../providers_models/index.mjs').then(({ getModelsGroupedByProvider }) => {
          const allChoices = getModelsGroupedByProvider().flatMap(g => g.choices).filter(c => c && c.value);
          if (allChoices.length > 0) {
            let idx = allChoices.findIndex(c => c.value === uiBridge.loopState.currentModel);
            idx = (idx + 1) % allChoices.length;
            uiBridge.loopState.currentModel = allChoices[idx].value;
            uiBridge.updateUIStatusBar();
            import('../../agent/history.mjs').then(m => m.saveLastModel(uiBridge.loopState.currentModel)).catch(() => { });
          }
        });
      }
    }
  });

  const {
    messages,
    isThinking,
    currentSpinnerText,
    streamingText,
    activeTool,
    statusBar,
    waitingForInput,
    inputPlaceholder,
    activeTip,
    pendingConfirmation,
    pendingMenu,
    onInputSubmit
  } = appState;

  return (
    <Box flexDirection="column" height="100%">
      {/* Main content area */}
      <Box flexGrow={1} flexDirection="column" paddingY={1}>
        <ChatView
          messages={messages}
          isStreaming={isThinking}
          currentContent={streamingText}
          collapseCode={collapseCode}
        />
        <ToolDisplay currentTool={activeTool} />
      </Box>

      {/* Prompts, selections, and menus inline footer area */}
      <Box flexDirection="column" paddingX={1}>
        {pendingConfirmation && (
          <ConfirmPrompt
            message={pendingConfirmation.message}
            onSelect={(val) => pendingConfirmation.resolve(val)}
          />
        )}

        {pendingMenu && (
          <Box flexDirection="column">
            {pendingMenu.type === 'grid' && (
              <GridPrompt
                {...pendingMenu.props}
                onSelect={(val) => pendingMenu.resolve(val)}
                onCancel={() => pendingMenu.resolve(null)}
              />
            )}
            {pendingMenu.type === 'history' && (
              <HistoryPrompt
                {...pendingMenu.props}
                onSelect={(val) => pendingMenu.resolve({ action: 'select', chat: val })}
                onDelete={(val) => pendingMenu.resolve({ action: 'delete', chat: val })}
                onCancel={() => pendingMenu.resolve({ action: 'cancel' })}
              />
            )}
            {pendingMenu.type === 'select' && (
              <SelectPrompt
                {...pendingMenu.props}
                onSelect={(val) => pendingMenu.resolve(val)}
                onCancel={() => pendingMenu.resolve(null)}
              />
            )}
            {pendingMenu.type === 'input' && (
              <InputPrompt
                {...pendingMenu.props}
                onSelect={(val) => pendingMenu.resolve(val)}
                onCancel={() => pendingMenu.resolve('')}
              />
            )}
            {pendingMenu.type === 'search' && (
              <SearchPrompt
                {...pendingMenu.props}
                onSelect={(val) => pendingMenu.resolve(val)}
                onCancel={() => pendingMenu.resolve(null)}
              />
            )}
          </Box>
        )}

        {/* Input box is sticky at the bottom */}
        <Box flexDirection="column">
          {isThinking && currentSpinnerText && (
            <Box paddingX={1} marginY={0}>
              <Text color="yellow">
                <Spinner spinner={cliSpinners.dots} />
              </Text>
              <Text color="yellow" bold> {currentSpinnerText}</Text>
            </Box>
          )}
          {uiBridge.loopState?.globalTaskQueue?.length > 0 && (
            <Box flexDirection="column" paddingX={1} marginY={0}>
              <Text color="cyan" bold>⏳ Queued: {uiBridge.loopState.globalTaskQueue.length} message(s) in queue ({collapseQueue ? 'Ctrl+Q to view' : 'Ctrl+Q to hide'})</Text>
              {!collapseQueue && (
                <Box flexDirection="column" marginLeft={2}>
                  {uiBridge.loopState.globalTaskQueue.map((task, idx) => (
                    <Text key={idx} color="gray">
                      <Text color="cyan" bold> [{idx + 1}]</Text> {task}
                    </Text>
                  ))}
                </Box>
              )}
            </Box>
          )}
          {activeTip && !isThinking && (
            <Box paddingX={1} marginY={0}>
              <Text color="gray">ⓘ Tip: {activeTip}</Text>
            </Box>
          )}
          <InputBox
            placeholder={inputPlaceholder}
            onSubmit={(val) => {
              if (onInputSubmit) onInputSubmit(val);
            }}
            isThinking={isThinking}
            activeSpinnerText={currentSpinnerText}
            isVoiceOn={statusBar.isVoiceOn}
            hasActiveMenu={!!pendingConfirmation || !!pendingMenu}
            isSearchActive={pendingMenu && pendingMenu.type === 'search'}
          />
        </Box>
      </Box>

      {/* Status bar */}
      <StatusBarComponent statusBar={statusBar} />
    </Box>
  );
};

export function startInkUI() {
  // Backup console methods
  const methods = ['log', 'info', 'warn', 'error', 'debug'];
  const original = {};
  methods.forEach(m => { original[m] = console[m]; });

  // Redirect console to uiBridge system logs
  methods.forEach(m => {
    console[m] = (...args) => {
      try {
        const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        uiBridge.state.messages.push({ role: 'system_log', content: line });
        uiBridge.rerender();
      } catch (e) {
        // swallow redirect errors
      }
    };
  });

  const instance = render(React.createElement(InkChatApp));
  uiBridge.activeInstance = instance;

  const restoreConsole = () => {
    methods.forEach(m => { console[m] = original[m]; });
  };

  const origUnmount = instance.unmount.bind(instance);
  instance.unmount = () => {
    uiBridge.activeInstance = null;
    try { origUnmount(); } catch (e) { }
    try { restoreConsole(); } catch (e) { }
  };

  return instance;
}
