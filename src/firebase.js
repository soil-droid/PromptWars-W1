/**
 * @file firebase.js
 * @description Handles all Google Firebase service integrations:
 *              Anonymous Authentication, Realtime Database (leaderboard + sessions),
 *              and Analytics event tracking. Authentication gates all write operations.
 * @module firebase
 */

// ─── Imports ──────────────────────────────────────────────────────────────────
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getDatabase, ref, push, onValue, query, orderByChild, limitToLast, set,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getAnalytics, logEvent } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const LEADERBOARD_LIMIT = 10;
const MAX_NAME_LENGTH = 20;
const BOARD_SIZE = '16x16';
const MINE_COUNT = 40;

// ─── Structured Logger ────────────────────────────────────────────────────────
const DEBUG = false;
const log = (...args) => DEBUG && console.log('[Firebase]', ...args);
const warn = (...args) => console.warn('[Firebase]', ...args);
const error = (...args) => console.error('[Firebase]', ...args);

// ─── Module State ─────────────────────────────────────────────────────────────
let db = null;
let auth = null;
let analytics = null;
let currentUser = null;
let leaderboardListenerActive = false;

// ─── Initialisation ───────────────────────────────────────────────────────────

/**
 * Initialises Firebase app, sets up anonymous authentication, Realtime Database
 * listeners, and Analytics. Auth state gates all leaderboard write operations.
 * @returns {void}
 */
export function initFirebase() {
  try {
    const app = initializeApp(CONFIG.FIREBASE_CONFIG);
    db = getDatabase(app);
    auth = getAuth(app);
    analytics = getAnalytics(app);

    // Set up auth state listener — gates all write operations
    onAuthStateChanged(auth, (user) => {
      if (user) {
        currentUser = user;
        log('Auth ready, uid:', user.uid);
        logEvent(analytics, 'login', { method: 'anonymous' });
        _loadLeaderboard();
      } else {
        currentUser = null;
        warn('Auth user signed out — writes disabled');
      }
    });

    // Sign in anonymously on init
    signInAnonymously(auth).catch((err) => {
      error('Anonymous sign-in failed:', err.message);
    });

    logEvent(analytics, 'app_loaded');
  } catch (err) {
    error('Firebase init failed:', err.message);
  }
}

// ─── Session Tracking ─────────────────────────────────────────────────────────

/**
 * Writes a session entry to the `sessions` node when a game starts.
 * Requires an authenticated user — silently skips if not authenticated.
 * @returns {void}
 */
export function trackSession() {
  if (!db || !currentUser) return;
  try {
    const sessionRef = push(ref(db, 'sessions'));
    set(sessionRef, {
      uid: currentUser.uid,
      timestamp: Date.now(),
      boardSize: BOARD_SIZE,
      mines: MINE_COUNT,
    });
    log('Session recorded');
  } catch (err) {
    error('Session write failed:', err.message);
  }
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

/**
 * Saves a winning score to the Firebase leaderboard.
 * Attaches the anonymous UID to the entry. Write is gated on auth state.
 * @param {string} name - The player's display name (max 20 chars, HTML-escaped).
 * @param {number} timeSeconds - Total game duration in seconds.
 * @param {number} oracleCalls - Number of Oracle consultations made.
 * @returns {void}
 */
export function saveScore(name, timeSeconds, oracleCalls) {
  if (!db) { warn('saveScore: db not ready'); return; }
  if (!currentUser) { warn('saveScore: no auth user — write skipped'); return; }
  if (typeof name !== 'string') throw new TypeError('name must be a string');
  if (typeof timeSeconds !== 'number' || timeSeconds < 0) throw new RangeError('timeSeconds must be a non-negative number');
  if (typeof oracleCalls !== 'number' || oracleCalls < 0) throw new RangeError('oracleCalls must be a non-negative number');

  const sanitized = String(name).slice(0, MAX_NAME_LENGTH).replace(/[<>]/g, '');
  try {
    push(ref(db, 'leaderboard'), {
      name: sanitized,
      time: timeSeconds,
      uid: currentUser.uid,
      oracleCalls,
      timestamp: Date.now(),
    });
    logEvent(analytics, 'game_won', {
      time_seconds: timeSeconds,
      oracle_calls: oracleCalls,
    });
    log('Score saved for uid:', currentUser.uid);
  } catch (err) {
    error('saveScore failed:', err.message);
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * Dispatches a named analytics event with optional parameters.
 * @param {string} eventName - The Firebase Analytics event name.
 * @param {Object} [params={}] - Key-value pairs to attach to the event.
 * @returns {void}
 */
export function trackEvent(eventName, params = {}) {
  if (!analytics) return;
  if (typeof eventName !== 'string' || !eventName) throw new TypeError('eventName must be a non-empty string');
  try {
    logEvent(analytics, eventName, params);
    log(`Event tracked: ${eventName}`, params);
  } catch (err) {
    error(`trackEvent(${eventName}) failed:`, err.message);
  }
}

// ─── Private: Leaderboard Listener ────────────────────────────────────────────

/**
 * Attaches a real-time `onValue` listener to the leaderboard node.
 * Updates the UI panel live whenever new scores arrive.
 * Sets the "Live" badge once the listener is active.
 * @returns {void}
 */
function _loadLeaderboard() {
  if (!db) return;
  const top10 = query(
    ref(db, 'leaderboard'),
    orderByChild('time'),
    limitToLast(LEADERBOARD_LIMIT),
  );

  onValue(top10, (snapshot) => {
    const scores = [];
    snapshot.forEach((child) => scores.push(child.val()));
    scores.sort((a, b) => a.time - b.time);
    _renderLeaderboard(scores);

    // Activate "Live" badge on first successful data receipt
    if (!leaderboardListenerActive) {
      leaderboardListenerActive = true;
      _setLiveBadge(true);
    }
  }, (err) => {
    error('Leaderboard listener error:', err.message);
  });
}

/**
 * Renders the sorted leaderboard entries into the DOM panel.
 * @param {Array<{name: string, time: number, oracleCalls: number}>} scores - Sorted score array.
 * @returns {void}
 */
function _renderLeaderboard(scores) {
  const el = document.getElementById('leaderboard-list');
  if (!el) return;

  if (scores.length === 0) {
    el.innerHTML = '<div style="font-size:12px;color:#64748b;text-align:center;padding:8px">No scores yet — be the first!</div>';
    return;
  }

  el.innerHTML = scores.map((s, i) =>
    `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px">
      <span>${i + 1}. ${s.name}</span>
      <span>${s.time}s · ${s.oracleCalls} hints</span>
    </div>`,
  ).join('');
}

/**
 * Shows or hides the "Live" badge next to the leaderboard panel title.
 * @param {boolean} active - Whether the live listener is connected.
 * @returns {void}
 */
function _setLiveBadge(active) {
  const badge = document.getElementById('leaderboard-live-badge');
  if (badge) badge.style.display = active ? 'inline-block' : 'none';
}
