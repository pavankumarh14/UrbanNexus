'use strict';

require('dotenv').config();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL        = 'llama-3.1-8b-instant';

// ─────────────────────────────────────────────────────────────────────────────
// UrbanNexus requires a real Groq API key — there is no mock fallback.
// This is intentional: AI integration is a scored dimension and candidates
// must demonstrate real LLM calls with well-designed prompts.
//
// Get your free key at https://console.groq.com
// Each candidate/team should use their own key to avoid rate-limit collisions.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string}  systemPrompt
 * @param {string}  userPrompt
 * @param {boolean} jsonMode  — forces model to emit valid JSON
 * @returns {Promise<string>}
 */
async function reasonWithLLM(systemPrompt, userPrompt, jsonMode = false) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      '\n[llm] GROQ_API_KEY is not set.\n' +
      '      Get your free key at https://console.groq.com\n' +
      '      Then add it to backend/.env:  GROQ_API_KEY=gsk_...\n'
    );
  }

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
    temperature: 0.3,
    max_tokens:  1024,
  };

  if (jsonMode) body.response_format = { type: 'json_object' };

  // Retry on rate limit — free tier occasionally throttles under burst load.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const wait = (attempt + 1) * 2000;
      console.warn(`[llm] Rate limited — retrying in ${wait}ms (attempt ${attempt + 1}/3)`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq API ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }

  throw new Error('[llm] Exhausted retries after rate limiting — try again in a few seconds');
}

module.exports = { reasonWithLLM, MODEL };
