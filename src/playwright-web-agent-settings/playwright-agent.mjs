import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { theme } from '../ui/theme.mjs';

// Browser automation agent (playwright) – cleaned up
// Removed unnecessary imports and added better logging.

function logToFile(msg) {
  if (process.env.DEBUG === 'true') {
    try {
      const timestamp = new Date().toISOString();
      const logLine = `[${timestamp}] ${msg}\n`;
      fs.appendFileSync(path.join(process.cwd(), 'ai_web_agent.log'), logLine);
    } catch (e) { }
  }
}

function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function matchProfileName(targetName, profileName) {
  const q = targetName.toLowerCase().trim();
  const name = profileName.toLowerCase().trim();

  if (q === name) return true;
  
  // FIX: Only match as word or substring if both lengths are reasonable.
  // This prevents matching "web" inside "new website" query when profile is "new".
  // We require the profile name to be at least 3 chars to avoid tiny false matches.
  if (name.length >= 3) {
    // Match exact word surrounded by spaces, commas, or query boundaries
    const wordBoundary = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (wordBoundary.test(q)) return true;
    
    // Match at start or end of query
    if (q.startsWith(name) || q.endsWith(name)) return true;
  }

  const qWords = q.split(/\s+/).filter(w => w.length >= 3);
  const nameWords = name.split(/\s+/).filter(w => w.length >= 3);

  for (const qw of qWords) {
    for (const nw of nameWords) {
      if (qw.includes(nw) || nw.includes(qw)) return true;
      const dist = levenshtein(qw, nw);
      const maxAllowedDist = nw.length > 5 ? 2 : 1;
      if (dist <= maxAllowedDist) return true;
    }
  }
  return false;
}

function getChromeProfileDir(targetName) {
  const chromeLocalStatePath = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Local State');
  if (fs.existsSync(chromeLocalStatePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(chromeLocalStatePath, 'utf8'));
      if (!targetName) {
        if (data.profile && data.profile.last_active_profiles && data.profile.last_active_profiles.length > 0) {
          return data.profile.last_active_profiles[0];
        }
        if (data.profile && data.profile.last_used) {
          return data.profile.last_used;
        }
        return 'Default';
      }

      const profiles = data.profile.info_cache;
      for (const [dirName, info] of Object.entries(profiles)) {
        if (matchProfileName(targetName, info.name)) {
          return dirName;
        }
      }
    } catch (e) { }
  }
  return targetName ? null : 'Default';
}

function shouldKeepBrowserOpen(query, actionObj, closeBrowserBehavior) {
  if (closeBrowserBehavior === 'keep_open') return true;
  if (closeBrowserBehavior === 'close') return false;

  // For 'auto':
  // 1. If AI explicitly said closeBrowser: false
  if (actionObj && actionObj.action === 'finish' && actionObj.closeBrowser === false) {
    return true;
  }

  // 2. If AI explicitly said closeBrowser: true
  if (actionObj && actionObj.action === 'finish' && actionObj.closeBrowser === true) {
    return false;
  }

  // 3. Fallback to keyword-based heuristics on the query
  const q = query.toLowerCase();
  const keepOpenKeywords = ['youtube', 'play', 'video', 'song', 'music', 'stream', 'watch', 'listen', 'keep open', "don't close", "dont close"];
  if (keepOpenKeywords.some(keyword => q.includes(keyword))) {
    return true;
  }

  return false;
}

async function captureAutoScreenshot(page, step, actionName) {
  try {
    const screenshotDir = path.join(process.cwd(), 'webagentscreenshot');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const safeActionName = actionName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `step_${step}_${safeActionName}_${Date.now()}.png`;
    const filepath = path.join(screenshotDir, filename);
    await page.screenshot({ path: filepath });
    console.log(theme.dim(`📸 Captured screenshot: webagentscreenshot/${filename}`));
  } catch (e) {
    // Silently ignore to avoid disrupting execution
  }
}

// FIX: Added missing safeWaitForLoad function
async function safeWaitForLoad(page, timeoutMs = 15000) {
  if (!page) return;
  try {
    await page.waitForLoadState('load', { timeout: timeoutMs });
  } catch (e) {
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs });
    } catch (e2) {
      // Silently ignore - page might be slow or stuck, continue anyway
    }
  }
}

