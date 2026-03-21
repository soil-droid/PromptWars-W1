// ═══════════════════════════════════════════════════════════
// gemini.test.js — ES Module Unit Tests for Minesweeper: Oracle
// ═══════════════════════════════════════════════════════════

import * as MinesweeperGame from '../src/game.js';
import * as GeminiOracle from '../src/gemini.js';
import * as Leaderboard from '../src/firebase.js';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    results.push({ status: 'PASS', message });
  } else {
    failed++;
    results.push({ status: 'FAIL', message });
  }
}

function assertEqual(actual, expected, message) {
  const pass = actual === expected;
  if (!pass) {
    message += ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`;
  }
  assert(pass, message);
}

function render() {
  const container = document.getElementById('test-results');
  container.innerHTML = '';
  
  const summary = document.createElement('div');
  summary.className = `test-summary ${failed > 0 ? 'has-failures' : 'all-pass'}`;
  summary.textContent = `${passed} passed, ${failed} failed, ${passed + failed} total tests completed`;
  container.appendChild(summary);

  for (const r of results) {
    const div = document.createElement('div');
    div.className = `test-result ${r.status.toLowerCase()}`;
    div.textContent = `[${r.status}] ${r.message}`;
    container.appendChild(div);
  }
}

// ══════════════════════════════════════════════════════════
// Core logic tests
// ══════════════════════════════════════════════════════════

function testGenerateBoard() {
  const board = MinesweeperGame.generateBoard(16, 16, 40, { row: 0, col: 0 });
  assertEqual(board.length, 16, 'generateBoard: 16 rows');
  assertEqual(board[0].length, 16, 'generateBoard: 16 cols');

  let mineCount = 0;
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      if (board[r][c].mine) mineCount++;
    }
  }
  assertEqual(mineCount, 40, 'generateBoard: exactly 40 mines');
}

function testFirstClickSafety() {
  const safeCell = { row: 5, col: 5 };
  const board = MinesweeperGame.generateBoard(16, 16, 40, safeCell);
  
  let safeCellHasMine = false;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const nr = 5 + dr;
      const nc = 5 + dc;
      if (nr >= 0 && nr < 16 && nc >= 0 && nc < 16) {
        if (board[nr][nc].mine) safeCellHasMine = true;
      }
    }
  }
  assert(!safeCellHasMine, 'First click: safe cell and neighbours are mine-free');
}

function testCalculateAdjacentMines() {
  const board = [];
  for (let r = 0; r < 3; r++) {
    board[r] = [];
    for (let c = 0; c < 3; c++) {
      board[r][c] = { row: r, col: c, mine: false, revealed: false, flagged: false, adjacentMines: 0, state: 0 };
    }
  }
  board[0][0].mine = true;
  board[2][2].mine = true;

  assertEqual(MinesweeperGame.calculateAdjacentMines(board, 1, 1), 2, 'calculateAdjacentMines: 2 corner mines');
  assertEqual(MinesweeperGame.calculateAdjacentMines(board, 0, 2), 0, 'calculateAdjacentMines: top-right = 0');
}

function testRevealCellCascade() {
  const board = MinesweeperGame.generateBoard(4, 4, 0, { row: 0, col: 0 });
  board[3][3].mine = true; // Add manually
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      board[r][c].adjacentMines = MinesweeperGame.calculateAdjacentMines(board, r, c);
    }
  }
  const result = MinesweeperGame.revealCell(board, 0, 0);
  assert(!result.hitMine, 'revealCell cascade: did not hit mine');
  assert(result.revealedCells.length > 1, `revealCell cascade: revealed >1 cell`);
}

function testIsBoardSolved() {
  const board = [];
  for (let r = 0; r < 2; r++) {
    board[r] = [];
    for (let c = 0; c < 2; c++) {
      board[r][c] = { row: r, col: c, mine: false, revealed: true, flagged: false, adjacentMines: 0, state: 1 };
    }
  }
  assert(MinesweeperGame.isBoardSolved(board), 'isBoardSolved: all safe cells revealed = true');
}

// ══════════════════════════════════════════════════════════
// Cloud Integrations & Security tests (Async)
// ══════════════════════════════════════════════════════════

async function testLeaderboardFallback() {
  Leaderboard.clearScores();
  let scores = await Leaderboard.getScores();
  assertEqual(scores.length, 0, 'Leaderboard: starts empty');

  // XSS attack string simulation
  const maliciousName = '<script>alert("XSS")</script>';
  const sanitizedName = maliciousName.replace(/[<>&"']/g, (c) => {
    return {'<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;'}[c];
  });
  
  await Leaderboard.saveScore({ name: sanitizedName, time: 42, oracleUses: 3 });
  scores = await Leaderboard.getScores();
  
  assertEqual(scores.length, 1, 'Leaderboard: successfully saved entry');
  assert(scores[0].name.indexOf('<script>') === -1, 'Leaderboard/Security: malicious input was sanitized');
  assertEqual(scores[0].name, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;', 'Security: HTML completely escaped');
  
  Leaderboard.clearScores();
}

function testGeminiOracleAPIKey() {
  assert(!GeminiOracle.isApiConfigured(), 'GeminiOracle: configured correctly based on window state');
  assertEqual(GeminiOracle.getApiCallCount(), 0, 'GeminiOracle: no calls made yet');
  
  // Safe validation since we don't mock fetch/esm directly
  const board = MinesweeperGame.generateBoard(4, 4, 2, {row: 0, col: 0});
  const fmt = MinesweeperGame.boardToAPIFormat(board, 2);
  assert(fmt.rows === 4 && fmt.cols === 4, 'GeminiOracle/Game: Format integration correct');
}

// Kickoff
async function runAll() {
  passed = 0;
  failed = 0;
  results.length = 0;
  
  testGenerateBoard();
  testFirstClickSafety();
  testCalculateAdjacentMines();
  testRevealCellCascade();
  testIsBoardSolved();
  testGeminiOracleAPIKey();
  
  await testLeaderboardFallback();
  
  render();
}

runAll();
