// ═══════════════════════════════════════════════════════════
// gemini.test.js — Unit Tests for Minesweeper: Oracle
// ═══════════════════════════════════════════════════════════

const TestRunner = (() => {
  'use strict';

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
    const summary = document.createElement('div');
    summary.className = `test-summary ${failed > 0 ? 'has-failures' : 'all-pass'}`;
    summary.textContent = `${passed} passed, ${failed} failed, ${passed + failed} total`;
    container.appendChild(summary);

    for (const r of results) {
      const div = document.createElement('div');
      div.className = `test-result ${r.status.toLowerCase()}`;
      div.textContent = `[${r.status}] ${r.message}`;
      container.appendChild(div);
    }
  }

  // ══════════════════════════════════════════════════════════
  // Test Suite
  // ══════════════════════════════════════════════════════════

  function runAll() {
    testGenerateBoard();
    testFirstClickSafety();
    testCalculateAdjacentMines();
    testRevealCellCascade();
    testRevealCellMine();
    testToggleFlag();
    testChordReveal();
    testIsBoardSolved();
    testBoardToAPIFormat();
    testLeaderboard();
    render();
  }

  // ── generateBoard ──────────────────────────────────────

  function testGenerateBoard() {
    const board = MinesweeperGame.generateBoard(16, 16, 40, { row: 0, col: 0 });

    // Correct dimensions
    assertEqual(board.length, 16, 'generateBoard: 16 rows');
    assertEqual(board[0].length, 16, 'generateBoard: 16 cols');

    // Correct mine count
    let mineCount = 0;
    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 16; c++) {
        if (board[r][c].mine) mineCount++;
      }
    }
    assertEqual(mineCount, 40, 'generateBoard: exactly 40 mines');
  }

  // ── First-click safety ─────────────────────────────────

  function testFirstClickSafety() {
    const safeCell = { row: 5, col: 5 };
    const board = MinesweeperGame.generateBoard(16, 16, 40, safeCell);

    // Safe cell and its neighbours should be mine-free
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

  // ── calculateAdjacentMines ─────────────────────────────

  function testCalculateAdjacentMines() {
    // Create a tiny 3x3 board with known mine positions
    const board = [];
    for (let r = 0; r < 3; r++) {
      board[r] = [];
      for (let c = 0; c < 3; c++) {
        board[r][c] = { row: r, col: c, mine: false, revealed: false, flagged: false, adjacentMines: 0, state: 0 };
      }
    }
    board[0][0].mine = true;
    board[2][2].mine = true;

    const adj = MinesweeperGame.calculateAdjacentMines(board, 1, 1);
    assertEqual(adj, 2, 'calculateAdjacentMines: centre of 3x3 with 2 corner mines = 2');

    const adjCorner = MinesweeperGame.calculateAdjacentMines(board, 0, 2);
    assertEqual(adjCorner, 0, 'calculateAdjacentMines: top-right with no adjacent mines = 0');
  }

  // ── revealCell cascade ─────────────────────────────────

  function testRevealCellCascade() {
    // 4x4 board with 1 mine at (3,3), click (0,0) should cascade most cells
    const board = MinesweeperGame.generateBoard(4, 4, 0, { row: 0, col: 0 });
    // Add one mine manually
    board[3][3].mine = true;
    // Recalculate adjacents
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        board[r][c].adjacentMines = MinesweeperGame.calculateAdjacentMines(board, r, c);
      }
    }

    const result = MinesweeperGame.revealCell(board, 0, 0);
    assert(!result.hitMine, 'revealCell cascade: did not hit mine');
    assert(result.revealedCells.length > 1, `revealCell cascade: revealed ${result.revealedCells.length} cells (expected >1)`);
  }

  // ── revealCell on mine ─────────────────────────────────

  function testRevealCellMine() {
    const board = MinesweeperGame.generateBoard(4, 4, 15, { row: 0, col: 0 });

    // Find a mine cell
    let mineCell = null;
    for (let r = 0; r < 4 && !mineCell; r++) {
      for (let c = 0; c < 4 && !mineCell; c++) {
        if (board[r][c].mine) mineCell = { r, c };
      }
    }

    if (mineCell) {
      const result = MinesweeperGame.revealCell(board, mineCell.r, mineCell.c);
      assert(result.hitMine, 'revealCell mine: hitMine is true');
    } else {
      assert(false, 'revealCell mine: could not find mine cell to test');
    }
  }

  // ── toggleFlag ─────────────────────────────────────────

  function testToggleFlag() {
    const board = MinesweeperGame.generateBoard(4, 4, 2, { row: 0, col: 0 });
    assert(!board[2][2].flagged, 'toggleFlag: initially not flagged');

    MinesweeperGame.toggleFlag(board, 2, 2);
    assert(board[2][2].flagged, 'toggleFlag: flagged after first toggle');

    MinesweeperGame.toggleFlag(board, 2, 2);
    assert(!board[2][2].flagged, 'toggleFlag: unflagged after second toggle');
  }

  // ── chordReveal ────────────────────────────────────────

  function testChordReveal() {
    // Create a board, reveal a numbered cell, flag correct mines, then chord
    const board = [];
    for (let r = 0; r < 3; r++) {
      board[r] = [];
      for (let c = 0; c < 3; c++) {
        board[r][c] = { row: r, col: c, mine: false, revealed: false, flagged: false, adjacentMines: 0, state: 0 };
      }
    }
    board[0][0].mine = true;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        board[r][c].adjacentMines = MinesweeperGame.calculateAdjacentMines(board, r, c);
      }
    }
    // Reveal centre cell (has 1 adjacent mine)
    board[1][1].revealed = true;
    board[1][1].state = MinesweeperGame.CELL_REVEALED;
    // Flag the mine
    board[0][0].flagged = true;
    board[0][0].state = MinesweeperGame.CELL_FLAGGED;

    const result = MinesweeperGame.chordReveal(board, 1, 1);
    assert(!result.hitMine, 'chordReveal: no mine hit with correct flags');
    assert(result.revealedCells.length > 0, `chordReveal: revealed ${result.revealedCells.length} cells`);
  }

  // ── isBoardSolved ──────────────────────────────────────

  function testIsBoardSolved() {
    const board = [];
    for (let r = 0; r < 2; r++) {
      board[r] = [];
      for (let c = 0; c < 2; c++) {
        board[r][c] = { row: r, col: c, mine: false, revealed: true, flagged: false, adjacentMines: 0, state: 1 };
      }
    }

    assert(MinesweeperGame.isBoardSolved(board), 'isBoardSolved: all non-mine cells revealed = true');

    board[0][0].mine = true;
    board[0][0].revealed = false;
    assert(MinesweeperGame.isBoardSolved(board), 'isBoardSolved: only mine unrevealed = true');

    board[1][1].revealed = false;
    assert(!MinesweeperGame.isBoardSolved(board), 'isBoardSolved: non-mine unrevealed = false');
  }

  // ── boardToAPIFormat ───────────────────────────────────

  function testBoardToAPIFormat() {
    const board = [];
    for (let r = 0; r < 2; r++) {
      board[r] = [];
      for (let c = 0; c < 2; c++) {
        board[r][c] = { row: r, col: c, mine: false, revealed: false, flagged: false, adjacentMines: 0, state: 0 };
      }
    }
    board[0][0].revealed = true;
    board[0][0].adjacentMines = 1;
    board[1][1].flagged = true;

    const result = MinesweeperGame.boardToAPIFormat(board, 5);
    assertEqual(result.rows, 2, 'boardToAPIFormat: rows = 2');
    assertEqual(result.cols, 2, 'boardToAPIFormat: cols = 2');
    assertEqual(result.minesRemaining, 5, 'boardToAPIFormat: minesRemaining = 5');
    assertEqual(result.cells.length, 4, 'boardToAPIFormat: 4 cells');

    const revealed = result.cells.find(c => c.row === 0 && c.col === 0);
    assertEqual(revealed.state, 'revealed', 'boardToAPIFormat: revealed cell state');
    assertEqual(revealed.adjacentMines, 1, 'boardToAPIFormat: revealed cell adjacentMines');

    const flagged = result.cells.find(c => c.row === 1 && c.col === 1);
    assertEqual(flagged.state, 'flagged', 'boardToAPIFormat: flagged cell state');
  }

  // ── Leaderboard ────────────────────────────────────────

  function testLeaderboard() {
    Leaderboard.clearScores();
    assertEqual(Leaderboard.getScores().length, 0, 'Leaderboard: starts empty after clear');

    Leaderboard.saveScore({ name: 'Test', time: 42, oracleUses: 3 });
    const scores = Leaderboard.getScores();
    assertEqual(scores.length, 1, 'Leaderboard: 1 entry after save');
    assertEqual(scores[0].name, 'Test', 'Leaderboard: saved name');
    assertEqual(scores[0].time, 42, 'Leaderboard: saved time');

    Leaderboard.clearScores();
  }

  return { runAll };
})();

// Run tests when DOM is ready
document.addEventListener('DOMContentLoaded', TestRunner.runAll);
