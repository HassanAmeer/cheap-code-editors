import { chromium } from 'playwright-extra';
import os from 'os';
import path from 'path';

async function testRealProfile() {
  const userDataDir = path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
  
  try {
    console.log('Launching Playwright with REAL Chrome directory (without mock keychain)...');
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--profile-directory=Default'],
      ignoreDefaultArgs: ['--password-store=basic', '--use-mock-keychain', '--enable-automation']
    });
    
    console.log('Successfully launched! Check if you are logged in (e.g. to Google).');
    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://google.com', { timeout: 15000 });
    
    await new Promise(r => setTimeout(r, 5000));
    await context.close();
    console.log('Test passed.');
  } catch (err) {
    console.error('Failed to launch:', err);
  }
}

testRealProfile();
