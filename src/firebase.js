// ═══════════════════════════════════════════════════════════
// firebase.js — Leaderboard (localStorage stub)
// ═══════════════════════════════════════════════════════════

const Leaderboard = (() => {
  'use strict';

  const STORAGE_KEY = 'minesweeper_oracle_leaderboard';
  const MAX_ENTRIES = 20;

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function _save(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      console.warn('[Leaderboard] Could not save to localStorage');
    }
  }

  /**
   * Get all leaderboard scores sorted by time ascending
   * @returns {Array<{name, time, oracleUses, date}>}
   */
  function getScores() {
    return _load().sort((a, b) => a.time - b.time);
  }

  /**
   * Save a new score
   * @param {{name: string, time: number, oracleUses: number}} entry
   */
  function saveScore(entry) {
    const scores = _load();
    scores.push({
      name: entry.name || 'Anonymous',
      time: entry.time,
      oracleUses: entry.oracleUses || 0,
      date: new Date().toISOString()
    });

    // Keep only top MAX_ENTRIES
    scores.sort((a, b) => a.time - b.time);
    if (scores.length > MAX_ENTRIES) {
      scores.length = MAX_ENTRIES;
    }

    _save(scores);
    return scores;
  }

  /**
   * Clear all leaderboard data
   */
  function clearScores() {
    _save([]);
  }

  return { getScores, saveScore, clearScores };
})();
