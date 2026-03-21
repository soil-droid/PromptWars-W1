import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, push, onValue, query, orderByChild, limitToLast } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { getAnalytics, logEvent } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';

let db, analytics;

export function initFirebase() {
  const app = initializeApp(CONFIG.FIREBASE_CONFIG);
  db = getDatabase(app);
  analytics = getAnalytics(app);
  logEvent(analytics, 'app_loaded');
  loadLeaderboard();
}

export function saveScore(name, timeSeconds, oracleCalls) {
  if (!db) return;
  const sanitized = String(name).slice(0, 20).replace(/[<>]/g, '');
  push(ref(db, 'leaderboard'), {
    name: sanitized,
    time: timeSeconds,
    oracleCalls,
    timestamp: Date.now()
  });
  logEvent(analytics, 'game_won', { time_seconds: timeSeconds, oracle_calls: oracleCalls });
}

export function trackEvent(eventName, params = {}) {
  if (!analytics) return;
  logEvent(analytics, eventName, params);
}

function loadLeaderboard() {
  const top10 = query(ref(db, 'leaderboard'), orderByChild('time'), limitToLast(10));
  onValue(top10, (snapshot) => {
    const scores = [];
    snapshot.forEach(child => scores.push(child.val()));
    scores.sort((a, b) => a.time - b.time);
    renderLeaderboard(scores);
  });
}

function renderLeaderboard(scores) {
  const el = document.getElementById('leaderboard-list');
  if (!el) return;
  el.innerHTML = scores.map((s, i) =>
    `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px">
      <span>${i + 1}. ${s.name}</span>
      <span>${s.time}s · ${s.oracleCalls} hints</span>
    </div>`
  ).join('');
}
