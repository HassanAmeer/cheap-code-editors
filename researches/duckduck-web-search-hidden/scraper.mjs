// HIDDEN WEB SEARCH: This file uses Playwright with puppeteer-extra-plugin-stealth
// to scrape DuckDuckGo search results without requiring an API key.

import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { theme } from "../../src/ui/theme.mjs";

chromium.use(StealthPlugin());

export async function duckduckSearchFallback(searchQuery) {
  let browser;
  try {
    console.log(theme.info(`\n󰀪️ Method 2: DuckDuckGo Fallback Search - "${searchQuery}"...`));
    browser = await chromium.launch({
      headless: true
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    const url = `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&ia=web`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    let textContent = '';
    try {
      await page.waitForSelector('.react-results--main', { timeout: 5000 });
      textContent = await page.evaluate(() => {
        document.querySelectorAll('script, style, noscript').forEach(el => el.remove());
        const el = document.querySelector('.react-results--main');
        return el ? el.innerText : '';
      });
    } catch (e) {
      try {
        await page.waitForSelector('#links', { timeout: 5000 });
        textContent = await page.evaluate(() => {
          document.querySelectorAll('script, style, noscript').forEach(el => el.remove());
          const el = document.querySelector('#links');
          return el ? el.innerText : '';
        });
      } catch (e2) {
        textContent = await page.evaluate(() => {
          document.querySelectorAll('script, style, noscript').forEach(el => el.remove());
          return document.body ? document.body.innerText : '';
        });
      }
    }

    return `Source: DuckDuckGo Fallback\n\nData:\n${textContent.replace(/\s+/g, ' ').substring(0, 8000)}`;
  } catch (error) {
    console.log(theme.dim(`Error: Method 2 failed (${error.message}).`));
    return `Error searching via DuckDuckGo Fallback: ${error.message}`;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
}

export async function fetchWebsiteDirectly(url) {
  let browser;
  try {
    console.log(theme.info(`\n󰖟 Method 3: Direct Website Extraction - "${url}"...`));
    browser = await chromium.launch({
      headless: true
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const textContent = await page.evaluate(() => {
      document.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      return document.body ? document.body.innerText : '';
    });

    return `Source: ${url}\n\nData:\n${textContent.replace(/\s+/g, ' ').substring(0, 8000)}`;
  } catch (error) {
    console.log(theme.dim(`Error: Method 3 failed (${error.message}).`));
    return `Error fetching website: ${error.message}`;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
}

