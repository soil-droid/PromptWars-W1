// ═══════════════════════════════════════════════════════════
// gemini.js — Google Gemini 2.0 Flash Integration
// ═══════════════════════════════════════════════════════════

import { GoogleGenerativeAI } from 'https://cdn.jsdelivr.net/npm/@google/generative-ai/+esm';

const DEBOUNCE_MS = 3000;

let _apiCallCount = 0;
let _lastCallTime = 0;
let _pendingCall = null;
const _cache = new Map();

// ── Helpers ────────────────────────────────────────────

/**
 * Retrieves the Gemini API key from the global object.
 * @returns {string|null} The API key or null if not configured.
 */
function _getApiKey() {
  if (typeof CONFIG === 'undefined' || !CONFIG.GEMINI_API_KEY) return null;
  return CONFIG.GEMINI_API_KEY !== 'REPLACE_WITH_YOUR_GEMINI_API_KEY'
    ? CONFIG.GEMINI_API_KEY
    : null;
}

/**
 * Creates a simple hash of the board state for caching.
 * @param {Object} obj - The object to hash.
 * @returns {string} The computed hash string.
 */
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

/**
 * Helper to call the official Gemini SDK.
 * @param {string} userPrompt - The user prompt.
 * @param {string} systemInstruction - The system instruction.
 * @returns {Promise<string|null>} The generated text.
 */
async function _callGemini(userPrompt, systemInstruction) {
  const apiKey = _getApiKey();
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemInstruction,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
      }
    });

    const result = await model.generateContent(userPrompt);
    const text = result.response.text();
    if (!text) return null;
    
    _apiCallCount++;
    return text;
  } catch (err) {
    console.warn('[Gemini] SDK error:', err.message);
    return null;
  }
}

/**
 * Extracts and parses JSON from markdown fences or raw text.
 * @param {string} text - The raw text from the AI.
 * @returns {Object|null} Parsed JSON or null.
 */
function _extractJSON(text) {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : text.trim();
  try {
    return JSON.parse(jsonStr);
  } catch {
    try {
      return JSON.parse(jsonStr.replace(/'/g, '"'));
    } catch {
      console.warn('[Gemini] Could not parse JSON:', jsonStr.substring(0, 200));
      return null;
    }
  }
}

// ── 1. Board Probability Analysis ─────────────────────

/**
 * Analyzes the board state and returns probabilities for each hidden cell.
 * Features caching and debouncing.
 * @param {Object} boardState - The exact API-formatted board state.
 * @returns {Promise<Object|null>} Resolution with probabilities array.
 */
export async function analyzeBoardProbabilities(boardState) {
  const hash = _hashState(boardState);

  if (_cache.has(hash)) {
    return _cache.get(hash);
  }

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

  const result = {
    probabilities: parsed.probabilities.map(p => ({
      row: parseInt(p.row, 10),
      col: parseInt(p.col, 10),
      prob: Math.max(0, Math.min(1, parseFloat(p.prob) || 0.5)),
      reasoning: String(p.reasoning || '')
    }))
  };

  _cache.set(hash, result);
  if (_cache.size > 50) {
    const firstKey = _cache.keys().next().value;
    _cache.delete(firstKey);
  }

  return result;
}

// ── 2. Strategic Hint ─────────────────────────────────

/**
 * Generates a focused strategic hint for the player.
 * @param {Object} boardState - The current board state.
 * @param {Object} playerStats - Current game stats (time, flags).
 * @returns {Promise<{row: number, col: number, action: string, reasoning: string}|null>} Hint object.
 */
export async function getStrategicHint(boardState, playerStats) {
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

/**
 * Generates a dramatic two-sentence narration when the player hits a mine.
 * @param {Object} boardState - The board state at time of death.
 * @param {Object} clickedCell - The coordinates of the fatal click.
 * @param {Object} gameStats - Time and clearing stats.
 * @returns {Promise<string>} Two-sentence narration text.
 */
export async function generateDeathNarration(boardState, clickedCell, gameStats) {
  const systemPrompt = `You are a dramatic narrator for a Minesweeper game. Write exactly 2 sentences narrating the player's defeat in an epic, slightly dark-humoured style. Reference specific game details like how long they played or how close they were to winning. Return ONLY the 2 sentences as plain text, no JSON.`;
  const userPrompt = `The player clicked on cell (row ${clickedCell.row}, col ${clickedCell.col}) and hit a mine!\n\nGame stats: ${JSON.stringify(gameStats)}\n\nBoard state: ${JSON.stringify(boardState)}`;

  const rawText = await _callGemini(userPrompt, systemPrompt);
  return rawText ? rawText.trim() : 'The oracle falls silent. The mines claim another soul.';
}

// ── Public API ─────────────────────────────────────────

/**
 * Returns the total number of API calls made.
 * @returns {number}
 */
export function getApiCallCount() { return _apiCallCount; }

/**
 * Checks if the API key is configured.
 * @returns {boolean}
 */
export function isApiConfigured() { return !!_getApiKey(); }

/**
 * Clears the internal response cache.
 */
export function clearCache() { _cache.clear(); }
