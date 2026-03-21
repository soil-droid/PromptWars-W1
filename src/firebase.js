// ═══════════════════════════════════════════════════════════
// firebase.js — Leaderboard (Firestore with localStorage fallback)
// ═══════════════════════════════════════════════════════════

import { initializeApp } from 'https://esm.run/firebase@10.8.0/app';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from 'https://esm.run/firebase@10.8.0/firestore';

const STORAGE_KEY = 'minesweeper_oracle_leaderboard';
const MAX_ENTRIES = 20;

let db = null;

// Attempt to initialize Firebase if config is present globally
if (typeof window !== 'undefined' && window.FIREBASE_CONFIG) {
  try {
    const app = initializeApp(window.FIREBASE_CONFIG);
    db = getFirestore(app);
    console.info('[Firebase] SDK Initialized. Using Firestore for leaderboard.');
  } catch (err) {
    console.warn('[Firebase] Initialization failed, falling back to localStorage.', err);
  }
}

// ── Fallback Methods ─────────────────────────────────────

/**
 * Loads entries from localStorage.
 * @returns {Array<Object>} List of leaderboard entries.
 */
function _loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves entries to localStorage.
 * @param {Array<Object>} entries - List of entries to save.
 */
function _saveLocal(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    console.warn('[Leaderboard] Could not save to localStorage');
  }
}

// ── Public API ───────────────────────────────────────────

/**
 * Get all leaderboard scores sorted by time ascending.
 * Uses Firestore if available, otherwise localStorage.
 * @returns {Promise<Array<{name: string, time: number, oracleUses: number, date: string}>>}
 */
export async function getScores() {
  if (db) {
    try {
      const q = query(collection(db, 'leaderboard'), orderBy('time', 'asc'), limit(MAX_ENTRIES));
      const snapshot = await getDocs(q);
      const scores = [];
      snapshot.forEach(doc => scores.push(doc.data()));
      return scores;
    } catch (err) {
      console.error('[Firebase] Error fetching scores', err);
      // Fallback on error
      return _loadLocal().sort((a, b) => a.time - b.time);
    }
  }
  
  // Local storage path
  return _loadLocal().sort((a, b) => a.time - b.time);
}

/**
 * Save a new score to the leaderboard.
 * @param {{name: string, time: number, oracleUses: number}} entry - The score to save.
 * @returns {Promise<Array<Object>>} The updated scores list.
 */
export async function saveScore(entry) {
  const newEntry = {
    name: entry.name || 'Anonymous',
    time: entry.time,
    oracleUses: entry.oracleUses || 0,
    date: new Date().toISOString()
  };

  if (db) {
    try {
      await addDoc(collection(db, 'leaderboard'), newEntry);
      return getScores();
    } catch (err) {
      console.error('[Firebase] Error saving score', err);
    }
  }

  // Local storage path
  const scores = _loadLocal();
  scores.push(newEntry);
  scores.sort((a, b) => a.time - b.time);
  if (scores.length > MAX_ENTRIES) {
    scores.length = MAX_ENTRIES;
  }
  _saveLocal(scores);
  return scores;
}

/**
 * Clear all local leaderboard data. Note: does not clear Firestore.
 */
export function clearScores() {
  _saveLocal([]);
}