export class BrowserAgent {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.currentHeadless = null;
    this.currentProfileName = null;
  }

  async init(headless = true, profileName = null) {
    if (this.page) {
      if (this.currentProfileName !== profileName || (this.currentHeadless === true && headless === false)) {
        await this.close();
      }
    }
    if (!this.page) {
      let executablePath = undefined;
      let userDataDir = undefined;
      let args = [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-search-engine-choice-screen',
        '--disable-session-crashed-bubble',
        '--disable-features=ChromeWhatsNewUI,ChromeInProductHelp,TranslateUI,SessionCrashedBubble,SigninPromo,SignInPromo,ProfileSignInPromo',
        '--disable-background-networking',
        '--disable-sync'
      ];

      // FIX: Better Chrome flags for headless/visible mode
      if (headless) {
        args.push('--headless=new');
      }

      if (profileName) {
        const profileDirName = getChromeProfileDir(profileName);
        // FIX: If profile not found, THROW error instead of silent fallback
        if (profileDirName) {
          executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
          userDataDir = path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
          args.push(`--profile-directory=${profileDirName}`);

          logToFile(`Using ACTUAL Chrome Profile: "${profileName}" (${profileDirName})`);
          console.log(theme.info(`\n🌐 Using ACTUAL Chrome Profile: "${profileName}" (${profileDirName})...`));
          console.log(theme.warning(`⚠️ Important: If Chrome is currently running, Playwright may fail. If it fails, please close Chrome completely (Cmd+Q).\n`));
        } else {
          // FIX: Throw error so autoBrowse can set fallback message properly
          throw new Error(`Chrome profile "${profileName}" not found. Available profiles couldn't be matched.`);
        }
      } else {
        // No specific profile requested → use clean chromium.launch() (always reliable)
        const chromeExecPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        if (fs.existsSync(chromeExecPath)) {
          executablePath = chromeExecPath;
        }
      }
      try {
        if (userDataDir) {
        // crashes make Chrome think another instance is running.
        try {
          const singletonFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'SingletonV2'];
          for (const sf of singletonFiles) {
            const sfPath = path.join(userDataDir, sf);
            try {
              const stat = fs.lstatSync(sfPath);
              if (stat.isSymbolicLink() || stat.isFile()) {
                fs.unlinkSync(sfPath);
                logToFile(`Cleaned up stale lock file: ${sf}`);
              }
            } catch (e) {}
          }
        } catch (e) {
          logToFile(`Error during cleanup: ${e.message}`);
        }
        
        // FIX: Also clean lock files from the specific profile subdirectory
        if (profileName && userDataDir) {
          const profileDirName = getChromeProfileDir(profileName);
          if (profileDirName) {
            const profilePath = path.join(userDataDir, profileDirName);
            try {
              for (const sf of singletonFiles) {
                const sfPath = path.join(profilePath, sf);
                try {
                  const stat = fs.lstatSync(sfPath);
                  if (stat.isSymbolicLink() || stat.isFile()) {
                    fs.unlinkSync(sfPath);
                    logToFile(`Cleaned up stale lock file in profile dir: ${sf}`);
                  }
                } catch (e) {}
              }
            } catch (e) {
              logToFile(`Error cleaning profile dir locks: ${e.message}`);
            }
          }
        }
        
        // Launch persistent context for the profile
        this.context = await chromium.launchPersistentContext(userDataDir, {
          headless: headless,
          executablePath: executablePath,
          args: args,
          ignoreDefaultArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
          viewport: { width: 1280, height: 800 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          timeout: 45000
        });
        const existingPages = this.context.pages();
        if (existingPages.length > 0) {
          this.page = existingPages[0];
          logToFile(`Using existing page from profile: ${this.page.url()}`);
        } else {
          this.page = await this.context.newPage();
        }
        await this.page.bringToFront();

        // FIX: Close any chrome://welcome or chrome://newtab pages from profile startup
        try {
          const allPages = this.context.pages();
          for (const p of allPages) {
            const pUrl = p.url();
            if (p !== this.page && (pUrl === 'about:blank' || pUrl.startsWith('chrome://'))) {
              await p.close().catch(() => {});
            }
          }
        } catch (e) {}
      } else {
        this.browser = await chromium.launch({
          headless: headless,
          executablePath: executablePath,
          args: args,
          ignoreDefaultArgs: ['--enable-automation']
        });
        this.context = await this.browser.newContext({
          viewport: { width: 1280, height: 800 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        this.page = await this.context.newPage();
      }
    } catch (error) {
      logToFile(`Error during chromium launch: ${error.message}`);
      // FIX: Better error handling - detect various failure modes
      const errMsg = error.message.toLowerCase();
      if (errMsg.includes('already running') || errMsg.includes('lock') || errMsg.includes('locked') || errMsg.includes('timeout')) {
        const reason = errMsg.includes('timeout')
          ? 'Chrome took too long to start. Possible reasons: profile is corrupted, too many extensions, or a Chrome update is pending.'
          : 'Google Chrome is currently running and locking the profile.';
        throw new Error(reason + ` Please completely close Chrome (Cmd+Q) and try again.`);
      }
      throw error;
    }
    // FIX: Only block trackers in headless mode; allow images/css/fonts in visible mode for proper rendering
      // FIX: Only block trackers in headless mode; allow images/css/fonts in visible mode for proper rendering
      await this.context.route('**/*', async (route) => {
        const req = route.request();
        const url = req.url();

        // Always block trackers/ads
        const isTracker = /analytics|doubleclick|googleadservices|facebook|mixpanel|hotjar|gtag|googletagmanager/i.test(url);
        if (isTracker) {
          route.abort();
          return;
        }

        // In headless mode: block heavy resources for speed, but keep essential assets for rendering
        if (headless) {
          const type = req.resourceType();
          if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
            route.abort();
            return;
          }
        }
        
        try {
          await route.continue();
        } catch (e) {}
      });
      // FIX: Wait a moment for the profile's extensions and pages to initialize
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  async safeEvaluate(fn, ...args) {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.page) throw new Error('USER_CANCELLED_TASK');
        await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => { });
        if (!this.page) throw new Error('USER_CANCELLED_TASK');
        return await this.page.evaluate(fn, ...args);
      } catch (error) {
        if (!this.page) throw new Error('USER_CANCELLED_TASK');
        if (error.message === 'USER_CANCELLED_TASK') throw error;
        if (error.message?.includes('Execution context was destroyed') || error.message?.includes('Target closed')) {
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, 1000 * attempt));
            continue;
          }
        }
        throw error;
      }
    }
  }

  async close() {
    if (this.browser) {
      try { await this.browser.close(); } catch (e) { }
      this.browser = null;
    }
    if (this.context) {
      try { await this.context.close(); } catch (e) { }
      this.context = null;
    }
    this.page = null;
    this.currentHeadless = null;
    this.currentProfileName = null;
  }

  /**
   * Basic Hidden Search
   */
  async searchAndExtract(query) {
    console.log(theme.dim(`🕵️ Web Agent Hidden: searching for "${query}"...`));
    const wasAlreadyOpen = !!this.page;
    try {
      if (!this.page) await this.init(true);
      await this.page.goto('https://html.duckduckgo.com/html/', { waitUntil: 'domcontentloaded', timeout: 10000 });
      await this.page.waitForSelector('input[name="q"]', { timeout: 5000 });
      await this.page.fill('input[name="q"]', query);
      await this.page.keyboard.press('Enter');
      await this.page.waitForSelector('.result', { timeout: 15000 }).catch(() => { });

      const results = await this.page.evaluate(() => {
        const snippets = Array.from(document.querySelectorAll('.result__snippet'));
        const titles = Array.from(document.querySelectorAll('.result__title'));
        let data = '';
        for (let i = 0; i < Math.min(titles.length, 5); i++) {
          const title = titles[i] ? titles[i].innerText.trim() : '';
          const snippet = snippets[i] ? snippets[i].innerText.trim() : '';
          data += `Title: ${title}\nSnippet: ${snippet}\n\n`;
        }
        if (!data || data.trim().length < 20) {
          return document.body ? document.body.innerText.replace(/\s+/g, ' ').substring(0, 3000) : '';
        }
        return data;
      });
      console.log(theme.success(`✔ 🕵️ Web Agent Hidden finished.`));
      return `[Search Results for "${query}"]\n\n${results}`;
    } catch (error) {
      console.log(theme.error(`❌ Web Agent Error: ${error.message}`));
      return `Error: ${error.message}`;
    } finally {
      if (!wasAlreadyOpen) {
        await this.close();
      }
    }
  }

  /**
   * Autonomous Auto-Browse
   */
  async autoBrowse(query, aiClient, currentModel, options = {}) {
    const closeBrowserBehavior = options.closeBrowserBehavior || 'auto';
    const executionMode = options.executionMode || 'auto';
    let takeScreenshots = options.takeScreenshots === undefined ? 'yes' : options.takeScreenshots;
    if (takeScreenshots === true) takeScreenshots = 'yes';
    if (takeScreenshots === false) takeScreenshots = 'no';

    const signal = options.signal;
    const abortHandler = async () => {
      try {
        if (this.context && typeof this.context.browser === 'function') {
          const browser = this.context.browser();
          if (browser && typeof browser.close === 'function') {
            await browser.close().catch(() => { });
          }
        }
        if (this.browser) {
          await this.browser.close().catch(() => { });
        }
        await this.close();
      } catch (e) { }
    };

    if (signal) {
      signal.addEventListener('abort', abortHandler);
    }

    const checkAbort = () => {
      if (signal?.aborted || !this.page || !this.context) {
        throw new Error('USER_CANCELLED_TASK');
      }
    };

    console.log(theme.dim(`🌐 Extracting profile info...`));
    let profileName = null;

    // FIX: First try keyword-based profile matching (works even with weak AI models)
    try {
      const chromeLocalStatePath = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/Local State');
      let profiles = {};
      try {
        const data = JSON.parse(fs.readFileSync(chromeLocalStatePath, 'utf8'));
        profiles = data.profile.info_cache || {};
      } catch (e) { }
      // Try to match profile name from query using keyword matching
      if (Object.keys(profiles).length > 0) {
        for (const [dirName, info] of Object.entries(profiles)) {
          if (matchProfileName(query, info.name)) {
            profileName = info.name;
            logToFile(`Keyword-matched Profile: ${profileName} (${dirName})`);
            console.log(theme.info(`🌐 Detected Profile (keyword): ${profileName}`));
            break;
          }
        }
      }

      // If keyword matching failed, try AI-based extraction as fallback
      if (!profileName) {
        let availableProfileNames = Object.values(profiles).map(info => info.name);
        const extractPrompt = `The user requested to open a Chrome profile. Here is the list of available Chrome profiles on this computer: [${availableProfileNames.map(n => `"${n}"`).join(', ')}]. Extract EXACTLY the name of the profile the user wants from this list. If the user query is "open fahim profile", and "Fahim" is in the list, reply with "Fahim". If no profile is requested, reply with exactly "NULL". Query: "${query}"`;

        const profileRes = await aiClient.chat.completions.create({
          model: currentModel,
          messages: [{ role: 'user', content: extractPrompt }]
        });
        let extracted = profileRes.choices[0].message.content.trim();
        if (extracted !== 'NULL' && extracted.toLowerCase() !== 'null') {
          // Verify the extracted name actually matches a real profile
          for (const [dirName, info] of Object.entries(profiles)) {
            if (info.name.toLowerCase() === extracted.toLowerCase()) {
              profileName = info.name;
              logToFile(`AI-detected Profile: ${profileName} (${dirName})`);
              console.log(theme.info(`🌐 Detected Profile (AI): ${profileName}`));
              break;
            }
          }
          if (!profileName) {
            logToFile(`AI returned profile name "${extracted}" but no match found in existing profiles`);
          }
        }
      }
    } catch (e) {
      logToFile(`Profile detection error: ${e.message}`);
    }

    console.log(theme.dim(`🌐 Web Agent Browse: Starting autonomous task...`));
    let memory = [];
    let currentUrl = 'https://duckduckgo.com';
    let shouldClose = true;
    let initialProfileName = profileName;
    let profileFallbackMsg = '';  // Stores fallback info to include in final result

    try {
      logToFile(`Starting autonomous task for query: "${query}"`);

      // FIX: Try initializing with the requested profile first
      try {
        await this.init(false, profileName); // Visible browser with optional profile
      } catch (initError) {
        // FIX: If profile fails, fall back to no profile (default) with clear error reason
        if (profileName) {
          const failReason = initError.message || "Unknown error";
          profileFallbackMsg = `⚠️ NOTE: "${profileName}" profile failed to open. Reason: ${failReason}. Using default profile instead.`;
          logToFile(`Profile "${profileName}" failed: ${failReason}. Falling back to default profile.`);
          console.log(theme.warning(`\n❌ "${profileName}" profile failed to open.`));
          console.log(theme.dim(`   Reason: ${failReason}`));
          console.log(theme.info(`🌐 Falling back to default Chrome profile...\n`));
          profileName = null;
          await this.close();
          await this.init(false, null);
        } else {
          throw initError; // Re-throw if no profile was being used
        }
      }

      checkAbort();
      const safeGoto = (url, timeoutMs) => Promise.race([
        this.page.goto(url, { waitUntil: 'load', timeout: timeoutMs }),
        new Promise((_, r) => setTimeout(() => r(new Error('goto timeout deadlock')), timeoutMs + 1000))
      ]);
      const safeWaitForLoad = (timeoutMs) => Promise.race([
        this.page.waitForLoadState('load', { timeout: timeoutMs }),
        new Promise((_, r) => setTimeout(() => r(new Error('wait timeout deadlock')), timeoutMs + 1000))
      ]);
      // FIX: ALWAYS navigate to a search engine to ensure the page is usable
      const currentLoc = this.page.url();
      logToFile(`Initial page URL after init: "${currentLoc}"`);
      console.log(theme.dim(`🌐 Current page: ${currentLoc}`));

      // Force navigate to a search engine as the starting point
      console.log(theme.dim(`🌐 Navigating to search engine...`));

      // FIX: Try multiple search engines in order until one succeeds
      const searchUrls = [
        'https://duckduckgo.com',
        'https://www.google.com',
        'https://www.bing.com'
      ];

      let navigated = false;
      for (const url of searchUrls) {
        if (navigated) break;
        try {
          logToFile(`Attempting navigation to: ${url}`);
          await safeGoto(url, 10000);
          // Check if we actually got a real page (not about:blank)
          const pageUrl = this.page.url();
          if (pageUrl && pageUrl !== 'about:blank' && !pageUrl.startsWith('chrome://')) {
            navigated = true;
            logToFile(`Successfully navigated to: ${pageUrl}`);
            console.log(theme.success(`🌐 Navigated to: ${pageUrl}`));
          }
        } catch (err) {
          logToFile(`Navigation to ${url} failed: ${err.message}`);
          console.log(theme.warning(`🌐 Retry with alternative search engine...`));
        }
      }

      if (!navigated) {
        logToFile(`All navigation attempts failed. Current URL: ${this.page.url()}`);
        console.log(theme.warning(`🌐 Navigation had issues, continuing with current page...`));
      }

      checkAbort();

      // FIX: Wait for page to be fully rendered and interactive
      await new Promise(r => setTimeout(r, 1000));
      await safeWaitForLoad(10000).catch(() => {});
      await new Promise(r => setTimeout(r, 500));
      checkAbort();
      checkAbort();

      const MAX_STEPS = 150;
      for (let step = 1; step <= MAX_STEPS; step++) {
        checkAbort();
        logToFile(`Step ${step}/${MAX_STEPS}: Analyzing page... (URL: ${this.page.url()})`);
        console.log(theme.dim(`🌐 Step ${step}/${MAX_STEPS}: Analyzing page...`));

        await new Promise(r => setTimeout(r, 100));
        checkAbort();
        await safeWaitForLoad(10000).catch(() => { });
        checkAbort();

        // FIX: Enhanced element detection - include ALL interactive elements including empty inputs
        const pageState = await this.safeEvaluate(() => {
          let elements = [];
          const interactables = document.querySelectorAll(
            'a, button, input, textarea, select, [role="button"], [role="link"], [role="textbox"], [role="searchbox"], [tabindex="0"], [contenteditable]'
          );
          interactables.forEach((el, index) => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              el.setAttribute('data-browser-id', index.toString());
              let text = el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || el.getAttribute('title') || el.name || el.id || '';
              const tag = el.tagName.toLowerCase();
              const inputType = (el.type || '').toLowerCase();
              const isInputField = tag === 'input' || tag === 'textarea' || el.getAttribute('role') === 'textbox' || el.getAttribute('role') === 'searchbox' || el.isContentEditable;

              elements.push({
                id: index,
                tag: tag,
                type: inputType || tag,
                text: text.trim().substring(0, 100),
                placeholder: (el.placeholder || '').substring(0, 60),
                name: (el.name || el.id || '').substring(0, 40),
                isInput: !!isInputField
              });
            }
          });
          // Get all visible links with their href
          let links = [];
          document.querySelectorAll('a[href]').forEach((el, idx) => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && el.href) {
              links.push({
                id: idx,
                text: (el.innerText || '').trim().substring(0, 80),
                href: el.href.substring(0, 200)
              });
            }
          });

          // Get any visible forms
          let forms = [];
          document.querySelectorAll('form').forEach((f, idx) => {
            forms.push({
              id: idx,
              action: f.action || '',
              inputs: f.querySelectorAll('input, textarea, select').length
            });
          });

          return {
            url: document.location.href,
            title: document.title,
            text: document.body ? document.body.innerText.replace(/\s+/g, ' ').substring(0, 5000) : '',
            elements: elements.slice(0, 150),
            links: links.slice(0, 50),
            forms: forms.slice(0, 10)
          };
        });
        checkAbort();

        // Compile open tabs information dynamically
        let tabsInfo = [];
        try {
          checkAbort();
          const pages = this.context.pages();
          tabsInfo = await Promise.all(pages.map(async (p, idx) => {
            try {
              if (signal?.aborted || !this.page || !p) throw new Error('USER_CANCELLED_TASK');
              await Promise.race([
                p.waitForLoadState('domcontentloaded', { timeout: 3000 }),
                new Promise(r => setTimeout(r, 3500))
              ]).catch(() => { });
              if (signal?.aborted || !this.page || !p) throw new Error('USER_CANCELLED_TASK');
              return {
                index: idx,
                title: await p.title().catch(() => "Untitled"),
                url: p.url(),
                active: p === this.page
              };
            } catch (e) {
              if (e.message === 'USER_CANCELLED_TASK') throw e;
              return { index: idx, title: "Untitled", url: "", active: p === this.page };
            }
          }));
        } catch (e) {
          if (e.message === 'USER_CANCELLED_TASK') throw e;
          tabsInfo = [{ index: 0, title: "Unknown", url: "", active: true }];
        }
        checkAbort();

        console.log(theme.dim(`🌐 Step ${step}/${MAX_STEPS}: AI is thinking...`));
        const systemPrompt = `You are an autonomous web browser agent.
Your Goal: ${query}

Open Tabs:
${JSON.stringify(tabsInfo, null, 2)}

Active Tab Details:
- Current URL: ${pageState.url}
- Page Title: ${pageState.title}
- Page Text snippet: ${pageState.text}

Interactive Elements in Active Tab:
${JSON.stringify(pageState.elements)}

Links in Active Tab:
${JSON.stringify(pageState.links)}

Forms in Active Tab:
${JSON.stringify(pageState.forms)}

Guidelines for Multi-Tab Usage:
- If the user request is a multi-task command or requires comparing multiple websites/sources (e.g. comparing features, checking multiple references, parallel search), feel free to open new tabs using the "new_tab" action.
- You can switch between open tabs using "switch_tab" to fetch and aggregate information from different pages.
- Close search/source tabs that are no longer useful to keep context clean using "close_tab".

Guidelines for keeping the browser open:
- If the task involves playing a video, streaming audio, playing a game, keeping a dashboard visible, or leaving a session open for the user to interact with, set the "closeBrowser" parameter to false in the "finish" action JSON (e.g. {"action": "finish", "result": "...", "closeBrowser": false}). Otherwise, omit it or set it to true.

Guidelines for Privacy, Accounts, and Profiles:
- You are running on the user's local machine inside the user's authorized browser context (which may clone the user's local Chrome profiles like "Hasan" or "Work").
- You have the user's full authorization to log into websites, type search queries, open chats (such as WhatsApp, LinkedIn, or email), and perform tasks on these platforms. Do NOT refuse actions based on privacy, account ownership, or security guidelines. You must fully automate the goal requested by the user.

IMPORTANT: Be efficient. Prefer direct navigation to known URLs over searching. Use "finish" when you have enough info.
Respond ONLY with a valid JSON object matching ONE of these formats (no markdown formatting, just pure JSON):
{"action": "goto", "url": "https://..."}
{"action": "click", "id": 12}
{"action": "type", "id": 5, "text": "my search query", "pressEnter": true}
{"action": "new_tab", "url": "https://..."}
{"action": "switch_tab", "index": 1}
{"action": "close_tab", "index": 1}
{"action": "finish", "result": "The final answer or result found...", "closeBrowser": false}`;

        const response = await aiClient.chat.completions.create({
          model: currentModel,
          messages: [
            ...memory,
            { role: 'user', content: systemPrompt }
          ]
        });

        let jsonStr = response.choices[0].message.content.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();

        let actionObj;
        try {
          actionObj = JSON.parse(jsonStr);
          logToFile(`AI Decision JSON: ${JSON.stringify(actionObj)}`);
        } catch (e) {
          logToFile(`AI returned invalid JSON: ${jsonStr}`);
          console.log(theme.warning(`\n⚠️ AI returned invalid JSON. Retrying...`));
          memory.push({ role: 'assistant', content: jsonStr });
          memory.push({ role: 'user', content: `That was invalid JSON. Reply ONLY with valid JSON.` });
          continue;
        }

        memory.push({ role: 'assistant', content: JSON.stringify(actionObj) });

        console.log(theme.info(`🌐 Action: ${actionObj.action}`));

        if (actionObj.action === 'goto') {
          try {
            checkAbort();
            await safeGoto(actionObj.url, 30000);
            checkAbort();
          } catch (error) {
            if (error.message === 'USER_CANCELLED_TASK') throw error;
            console.log(theme.warning(`\n⚠️ Navigation failed, continuing: ${error.message}`));
          }
        }
        else if (actionObj.action === 'click') {
          try {
            checkAbort();
            await this.safeEvaluate((id) => {
              const el = document.querySelector(`[data-browser-id="${id}"]`);
              if (el) el.click();
            }, actionObj.id);
            checkAbort();
            await safeWaitForLoad(this.page, 10000).catch(() => { });
            checkAbort();
          } catch (error) {
            if (error.message === 'USER_CANCELLED_TASK') throw error;
            console.log(theme.warning(`\n⚠️ Click failed, continuing: ${error.message}`));
          }
        }
        else if (actionObj.action === 'type') {
          logToFile(`Action: type "${actionObj.text}" in ID ${actionObj.id}`);
          try {
            await safeWaitForLoad(10000).catch(() => {});
            // FIX: First try fill, if that fails use keyboard.type for better compatibility
            const selector = `[data-browser-id="${actionObj.id}"]`;
            const elHandle = await this.page.$(selector);
            if (elHandle) {
              // Clear the field first
              await elHandle.click();
              await this.page.keyboard.down('Meta');
              await this.page.keyboard.press('a');
              await this.page.keyboard.up('Meta');
              await this.page.keyboard.press('Backspace');
              await new Promise(r => setTimeout(r, 200));
              // Type the text
              await this.page.keyboard.type(actionObj.text, { delay: 30 });
            } else {
              await this.page.fill(selector, actionObj.text);
            }
            if (actionObj.pressEnter) {
              logToFile(`Action: pressing Enter`);
              checkAbort();
              await this.page.keyboard.press('Enter');
              checkAbort();
              await safeWaitForLoad(this.page, 10000).catch(() => { });
              checkAbort();
            }
          } catch (error) {
            if (error.message === 'USER_CANCELLED_TASK') throw error;
            console.log(theme.warning(`\n⚠️ Type action failed, continuing: ${error.message}`));
          }
        }
        else if (actionObj.action === 'new_tab') {
          logToFile(`Action: new_tab ${actionObj.url || ''}`);
          try {
            await safeWaitForLoad(10000).catch(() => {});
            checkAbort();
            const newPage = await this.context.newPage();
            this.page = newPage;
            checkAbort();
            await safeGoto(actionObj.url || 'https://google.com', 30000).catch(() => { });
            checkAbort();
          } catch (error) {
            if (error.message === 'USER_CANCELLED_TASK') throw error;
            console.log(theme.warning(`\n⚠️ New tab failed, continuing: ${error.message}`));
          }
        }
        else if (actionObj.action === 'switch_tab') {
          logToFile(`Action: switch_tab index ${actionObj.index}`);
          checkAbort();
          const pagesList = this.context.pages();
          const targetIndex = actionObj.index;
          if (targetIndex >= 0 && targetIndex < pagesList.length) {
            this.page = pagesList[targetIndex];
            checkAbort();
            await this.page.bringToFront();
            checkAbort();
          } else {
            console.log(theme.warning(`\n⚠️ Switch tab index ${targetIndex} is out of bounds.`));
          }
        }
        else if (actionObj.action === 'close_tab') {
          logToFile(`Action: close_tab index ${actionObj.index}`);
          checkAbort();
          const pagesList = this.context.pages();
          const targetIndex = actionObj.index;
          if (targetIndex >= 0 && targetIndex < pagesList.length) {
            if (pagesList.length > 1) {
              const tabToClose = pagesList[targetIndex];
              await tabToClose.close();
              checkAbort();
              if (tabToClose === this.page) {
                const remainingPages = this.context.pages();
                this.page = remainingPages[0];
                checkAbort();
                await this.page.bringToFront();
                checkAbort();
              }
            } else {
              console.log(theme.warning(`\n⚠️ Cannot close the last remaining tab.`));
            }
          }
        }
        else if (actionObj.action === 'finish') {
          logToFile(`Action: finish. Result: ${actionObj.result}`);
          shouldClose = !shouldKeepBrowserOpen(query, actionObj, closeBrowserBehavior);
          if (takeScreenshots === 'yes' || takeScreenshots === 'only_required') {
            try {
              checkAbort();
              await captureAutoScreenshot(this.page, step, 'finish');
            } catch (se) {
              if (se.message === 'USER_CANCELLED_TASK') throw se;
            }
          }
          console.log(theme.success(`✔ 🌐 Web Agent Browse task completed!`));
          const finalResult = profileFallbackMsg 
            ? `[Auto-Browse Result for "${query}"]\n\n${profileFallbackMsg}\n\n${actionObj.result}`
            : `[Auto-Browse Result for "${query}"]\n\n${actionObj.result}`;
          return finalResult;
        }

        if (takeScreenshots === 'yes') {
          try {
            checkAbort();
            await captureAutoScreenshot(this.page, step, actionObj.action);
          } catch (se) {
            if (se.message === 'USER_CANCELLED_TASK') throw se;
          }
        }

        await new Promise(r => setTimeout(r, 50));
      }

      logToFile(`Reached maximum steps (${MAX_STEPS}) without finishing.`);
      console.log(theme.warning(`❌ 🌐 Reached maximum steps (${MAX_STEPS}) without finishing.`));
      // FIX: If profile was used, suggest retrying without profile
      let maxStepsMsg = `Auto-browse reached maximum steps. It might have gotten stuck.`;
      if (initialProfileName) {
        maxStepsMsg += ` Note: Was using profile "${initialProfileName}". Try without profile next time.`;
      }
      shouldClose = !shouldKeepBrowserOpen(query, null, closeBrowserBehavior);
      if (takeScreenshots === 'yes' || takeScreenshots === 'only_required') {
        try {
          if (this.page) {
            await captureAutoScreenshot(this.page, 'max_steps', 'failed');
          }
        } catch (se) { }
      }
      return maxStepsMsg;

    } catch (error) {
      logToFile(`Web Agent Browse Error: ${error.message}`);
      if (error.message === 'USER_CANCELLED_TASK') {
        console.log(theme.warning(`❌ 🌐 Task cancelled by user.`));
        return `Task was cancelled by the user.`;
      }
      if (takeScreenshots === 'yes' || takeScreenshots === 'only_required') {
        try {
          if (this.page) {
            await captureAutoScreenshot(this.page, 'error', 'failed');
          }
        } catch (se) { }
      }
      shouldClose = true;
      console.log(theme.error(`❌ Web Agent Browse Error: ${error.message}`));
      let errorMsg = `Error during autonomous browse: ${error.message}`;
      // FIX: If profile was used, suggest retrying without profile
      if (initialProfileName && error.message.includes('lock')) {
        errorMsg += `\nNote: Profile "${initialProfileName}" might be locked. Close Chrome completely and try again, or try without a specific profile.`;
      }
      return errorMsg;
    } finally {
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
      if (shouldClose) {
        await this.close();
      }
      if (!shouldClose) {
        console.log(theme.info(`\n🌐 Browser kept open as requested. You can continue tasks in the same browser session.\n`));
      }
    }
  }
}

export const webAgent = new BrowserAgent();

export async function runWebAgent(query) {
  return await webAgent.searchAndExtract(query);
}

export async function runAutoWebAgent(query, aiClient, currentModel, options = {}) {
  return await webAgent.autoBrowse(query, aiClient, currentModel, options);
}
