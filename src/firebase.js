// ═══════════════════════════════════════════════════════════
// firebase.js — Leaderboard & Analytics (RTDB & Analytics)
// ═══════════════════════════════════════════════════════════

import { initializeApp } from 'https://esm.run/firebase@10.8.0/app';
import { getDatabase, ref, push, onValue, query, orderByChild, limitToFirst } from 'https://esm.run/firebase@10.8.0/database';
import { getAnalytics, logEvent as firebaseLogEvent } from 'https://esm.run/firebase@10.8.0/analytics';

const STORAGE_KEY = 'minesweeper_oracle_leaderboard';
const MAX_ENTRIES = 20;

let db = null;
let analytics = null;
let currentScores = [];
let localSubscribers = [];

// Attempt to initialize Firebase if config is present globally
if (typeof window !== 'undefined' && window.FIREBASE_CONFIG) {
  try {
    const app = initializeApp(window.FIREBASE_CONFIG);
    db = getDatabase(app);
    analytics = getAnalytics(app);
    console.info('[Firebase] SDK Initialized. Using RTDB & Analytics.');

    // Actively read with onValue listener as required
    const topScoresRef = query(ref(db, 'leaderboard'), orderByChild('time'), limitToFirst(MAX_ENTRIES));
    onValue(topScoresRef, (snapshot) => {
      const scores = [];
      snapshot.forEach(childSnapshot => {
        scores.push(childSnapshot.val());
      });
      currentScores = scores;
      localSubscribers.forEach(cb => cb(currentScores));
    });
  } catch (err) {
    console.warn('[Firebase] Initialization failed, falling back to localStorage.', err);
    currentScores = _loadLocal().sort((a, b) => a.time - b.time);
  }
} else {
  currentScores = _loadLocal().sort((a, b) => a.time - b.time);
}

// ── Fallback Methods ─────────────────────────────────────

function _loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function _saveLocal(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    console.warn('[Leaderboard] Could not save to localStorage');
  }
}

// ── Public API ───────────────────────────────────────────

/**
 * Log a custom analytics event.
 * @param {string} eventName - Name of the event.
 * @param {Object} params - Event properties.
 */
export function logEvent(eventName, params = {}) {
  if (analytics) {
    try {
      firebaseLogEvent(analytics, eventName, params);
    } catch (err) {
      console.warn('[Analytics] Failed to log', err);
    }
  } else {
    // Console log if no config present
    console.debug(`[Analytics Stub] ${eventName}`, params);
  }
}

/**
 * Subscribe to realtime leaderboard updates.
 * @param {Function} callback - Called whenever leaderboard changes.
 */
export function subscribeToScores(callback) {
  localSubscribers.push(callback);
  callback(currentScores);
}

/**
 * Get the current synchronous list of scores.
 * @returns {Array<{name: string, time: number, oracleUses: number, date: string}>}
 */
export function getScores() {
  return currentScores;
}

/**
 * Save a new score to the leaderboard.
 * @param {{name: string, time: number, oracleUses: number}} entry - The score to save.
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
      // Writing with push() directly
      await push(ref(db, 'leaderboard'), newEntry);
    } catch (err) {
      console.error('[Firebase] Error saving score', err);
    }
  } else {
    // Local storage path
    const scores = _loadLocal();
    scores.push(newEntry);
    scores.sort((a, b) => a.time - b.time);
    if (scores.length > MAX_ENTRIES) {
      scores.length = MAX_ENTRIES;
    }
    _saveLocal(scores);
    currentScores = scores;
    localSubscribers.forEach(cb => cb(currentScores));
  }
}

/**
 * Clear all local leaderboard data. Note: does not clear Database.
 */
export function clearScores() {
  _saveLocal([]);
  currentScores = [];
  localSubscribers.forEach(cb => cb(currentScores));
}
