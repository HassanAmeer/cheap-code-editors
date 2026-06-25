import { exec } from 'child_process';
import { chromium } from 'playwright-extra';

async function testCDP() {
  console.log('Starting Chrome via open command with debugging port...');
  
  // Try to start Chrome with debugging port
  const profileDir = 'Default'; // just testing default for now
  exec(`open -n -a "Google Chrome" --args --remote-debugging-port=9222 --profile-directory="${profileDir}"`);
  
  // Wait a bit for Chrome to start
  console.log('Waiting 3 seconds for Chrome to start...');
  await new Promise(r => setTimeout(r, 3000));
  
  try {
    console.log('Connecting to Chrome via CDP...');
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    console.log('Successfully connected!');
    const contexts = browser.contexts();
    const page = contexts[0].pages()[0] || await contexts[0].newPage();
    
    await page.goto('https://duckduckgo.com', { timeout: 10000 });
    console.log('Page title:', await page.title());
    
    await browser.close(); // Note: this just disconnects in CDP
    console.log('Disconnected cleanly.');
  } catch (err) {
    console.error('Failed to connect or drive Chrome:', err);
  }
}

testCDP();
