// AI1 — server-side AI generation for paid features. Thin OpenRouter chat client +
// a small allowlist of generation "kinds", each with its own system prompt and Earned
// GOLD cost. The endpoint (ai-generate.mjs) handles auth, metering, and refunds.

export const AI_KINDS = Object.freeze({
  'world-idea': {
    cost: 10,
    maxTokens: 320,
    system: 'You are a concise game design assistant for TinyWorld, a voxel world builder of small floating islands. Given an optional theme, propose ONE imaginative tiny-world concept: a name, a one-line vibe, and 3 concrete things to build (terrain, structures, props). Keep it under 120 words. No markdown headers, no preamble.',
  },
  'world-name': {
    cost: 5,
    maxTokens: 120,
    system: 'You name voxel worlds for TinyWorld. Given an optional theme, return 6 short, evocative world names (2-3 words each), one per line. No numbering, no commentary.',
  },
  'build-tips': {
    cost: 8,
    maxTokens: 300,
    system: 'You are a friendly building coach for TinyWorld (voxel islands). Given what the player is making, give 3 short, practical, specific tips to make it look better. Under 100 words. No preamble.',
  },
});

export function isAiKind(kind) {
  return Object.prototype.hasOwnProperty.call(AI_KINDS, String(kind || ''));
}

export function aiCost(kind) {
  return isAiKind(kind) ? AI_KINDS[kind].cost : 0;
}

// Pure: build the chat messages for a kind + a bounded user seed. Tested in isolation.
export function buildMessages(kind, input) {
  const spec = AI_KINDS[kind];
  const seed = String(input == null ? '' : input).replace(/\s+/g, ' ').trim().slice(0, 280);
  const user = seed ? seed : '(no specific theme — surprise me)';
  return [
    { role: 'system', content: spec.system },
    { role: 'user', content: user },
  ];
}

function aiEnv() {
  return {
    key: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
  };
}

// Call the provider. Returns { ok:true, text } or { ok:false, error }. The caller
// refunds the player's Earned GOLD when ok is false.
export async function generateAi({ kind, input }) {
  if (!isAiKind(kind)) return { ok: false, error: 'invalid-kind' };
  const { key, model } = aiEnv();
  if (!key) return { ok: false, error: 'ai-not-configured' };
  const spec = AI_KINDS[kind];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: buildMessages(kind, input),
        max_tokens: spec.maxTokens,
        temperature: 0.9,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: 'ai-http-' + res.status };
    const data = await res.json();
    const text = String(data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
    if (!text) return { ok: false, error: 'ai-empty' };
    return { ok: true, text: text.slice(0, 4000) };
  } catch (e) {
    return { ok: false, error: (e && e.name === 'AbortError') ? 'ai-timeout' : 'ai-error' };
  } finally {
    clearTimeout(timer);
  }
}
