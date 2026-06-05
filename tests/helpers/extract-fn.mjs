// tests/helpers/extract-fn.mjs
// Extract a named `function NAME(...) { ... }` declaration's full source from a
// concatenated browser engine file (engine/world/*.js) so node tests can eval
// the REAL implementation. Engine files are plain IIFE scripts (no ESM exports),
// so we brace-match the declaration text and rebuild it in a sandbox.
import { readFileSync } from 'node:fs';

export function extractFunction(filePath, name) {
  const src = readFileSync(filePath, 'utf8');
  const start = src.search(new RegExp('function\\s+' + name + '\\s*\\('));
  if (start === -1) throw new Error('function not found: ' + name);
  // Skip the parameter list first, so a default like `opts = {}` isn't mistaken
  // for the body's opening brace.
  let p = src.indexOf('(', start);
  if (p === -1) throw new Error('no param list for: ' + name);
  let pd = 0;
  for (; p < src.length; p++) {
    if (src[p] === '(') pd++;
    else if (src[p] === ')') { pd--; if (pd === 0) { p++; break; } }
  }
  // Find the opening brace of the body.
  let i = src.indexOf('{', p);
  if (i === -1) throw new Error('no body brace for: ' + name);
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

// Build a callable from one or more engine functions plus a stub preamble.
// `names` are extracted from filePath and made available to each other; the
// last name is returned as the callable.
export function buildEngineFns(filePath, names, preamble = '') {
  const bodies = names.map(n => extractFunction(filePath, n)).join('\n');
  const factory = new Function(preamble + '\n' + bodies + '\nreturn { ' + names.join(', ') + ' };');
  return factory();
}
