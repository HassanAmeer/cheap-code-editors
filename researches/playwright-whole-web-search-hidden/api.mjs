// HIDDEN WEB SEARCH: This file acts as a fallback to perform web searches
// by routing queries through the internal DuckDuckGo scraper method.

import { duckduckSearchFallback } from "../duckduck-web-search-hidden/scraper.mjs";
import { theme } from "../../src/ui/theme.mjs";

export async function searchWebWithFreeSearchAPI(searchQuery) {
  try {
    console.log(theme.info(`\n󰍉 Method 1: Global Web Search - "${searchQuery}"...`));

    // Attempt local API first
    const response = await fetch(`http://localhost:3000/api/puppeteer/search?q=${encodeURIComponent(searchQuery)}&engine=google&format=text`, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }

    const textContent = await response.text();
    return `Source: Global Search Engine\n\nData:\n${textContent.replace(/\s+/g, ' ').substring(0, 8000)}`;
  } catch (error) {
    // FALLBACK
    console.log(theme.dim(`Error: Method 1 failed (${error.message}). Initiating Fallback...`));
    return await duckduckSearchFallback(searchQuery);
  }
}
