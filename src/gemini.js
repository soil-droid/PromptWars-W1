// ═══════════════════════════════════════════════════════════
// gemini.js — Google Gemini 2.0 Flash Integration
// ═══════════════════════════════════════════════════════════

const GeminiOracle = (() => {
  'use strict';

  const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  const DEBOUNCE_MS = 800;

  let _apiCallCount = 0;
  let _lastCallTime = 0;
  let _pendingCall = null;
  const _cache = new Map();

  // ── Helpers ────────────────────────────────────────────

  function _getApiKey() {
    return typeof GEMINI_API_KEY !== 'undefined' && GEMINI_API_KEY !== 'YOUR_API_KEY_HERE'
      ? GEMINI_API_KEY
      : null;
  }

  function _hashState(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return hash.toString(36);
  }

  async function _callGemini(userPrompt, systemInstruction) {
    const apiKey = _getApiKey();
    if (!apiKey) return null;

    const body = {
      system_instruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [{
        parts: [{ text: userPrompt }]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096
      }
    };

    try {
      const res = await fetch(`${API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        console.warn('[Gemini] API error:', res.status, res.statusText);
        return null;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;

      _apiCallCount++;
      return text;
    } catch (err) {
      console.warn('[Gemini] Network error:', err.message);
      return null;
    }
  }

  function _extractJSON(text) {
    // Try to extract JSON from markdown code fences or raw text
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();
    try {
      return JSON.parse(jsonStr);
    } catch {
      // Try fixing single quotes
      try {
        return JSON.parse(jsonStr.replace(/'/g, '"'));
      } catch {
        console.warn('[Gemini] Could not parse JSON:', jsonStr.substring(0, 200));
        return null;
      }
    }
  }

  // ── 1. Board Probability Analysis ─────────────────────

  async function analyzeBoardProbabilities(boardState) {
    const hash = _hashState(boardState);

    // Return cached result if identical board state
    if (_cache.has(hash)) {
      return _cache.get(hash);
    }

    // Debounce — cancel pending and schedule new one
    const now = Date.now();
    const timeSinceLast = now - _lastCallTime;

    if (timeSinceLast < DEBOUNCE_MS) {
      return new Promise((resolve) => {
        if (_pendingCall) clearTimeout(_pendingCall);
        _pendingCall = setTimeout(async () => {
          _pendingCall = null;
          const result = await _doAnalyze(boardState, hash);
          resolve(result);
        }, DEBOUNCE_MS - timeSinceLast);
      });
    }

    return _doAnalyze(boardState, hash);
  }

  async function _doAnalyze(boardState, hash) {
    _lastCallTime = Date.now();

    const systemPrompt = `You are a Minesweeper probability expert. Given this board state, calculate the probability (0.0 to 1.0) that each hidden cell contains a mine using constraint satisfaction logic. Return ONLY valid JSON: { "probabilities": [ { "row": N, "col": N, "prob": 0.0-1.0, "reasoning": "one sentence" } ] } for ALL hidden cells. Do not include any text outside the JSON.`;

    const userPrompt = `Analyze this Minesweeper board:\n${JSON.stringify(boardState, null, 2)}`;

    const rawText = await _callGemini(userPrompt, systemPrompt);
    if (!rawText) return null;

    const parsed = _extractJSON(rawText);
    if (!parsed || !Array.isArray(parsed.probabilities)) return null;

    // Validate & clamp probabilities
    const result = {
      probabilities: parsed.probabilities.map(p => ({
        row: parseInt(p.row, 10),
        col: parseInt(p.col, 10),
        prob: Math.max(0, Math.min(1, parseFloat(p.prob) || 0.5)),
        reasoning: String(p.reasoning || '')
      }))
    };

    _cache.set(hash, result);

    // Keep cache from growing unbounded
    if (_cache.size > 50) {
      const firstKey = _cache.keys().next().value;
      _cache.delete(firstKey);
    }

    return result;
  }

  // ── 2. Strategic Hint ─────────────────────────────────

  async function getStrategicHint(boardState, playerStats) {
    const systemPrompt = `You are a Minesweeper strategy advisor. Given the board state and player statistics, recommend the single best move. Return ONLY valid JSON: { "row": N, "col": N, "action": "reveal|flag", "reasoning": "2-3 sentences explaining why this is the best move" }. Do not include any text outside the JSON.`;

    const userPrompt = `Board state:\n${JSON.stringify(boardState, null, 2)}\n\nPlayer stats:\n${JSON.stringify(playerStats, null, 2)}`;

    const rawText = await _callGemini(userPrompt, systemPrompt);
    if (!rawText) return null;

    const parsed = _extractJSON(rawText);
    if (!parsed || typeof parsed.row === 'undefined') return null;

    return {
      row: parseInt(parsed.row, 10),
      col: parseInt(parsed.col, 10),
      action: parsed.action || 'reveal',
      reasoning: String(parsed.reasoning || 'No reasoning available.')
    };
  }

  // ── 3. Death Narration ────────────────────────────────

  async function generateDeathNarration(boardState, clickedCell, gameStats) {
    const systemPrompt = `You are a dramatic narrator for a Minesweeper game. Write exactly 2 sentences narrating the player's defeat in an epic, slightly dark-humoured style. Reference specific game details like how long they played or how close they were to winning. Return ONLY the 2 sentences as plain text, no JSON.`;

    const userPrompt = `The player clicked on cell (row ${clickedCell.row}, col ${clickedCell.col}) and hit a mine!\n\nGame stats: ${JSON.stringify(gameStats)}\n\nBoard state: ${JSON.stringify(boardState)}`;

    const rawText = await _callGemini(userPrompt, systemPrompt);
    return rawText ? rawText.trim() : 'The oracle falls silent. The mines claim another soul.';
  }

  // ── Public API ─────────────────────────────────────────

  function getApiCallCount() { return _apiCallCount; }
  function isApiConfigured() { return !!_getApiKey(); }
  function clearCache() { _cache.clear(); }

  return {
    analyzeBoardProbabilities,
    getStrategicHint,
    generateDeathNarration,
    getApiCallCount,
    isApiConfigured,
    clearCache
  };
})();
