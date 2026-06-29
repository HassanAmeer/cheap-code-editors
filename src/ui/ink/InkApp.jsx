import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';

// Main Chat View Component
export const ChatView = ({ messages, isStreaming, currentContent }) => {
  return (
    <Box flexDirection="column" padding={1}>
      {messages.map((msg, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          {msg.role === 'user' && (
            <Box>
              <Text color="cyan" bold>❯ </Text>
              <Text>{msg.content}</Text>
            </Box>
          )}
          {msg.role === 'assistant' && (
            <Box flexDirection="column">
              <Box borderStyle="single" borderColor="gray" paddingX={1}>
                <Text>{msg.content}</Text>
              </Box>
            </Box>
          )}
        </Box>
      ))}
      
      {isStreaming && currentContent && (
        <Box flexDirection="column">
          <Box borderStyle="single" borderColor="cyan" paddingX={1}>
            <Text>{currentContent}</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text color="gray"> Thinking...</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

// Tool Execution Panel
export const ToolPanel = ({ currentTool, toolHistory }) => {
  return (
    <Box 
      flexDirection="column" 
      borderStyle="single" 
      borderColor="yellow"
      padding={1}
      width={35}
    >
      <Text color="yellow" bold>🛠 Tool Execution</Text>
      <Box marginTop={1} flexDirection="column">
        {currentTool && (
          <Box>
            <Text color="cyan">
              <Spinner type="dots" />
            </Text>
            <Text> {currentTool.name}</Text>
          </Box>
        )}
        {toolHistory.slice(-5).map((tool, i) => (
          <Box key={i} marginTop={1}>
            <Text color="green">✓ </Text>
            <Text color="gray">{tool.name}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// Status Bar Component
export const StatusBar = ({ model, permissions, tokensUsed }) => {
  const maxTokens = 200000;
  const percentage = Math.min(100, (tokensUsed / maxTokens) * 100);
  const barWidth = 20;
  const filled = Math.round((percentage / 100) * barWidth);
  
  const permColor = permissions === 'full' ? 'red' : 
                    permissions === 'ask' ? 'green' : 'yellow';
  
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text color="cyan">{model}</Text>
      <Text color="gray"> · </Text>
      <Text color={permColor}>{permissions}</Text>
      <Text color="gray"> · </Text>
      <Text color="green">{'█'.repeat(filled)}</Text>
      <Text color="gray">{'░'.repeat(barWidth - filled)}</Text>
      <Text> {Math.round(percentage)}% ctx</Text>
      <Text color="gray"> · / for commands</Text>
    </Box>
  );
};

// Input Box Component
export const InputBox = ({ onSubmit, disabled }) => {
  const [input, setInput] = useState('');
  
  useInput((char, key) => {
    if (disabled) return;
    
    if (key.return) {
      if (input.trim()) {
        onSubmit(input);
        setInput('');
      }
    } else if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
    } else if (char && !key.ctrl && !key.meta) {
      setInput(prev => prev + char);
    }
  });
  
  return (
    <Box 
      borderStyle="single" 
      borderColor={disabled ? 'gray' : 'cyan'}
      paddingX={1}
    >
      <Text color="cyan" bold>❯ </Text>
      <Text>{input || <Text color="gray">Write Your Task...</Text>}</Text>
      {disabled && (
        <Text color="yellow"> (Processing...)</Text>
      )}
    </Box>
  );
};

// Main App Component
export const InkApp = () => {
  const { exit } = useApp();
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentContent, setCurrentContent] = useState('');
  const [currentTool, setCurrentTool] = useState(null);
  const [toolHistory, setToolHistory] = useState([]);
  const [state, setState] = useState({
    currentModel: 'gpt-4',
    autoPermissionMode: 'sensitive',
    modelTokenUsage: { 'gpt-4': 1500 }
  });
  
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
  });
  
  const handleSubmit = async (input) => {
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    
    // Start streaming
    setIsStreaming(true);
    setCurrentContent('');
    
    // Simulate AI response streaming
    const response = "This is a simulated AI response...";
    for (let i = 0; i < response.length; i++) {
      setCurrentContent(response.slice(0, i + 1));
      await new Promise(r => setTimeout(r, 20));
    }
    
    // Finish streaming
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setIsStreaming(false);
    setCurrentContent('');
  };
  
  return (
    <Box flexDirection="column" height="100%">
      {/* Main content area */}
      <Box flexDirection="row" flexGrow={1}>
        <ChatView 
          messages={messages}
          isStreaming={isStreaming}
          currentContent={currentContent}
        />
        {(currentTool || toolHistory.length > 0) && (
          <ToolPanel 
            currentTool={currentTool}
            toolHistory={toolHistory}
          />
        )}
      </Box>
      
      {/* Input area */}
      <InputBox 
        onSubmit={handleSubmit}
        disabled={isStreaming}
      />
      
      {/* Status bar */}
      <StatusBar 
        model={state.currentModel}
        permissions={state.autoPermissionMode}
        tokensUsed={Object.values(state.modelTokenUsage).reduce((a, b) => a + b, 0)}
      />
    </Box>
  );
};
