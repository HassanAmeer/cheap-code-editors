# Ink TUI Architecture for Cheap CLI

## Overview
Converting entire CLI to Ink TUI for zero dirty prints and professional UI.

## Components Structure

```
src/ui/ink/
├── App.jsx                    # Main app container
├── ChatView.jsx               # Chat messages display
├── StreamingResponse.jsx      # AI streaming with diff rendering
├── ToolExecutionPanel.jsx     # Shows active tool execution
├── StatusBar.jsx              # Bottom status bar
├── InputBox.jsx               # User input with history
├── SidePanel.jsx              # Optional file tree / context
├── DiffViewer.jsx             # Code diff visualization
├── ProgressIndicator.jsx      # Tool progress bars
└── components/
    ├── Message.jsx            # Single chat message
    ├── CodeBlock.jsx          # Syntax highlighted code
    ├── Spinner.jsx            # Custom spinner
    └── Menu.jsx               # Interactive menus
```

## Key Features

### 1. Split Layout
```jsx
<Box flexDirection="row" height="100%">
  <SidePanel width={30} />        {/* File tree, context */}
  <ChatView flex={1} />            {/* Main chat area */}
  <ToolPanel width={40} />         {/* Active tools */}
</Box>
<StatusBar />
```

### 2. Streaming AI Response
```jsx
<StreamingResponse>
  <Text>{currentContent}</Text>
  {isStreaming && <Spinner />}
  {diffData && <DiffViewer diff={diffData} />}
</StreamingResponse>
```

### 3. Tool Execution Visualization
```jsx
<ToolExecutionPanel>
  <Text>✓ Read file: index.js</Text>
  <ProgressBar value={75} label="Creating file..." />
  <Text color="yellow">⟳ Running command...</Text>
</ToolExecutionPanel>
```

### 4. Code Diff Display
```jsx
<DiffViewer>
  <Text color="red">- old line</Text>
  <Text color="green">+ new line</Text>
</DiffViewer>
```

## Packages Needed

```bash
npm install ink react
npm install ink-spinner
npm install ink-text-input
npm install ink-select-input
npm install ink-table           # For structured data
npm install ink-box             # Bordered boxes
npm install ink-gradient        # Gradient text
npm install ink-link            # Clickable links
npm install chalk               # Colors
npm install strip-ansi          # Strip ANSI codes
npm install react-syntax-highlighter  # Code highlighting
```

## Implementation Strategy

### Phase 1: Core Components (Week 1)
- App.jsx main container
- ChatView with message history
- InputBox with command handling
- StatusBar

### Phase 2: Advanced Features (Week 2)
- StreamingResponse with live updates
- ToolExecutionPanel
- DiffViewer for file changes
- CodeBlock with syntax highlighting

### Phase 3: Polish (Week 3)
- SidePanel for context
- Keyboard shortcuts
- Theme support
- Performance optimization

## Example: Main App Component

```jsx
import React, { useState, useEffect } from 'react';
import { Box, useApp, useInput } from 'ink';
import ChatView from './ChatView.jsx';
import InputBox from './InputBox.jsx';
import StatusBar from './StatusBar.jsx';
import ToolPanel from './ToolExecutionPanel.jsx';

export const App = ({ initialState }) => {
  const { exit } = useApp();
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentTool, setCurrentTool] = useState(null);
  
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
  });
  
  return (
    <Box flexDirection="column" height="100%">
      <Box flexDirection="row" flexGrow={1}>
        <ChatView 
          messages={messages} 
          isStreaming={isStreaming}
          flex={1}
        />
        {currentTool && (
          <ToolPanel 
            tool={currentTool}
            width={35}
          />
        )}
      </Box>
      <InputBox 
        onSubmit={handleSubmit}
        disabled={isStreaming}
      />
      <StatusBar 
        model={state.currentModel}
        permissions={state.autoPermissionMode}
        tokens={state.modelTokenUsage}
      />
    </Box>
  );
};
```

## Advantages Over Current Implementation

### Current (Readline):
❌ Manual cursor management
❌ ANSI escape codes everywhere
❌ Dirty print issues
❌ Hard to maintain complex layouts
❌ No component reusability

### With Ink:
✅ Automatic rendering
✅ React component model
✅ Zero dirty prints
✅ Easy layouts with Flexbox
✅ Reusable components
✅ Better testing
✅ Community packages available

## Performance Considerations

1. **Virtual DOM** - Ink only updates changed parts
2. **Debouncing** - Use for rapid streaming updates
3. **Memoization** - React.memo for heavy components
4. **Lazy Loading** - Load components on demand

## Migration Path

### Option A: Gradual Migration (Recommended)
1. Keep existing readline for basic input
2. Convert complex UIs to Ink first (status bar, tool panels)
3. Eventually replace entire app

### Option B: Full Rewrite
1. Create new Ink app from scratch
2. Port all features
3. Switch completely

## Conclusion

**Ink TUI is the best approach** for:
- Professional terminal UI
- Zero rendering issues
- Maintainable codebase
- Better user experience

Current readline approach thik hai for simple CLIs, but aapka CLI complex hai with:
- Streaming responses
- Multiple tool executions
- File diffs
- Status bars
- Interactive menus

**Recommendation: Full Ink migration** for long-term stability! 🚀
