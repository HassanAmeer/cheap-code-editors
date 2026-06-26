import { runTerminalCommand } from './terminal.mjs';

/**
 * Execute a codegraph CLI command securely.
 */
export async function queryCodegraph(searchQuery, cwdRelative = '.') {
  return await runTerminalCommand(`npx codegraph query "${searchQuery.replace(/"/g, '\\"')}"`, cwdRelative);
}

export async function exploreCodegraph(exploreQuery, cwdRelative = '.') {
  return await runTerminalCommand(`npx codegraph explore "${exploreQuery.replace(/"/g, '\\"')}"`, cwdRelative);
}

export async function viewCodegraphNode(nodeName, cwdRelative = '.') {
  return await runTerminalCommand(`npx codegraph node "${nodeName.replace(/"/g, '\\"')}"`, cwdRelative);
}

export async function initCodegraph(cwdRelative = '.') {
  return await runTerminalCommand(`npx codegraph init`, cwdRelative);
}
