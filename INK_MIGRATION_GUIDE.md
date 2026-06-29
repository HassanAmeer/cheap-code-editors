# Migration Guide: Custom Spinner → Ink TUI

## 🔴 Current Problem (Root Cause)

**Custom readline spinner + console.log = Dirty Prints**

```javascript
// ❌ CURRENT BROKEN APPROACH:
const spinner = setInterval(() => {
  process.stdout.write('\r⠋ Reading file...');  // Custom animation
}, 80);

// Meanwhile, somewhere else:
console.log('✔ File read complete');  // <-- INTERFERES WITH SPINNER!

// Result: Dirty prints, overlapping text, stuck spinners
```

### Why it fails:
1. **Two competing output systems** - Custom ANSI codes vs console.log
2. **Race conditions** - Spinner interval + async console output
3. **No coordination** - Each system doesn't know about the other
4. **Terminal state corruption** - Cursor position gets lost

---

## ✅ Solution: Ink TUI

**React Virtual DOM manages ALL terminal output**

```javascript
// ✅ INK APPROACH (NO DIRTY PRINTS):
<Box>
  <Spinner /> Reading file...
  {complete && <Text>✔ Complete</Text>}
</Box>

// Result: Clean, coordinated rendering
```

### Why it works:
1. **Single render system** - React manages everything
2. **Virtual DOM** - Only updates what changed
3. **No race conditions** - Renders are synchronized
4. **Proper cleanup** - Components unmount cleanly

---

## 📦 Migration Steps

### Step 1: Test Ink UI
```bash
# Run test to verify Ink works
node test-ink.mjs

# Should see ZERO dirty prints!
```

### Step 2: Install Additional Packages
```bash
npm install ink-spinner ink-box --legacy-peer-deps
```

### Step 3: Replace Spinner in loop.mjs

**BEFORE (Custom Spinner - Lines ~600-700):**
```javascript
const spinnerInterval = setInterval(() => {
  spinnerFrameIdx++;
  renderSpinner();
}, 30);
```

**AFTER (Ink UI):**
```javascript
import { startInkUI } from '../ui/ink/ProductionInkUI.jsx';

// At start of loop:
const inkUI = startInkUI(state);

// Update state instead of rendering manually:
state.currentSpinnerText = 'Reading file...';
state.isThinking = true;

// When done:
state.isThinking = false;
inkUI.unmount();
```

### Step 4: Remove Custom Spinner Code

Delete these sections from `loop.mjs`:
- `erasePreviousLines()`
- `renderSpinner()`
- `spinnerInterval`
- `setConsoleSpinnerHooks()`
- All ANSI escape code logic

### Step 5: Update Tool Executor

**In `tool-executor.mjs`:**

```javascript
// BEFORE:
safeLog(() => console.log('✔ Read file'));

// AFTER:
// Just update state - Ink handles display
state.currentSpinnerText = 'Reading file: ' + args.relativePath;
```

---

## 🎯 Benefits Summary

| Feature | Custom Spinner | Ink TUI |
|---------|---------------|---------|
| Dirty Prints | ❌ Yes | ✅ No |
| Complex Layouts | ❌ Hard | ✅ Easy |
| Component Reuse | ❌ No | ✅ Yes |
| Testing | ❌ Hard | ✅ Easy |
| Maintenance | ❌ Complex | ✅ Simple |
| Streaming | ❌ Flickers | ✅ Smooth |
| Code Diffs | ❌ Manual | ✅ Built-in |

---

## 📋 Checklist

- [ ] Test Ink UI (`node test-ink.mjs`)
- [ ] Install dependencies
- [ ] Replace spinner in `loop.mjs`
- [ ] Remove custom spinner code
- [ ] Update `tool-executor.mjs`
- [ ] Test full CLI flow
- [ ] Verify zero dirty prints

---

## 🐛 Debug with Logs

Check debug log for render issues:
```bash
# Run CLI
node bin/cheap.mjs "your task"

# Check logs
cat db/debug_logs/render-debug.log
```

Look for:
- Multiple SPINNER renders
- CONSOLE.LOG calls during spinner
- Hook state issues

---

## 🚀 Expected Result

**After migration:**
```
▌ Let me read the file...

⠋ Reading file: index.html

▌ Found the issue. Let me fix it...

⠸ Editing file: index.html

✓ Complete!
```

**Clean, smooth, NO DIRTY PRINTS!** 🎉

---

## 📞 Troubleshooting

### Issue: Ink exits immediately
**Fix:** Use `waitUntilExit()` and keep state mutable

### Issue: State updates don't show
**Fix:** Use React state hooks properly

### Issue: Still dirty prints
**Fix:** Make sure NO direct console.log during Ink render

---

## 🎓 Key Takeaway

**Never mix custom terminal rendering with console.log!**

Use Ink TUI for:
- Professional terminal UIs
- Complex layouts
- Streaming displays
- Zero rendering bugs

**Current readline approach only works for simple, non-interactive CLIs.**
