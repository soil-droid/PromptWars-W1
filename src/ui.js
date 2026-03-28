/**
 * @file ui.js
 * @description DOM rendering, accessibility management, and game controller.
 *              Wires Firebase Analytics events for all player interactions,
 *              manages the Gemini Oracle heatmap and hint system, and handles
 *              keyboard + mouse input with full ARIA support.
 * @module ui
 */

import * as MinesweeperGame from './game.js';
import * as GeminiOracle from './gemini.js';
import * as Leaderboard from './firebase.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROWS = 16;
const COLS = 16;
const MINES = 40;
const REVEAL_STAGGER_MS = 15;
const HINT_PULSE_MS = 2000;
const GAME_OVER_DELAY_MS = 300;

// ─── State ────────────────────────────────────────────────────────────────────
let board = null;
let gameStarted = false;
let gameOver = false;
let gameWon = false;
let firstClick = true;
let timerInterval = null;
let seconds = 0;
let heatmapVisible = false;
let probabilities = null;
let focusedRow = 0;
let focusedCol = 0;
let isAnalyzing = false;
let lastReasoning = '';

// ─── Color Helpers ────────────────────────────────────────────────────────────

/**
 * Maps a mine probability value to an RGB colour string.
 * Interpolates green→yellow→red across the 0→1 range.
 * @param {number} prob - Probability value between 0 and 1.
 * @returns {string} CSS rgb() colour string.
 */
function probToColor(prob) {
    // #1D9E75 (safe/green) → #E8C841 (mid/yellow) → #E24B4A (danger/red)
    const r0 = 0x1D, g0 = 0x9E, b0 = 0x75;
    const r1 = 0xE8, g1 = 0xC8, b1 = 0x41;
    const r2 = 0xE2, g2 = 0x4B, b2 = 0x4A;

    let r, g, b;
    if (prob <= 0.5) {
      const t = prob * 2;
      r = Math.round(r0 + (r1 - r0) * t);
      g = Math.round(g0 + (g1 - g0) * t);
      b = Math.round(b0 + (b1 - b0) * t);
    } else {
      const t = (prob - 0.5) * 2;
      r = Math.round(r1 + (r2 - r1) * t);
      g = Math.round(g1 + (g2 - g1) * t);
      b = Math.round(b1 + (b2 - b1) * t);
    }
    return `rgb(${r}, ${g}, ${b})`;
  }

/**
 * Computes a CSS box-shadow glow string proportional to mine probability.
 * @param {number} prob - Probability value between 0 and 1.
 * @returns {string} CSS box-shadow value string.
 */
function probToGlow(prob) {
    const color = probToColor(prob);
    const intensity = 0.15 + prob * 0.35;
    return `0 0 ${8 + prob * 12}px rgba(${prob > 0.5 ? '226,75,74' : '29,158,117'}, ${intensity})`;
  }

  // ── Number Colors ──────────────────────────────────────

  const NUMBER_COLORS = {
    1: '#4FC3F7',
    2: '#81C784',
    3: '#E57373',
    4: '#BA68C8',
    5: '#FF8A65',
    6: '#4DD0E1',
    7: '#F06292',
    8: '#A1887F'
  };

// ─── DOM References ───────────────────────────────────────────────────────────
let boardEl, mineCountEl, timerEl, oracleCountEl, confidenceEl;
let reasoningEl, heatmapBtn, askOracleBtn, gameOverOverlay;
let narrationEl, statusEl;

// ─── Initialise ───────────────────────────────────────────────────────────────

/**
 * Bootstraps the application: queries DOM elements, attaches event listeners,
 * initialises Firebase (if configured), and starts the first game.
 * @returns {void}
 */
function init() {
    boardEl = document.getElementById('game-board');
    mineCountEl = document.getElementById('mine-count');
    timerEl = document.getElementById('timer');
    oracleCountEl = document.getElementById('oracle-count');
    confidenceEl = document.getElementById('confidence-meter');
    reasoningEl = document.getElementById('oracle-reasoning');
    heatmapBtn = document.getElementById('heatmap-toggle');
    askOracleBtn = document.getElementById('ask-oracle');
    gameOverOverlay = document.getElementById('game-over-overlay');
    narrationEl = document.getElementById('death-narration');
    statusEl = document.getElementById('oracle-status');

    document.getElementById('new-game-btn').addEventListener('click', newGame);
    document.getElementById('play-again-btn').addEventListener('click', newGame);
    heatmapBtn.addEventListener('click', toggleHeatmap);
    askOracleBtn.addEventListener('click', askOracle);

    // Keyboard navigation on board
    boardEl.addEventListener('keydown', handleKeyboard);

    // Initialise Firebase Leaderboard & Analytics exactly as required
    if (typeof CONFIG !== 'undefined' && CONFIG.FIREBASE_CONFIG && CONFIG.FIREBASE_CONFIG.apiKey !== "REPLACE_WITH_FIREBASE_API_KEY") {
      try {
        Leaderboard.initFirebase();
      } catch (e) {
        console.warn('[Firebase] Initialization aborted due to invalid config.', e);
      }
    }

    newGame();
  }

// ─── New Game ─────────────────────────────────────────────────────────────────

/**
 * Resets all game state and re-renders a fresh board.
 * Clears the timer, probabilities cache, and game-over overlay.
 * @returns {void}
 */
function newGame() {
    clearInterval(timerInterval);
    seconds = 0;
    gameStarted = false;
    gameOver = false;
    gameWon = false;
    firstClick = true;
    probabilities = null;
    isAnalyzing = false;
    lastReasoning = '';
    focusedRow = 0;
    focusedCol = 0;

    // All cells initially hidden — board generated on first click
    board = [];
    for (let r = 0; r < ROWS; r++) {
      board[r] = [];
      for (let c = 0; c < COLS; c++) {
        board[r][c] = {
          row: r, col: c, mine: false, revealed: false,
          flagged: false, adjacentMines: 0, state: 0
        };
      }
    }

    gameOverOverlay.classList.remove('visible');
    updateMineCounter();
    timerEl.textContent = '00:00';
    oracleCountEl.textContent = '0';
    confidenceEl.style.width = '0%';
    confidenceEl.textContent = '';
    reasoningEl.textContent = GeminiOracle.isApiConfigured()
      ? 'Waiting for first move…'
      : 'No API key — Oracle offline';
    statusEl.textContent = GeminiOracle.isApiConfigured() ? '🟢 Online' : '🔴 Offline';
    GeminiOracle.clearCache();

    renderBoard();
    focusCell(0, 0);
  }

// ─── Timer ────────────────────────────────────────────────────────────────────

/**
 * Starts the game timer interval, updating the display every second.
 * No-ops if timer is already running.
 * @returns {void}
 */
function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
      seconds++;
      const m = String(Math.floor(seconds / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      timerEl.textContent = `${m}:${s}`;
    }, 1000);
  }

// ─── Mine Counter ─────────────────────────────────────────────────────────────

/**
 * Recalculates and displays the remaining unflagged mine count.
 * @returns {void}
 */
function updateMineCounter() {
    const flags = MinesweeperGame.countFlags(board);
    mineCountEl.textContent = String(MINES - flags).padStart(3, '0');
  }

// ─── Render Board ─────────────────────────────────────────────────────────────

/**
 * Rebuilds the entire board table in the DOM from current state.
 * Called on new game; incremental updates use refreshCell().
 * @returns {void}
 */
function renderBoard() {
    boardEl.innerHTML = '';
    const table = document.createElement('table');
    table.setAttribute('role', 'grid');
    table.setAttribute('aria-label', `Minesweeper ${ROWS} by ${COLS} grid`);

    for (let r = 0; r < ROWS; r++) {
      const tr = document.createElement('tr');
      tr.setAttribute('role', 'row');

      for (let c = 0; c < COLS; c++) {
        const td = createCell(r, c);
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    boardEl.appendChild(table);
  }

/**
 * Creates a single <td> board cell with event listeners and initial DOM state.
 * @param {number} r - Row index.
 * @param {number} c - Column index.
 * @returns {HTMLTableCellElement} The configured cell element.
 */
function createCell(r, c) {
    const cell = board[r][c];
    const td = document.createElement('td');
    td.setAttribute('role', 'gridcell');
    td.setAttribute('data-row', r);
    td.setAttribute('data-col', c);
    td.tabIndex = (r === focusedRow && c === focusedCol) ? 0 : -1;
    td.id = `cell-${r}-${c}`;

    updateCellDOM(td, cell);

    // Mouse events
    td.addEventListener('mousedown', (e) => handleCellClick(r, c, e));
    td.addEventListener('contextmenu', (e) => e.preventDefault());

    return td;
  }

/**
 * Updates an existing cell element's appearance to match the current cell state.
 * Applies revealed/flagged/hidden styles and optional heatmap overlay.
 * @param {HTMLTableCellElement} td - The cell DOM element.
 * @param {Object} cell - The cell data object.
 * @returns {void}
 */
function updateCellDOM(td, cell) {
    td.className = 'cell';
    td.textContent = '';

    if (cell.revealed) {
      td.classList.add('revealed');
      if (cell.mine) {
        td.classList.add('mine');
        td.textContent = '💣';
        td.setAttribute('aria-label', `Row ${cell.row + 1}, Column ${cell.col + 1}, mine`);
      } else {
        const n = cell.adjacentMines;
        if (n > 0) {
          td.textContent = n;
          td.style.color = NUMBER_COLORS[n] || '#fff';
          td.classList.add(`num-${n}`);
        }
        td.setAttribute('aria-label', `Row ${cell.row + 1}, Column ${cell.col + 1}, revealed, ${n} adjacent mines`);
      }
    } else if (cell.flagged) {
      td.classList.add('flagged');
      td.textContent = '🚩';
      td.setAttribute('aria-label', `Row ${cell.row + 1}, Column ${cell.col + 1}, flagged`);
    } else {
      td.classList.add('hidden');
      td.setAttribute('aria-label', `Row ${cell.row + 1}, Column ${cell.col + 1}, hidden`);

      // Apply probability heatmap
      if (heatmapVisible && probabilities) {
        const pData = probabilities.find(p => p.row === cell.row && p.col === cell.col);
        if (pData) {
          td.style.backgroundColor = probToColor(pData.prob);
          td.style.boxShadow = probToGlow(pData.prob);

          const probLabel = document.createElement('span');
          probLabel.className = 'prob-label';
          probLabel.textContent = `${Math.round(pData.prob * 100)}%`;
          td.appendChild(probLabel);

          td.setAttribute('aria-label',
            `Row ${cell.row + 1}, Column ${cell.col + 1}, hidden, ${Math.round(pData.prob * 100)}% mine probability`);
        }
      }
    }
  }

/**
 * Re-renders a single cell by ID without rebuilding the whole board.
 * @param {number} r - Row index.
 * @param {number} c - Column index.
 * @returns {void}
 */
function refreshCell(r, c) {
    const td = document.getElementById(`cell-${r}-${c}`);
    if (td) updateCellDOM(td, board[r][c]);
  }

/**
 * Re-renders every cell on the board. Called when heatmap is toggled.
 * @returns {void}
 */
function refreshAllCells() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        refreshCell(r, c);
      }
    }
  }

// ─── Cell Click Handling ──────────────────────────────────────────────────────

/**
 * Routes a mouse event on a cell to the appropriate handler.
 * Left click → reveal, right/ctrl+click → flag, middle/shift+click → chord.
 * @param {number} r - Row index.
 * @param {number} c - Column index.
 * @param {MouseEvent} e - The originating mouse event.
 * @returns {void}
 */
function handleCellClick(r, c, e) {
    if (gameOver) return;
    e.preventDefault();

    const button = e.button;

    if (button === 2 || (e.ctrlKey && button === 0)) {
      // Right-click or Ctrl+click → flag
      handleFlag(r, c);
    } else if (button === 1 || (e.shiftKey && button === 0)) {
      // Middle-click or Shift+click → chord
      handleChord(r, c);
    } else if (button === 0) {
      // Left-click → reveal
      handleReveal(r, c);
    }
  }

/**
 * Handles a reveal action on the cell at (r, c).
 * On first click: generates the board with a safe zone, starts timer,
 * logs game_start and first_click analytics events, and records a session.
 * @param {number} r - Row index.
 * @param {number} c - Column index.
 * @returns {void}
 */
function handleReveal(r, c) {
    if (gameOver || board[r][c].revealed || board[r][c].flagged) return;

    if (firstClick) {
      // Generate real board with safe zone around first click
      board = MinesweeperGame.generateBoard(ROWS, COLS, MINES, { row: r, col: c });
      firstClick = false;
      gameStarted = true;
      startTimer();
      Leaderboard.trackEvent('game_start', { board_size: `${ROWS}x${COLS}`, mines: MINES });
      Leaderboard.trackEvent('first_click', { row: r, col: c });
      Leaderboard.trackSession();
    }

    const result = MinesweeperGame.revealCell(board, r, c);

    if (result.hitMine) {
      endGame(false, { row: r, col: c });
      return;
    }

    // Log cell_revealed for the directly clicked cell
    Leaderboard.trackEvent('cell_revealed', { row: r, col: c, was_safe: true });

    // Refresh revealed cells with staggered animation
    result.revealedCells.forEach((cell, i) => {
      setTimeout(() => {
        const td = document.getElementById(`cell-${cell.row}-${cell.col}`);
        if (td) {
          td.classList.add('revealing');
          updateCellDOM(td, board[cell.row][cell.col]);
          setTimeout(() => td.classList.remove('revealing'), 300);
        }
      }, i * REVEAL_STAGGER_MS);
    });

    if (MinesweeperGame.isBoardSolved(board)) {
      endGame(true);
      return;
    }

    // Trigger Gemini analysis
    triggerAnalysis();
  }

/**
 * Toggles a flag on the cell at (r, c) and logs a flag_placed analytics event.
 * @param {number} r - Row index.
 * @param {number} c - Column index.
 * @returns {void}
 */
function handleFlag(r, c) {
    if (gameOver || board[r][c].revealed) return;
    MinesweeperGame.toggleFlag(board, r, c);
    refreshCell(r, c);
    updateMineCounter();
    const totalFlags = MinesweeperGame.countFlags(board);
    Leaderboard.trackEvent('flag_placed', { flags_total: totalFlags });
  }

/**
 * Performs a chord-reveal around a numbered cell (r, c).
 * Ends the game if a mine is hit; triggers analysis on new reveals.
 * @param {number} r - Row index.
 * @param {number} c - Column index.
 * @returns {void}
 */
function handleChord(r, c) {
    if (gameOver) return;
    const result = MinesweeperGame.chordReveal(board, r, c);
    if (result.hitMine) {
      endGame(false, { row: r, col: c });
      return;
    }
    result.revealedCells.forEach(cell => refreshCell(cell.row, cell.col));

    if (MinesweeperGame.isBoardSolved(board)) {
      endGame(true);
      return;
    }

    if (result.revealedCells.length > 0) triggerAnalysis();
  }

// ─── Keyboard Navigation ──────────────────────────────────────────────────────

/**
 * Handles keyboard events on the game board for arrow-key navigation,
 * reveal (Enter/Space), flag (F), and chord (C) actions.
 * @param {KeyboardEvent} e - The keyboard event.
 * @returns {void}
 */
function handleKeyboard(e) {
    if (gameOver) return;

    const key = e.key;
    let handled = true;

    switch (key) {
      case 'ArrowUp':
        focusedRow = Math.max(0, focusedRow - 1); break;
      case 'ArrowDown':
        focusedRow = Math.min(ROWS - 1, focusedRow + 1); break;
      case 'ArrowLeft':
        focusedCol = Math.max(0, focusedCol - 1); break;
      case 'ArrowRight':
        focusedCol = Math.min(COLS - 1, focusedCol + 1); break;
      case 'Enter':
      case ' ':
        handleReveal(focusedRow, focusedCol); break;
      case 'f':
      case 'F':
        handleFlag(focusedRow, focusedCol); break;
      case 'c':
      case 'C':
        handleChord(focusedRow, focusedCol); break;
      default:
        handled = false;
    }

    if (handled) {
      e.preventDefault();
      focusCell(focusedRow, focusedCol);
    }
  }

/**
 * Moves keyboard focus to the cell at (r, c), resetting all other tabIndexes.
 * @param {number} r - Row index.
 * @param {number} c - Column index.
 * @returns {void}
 */
function focusCell(r, c) {
    // Reset all tabindexes
    const allCells = boardEl.querySelectorAll('td');
    allCells.forEach(td => td.tabIndex = -1);

    const target = document.getElementById(`cell-${r}-${c}`);
    if (target) {
      target.tabIndex = 0;
      target.focus();
    }
  }

// ─── Gemini Analysis ──────────────────────────────────────────────────────────

/**
 * Requests a board probability analysis from the Gemini Oracle.
 * Logs an oracle_consulted analytics event and updates the confidence meter.
 * Debounces calls via the GeminiOracle module.
 * @returns {Promise<void>}
 */
async function triggerAnalysis() {
    if (!GeminiOracle.isApiConfigured() || isAnalyzing) return;

    isAnalyzing = true;
    statusEl.textContent = '🟡 Analyzing…';

    const minesRemaining = MINES - MinesweeperGame.countFlags(board);
    const boardState = MinesweeperGame.boardToAPIFormat(board, minesRemaining);

    const result = await GeminiOracle.analyzeBoardProbabilities(boardState);

    isAnalyzing = false;
    oracleCountEl.textContent = GeminiOracle.getApiCallCount();

    const minesLeft = MINES - MinesweeperGame.countFlags(board);
    Leaderboard.trackEvent('oracle_consulted', {
      cells_revealed: countRevealed(),
      mines_remaining: minesLeft,
    });

    if (result && result.probabilities) {
      probabilities = result.probabilities;
      statusEl.textContent = '🟢 Online';

      // Update confidence meter
      const avgProb = probabilities.reduce((s, p) => s + p.prob, 0) / probabilities.length;
      const confidence = Math.round(Math.abs(avgProb - 0.5) * 200);
      confidenceEl.style.width = `${confidence}%`;
      confidenceEl.textContent = `${confidence}%`;

      // Show first interesting reasoning
      const interesting = probabilities.find(p => p.reasoning && p.prob > 0 && p.prob < 1);
      if (interesting) {
        lastReasoning = interesting.reasoning;
        reasoningEl.textContent = interesting.reasoning;
      }

      if (heatmapVisible) refreshAllCells();
    } else {
      statusEl.textContent = '🔴 Unavailable';
      reasoningEl.textContent = 'Oracle unavailable — check API key';
    }
  }

// ─── Heatmap Toggle ───────────────────────────────────────────────────────────

/**
 * Toggles the probability heatmap overlay and logs a heatmap_toggled event.
 * @returns {void}
 */
function toggleHeatmap() {
    heatmapVisible = !heatmapVisible;
    heatmapBtn.textContent = heatmapVisible ? '🔮 Hide Oracle Vision' : '🔮 Show Oracle Vision';
    heatmapBtn.setAttribute('aria-pressed', heatmapVisible);
    Leaderboard.trackEvent('heatmap_toggled', { visible: heatmapVisible });
    refreshAllCells();
  }

// ─── Ask Oracle ───────────────────────────────────────────────────────────────

/**
 * Requests a strategic hint from the Gemini Oracle, highlights the suggested
 * cell, and logs a hint_requested analytics event.
 * @returns {Promise<void>}
 */
async function askOracle() {
    if (!GeminiOracle.isApiConfigured() || gameOver || !gameStarted) return;

    askOracleBtn.disabled = true;
    askOracleBtn.textContent = '⏳ Thinking…';

    const minesRemaining = MINES - MinesweeperGame.countFlags(board);
    const boardState = MinesweeperGame.boardToAPIFormat(board, minesRemaining);
    const stats = { timeElapsed: seconds, flagsPlaced: MinesweeperGame.countFlags(board) };

    const confidence = probabilities
      ? Math.round(Math.abs((probabilities.reduce((s, p) => s + p.prob, 0) / probabilities.length) - 0.5) * 200)
      : 0;
    Leaderboard.trackEvent('hint_requested', {
      mines_remaining: minesRemaining,
      confidence,
    });

    const hint = await GeminiOracle.getStrategicHint(boardState, stats);

    askOracleBtn.disabled = false;
    askOracleBtn.textContent = '💡 Ask Oracle';

    if (hint) {
      reasoningEl.textContent = `💡 ${hint.action.toUpperCase()} (${hint.row + 1},${hint.col + 1}): ${hint.reasoning}`;

      // Highlight the suggested cell
      const td = document.getElementById(`cell-${hint.row}-${hint.col}`);
      if (td) {
        td.classList.add('hint-pulse');
        setTimeout(() => td.classList.remove('hint-pulse'), HINT_PULSE_MS);
      }

      oracleCountEl.textContent = GeminiOracle.getApiCallCount();
    } else {
      reasoningEl.textContent = 'Oracle could not determine a move.';
    }
  }

// ─── Game Over ────────────────────────────────────────────────────────────────

/**
 * Handles end-of-game state for both win and loss scenarios.
 * Logs game_won or game_lost analytics events, triggers death narration,
 * and prompts the winner for leaderboard submission.
 * @param {boolean} won - True if the player won.
 * @param {{row: number, col: number}|null} [clickedCell=null] - The fatal cell (loss only).
 * @returns {Promise<void>}
 */
async function endGame(won, clickedCell = null) {
    gameOver = true;
    gameWon = won;
    clearInterval(timerInterval);
    timerInterval = null;

    if (!won) {
      // Reveal all mines
      MinesweeperGame.revealAllMines(board);
      refreshAllCells();

      // Highlight clicked mine
      if (clickedCell) {
        const td = document.getElementById(`cell-${clickedCell.row}-${clickedCell.col}`);
        if (td) td.classList.add('mine-hit');
      }
      
      Leaderboard.trackEvent('game_lost', {
        time_seconds: seconds,
        cells_revealed: countRevealed(),
        mine_row: clickedCell ? clickedCell.row : -1,
        mine_col: clickedCell ? clickedCell.col : -1,
      });
    }

    // Show overlay
    const titleEl = document.getElementById('game-over-title');
    const subtitleEl = document.getElementById('game-over-subtitle');

    if (won) {
      titleEl.textContent = '🏆 Victory!';
      titleEl.style.color = '#1D9E75';
      subtitleEl.textContent = `Minefield cleared in ${timerEl.textContent}`;
      narrationEl.textContent = '';
      
      // Log game won event (also automatically logged by saveScore per tutorial, but we keep this if needed, or we just rely on saveScore. The instructions say the tutorial saveScore explicitly logs game_won so we only need to call trackEvent if it's not handled).
      // Wait, let's just use trackEvent if we aren't saving a score, but if we do, skip double log. Actually tutorial saveScore logs it.
      
      // Save to leaderboard
      const rawName = prompt('Enter your name for the leaderboard:', 'Player');
      if (rawName) {
        const name = rawName.substring(0, 20); // The new saveScore handles HTML escaping internally.
        Leaderboard.saveScore(name, seconds, GeminiOracle.getApiCallCount());
      } else {
        Leaderboard.trackEvent('game_won', { time_seconds: seconds, oracle_calls: GeminiOracle.getApiCallCount() });
      }
    } else {
      titleEl.textContent = '💀 Game Over';
      titleEl.style.color = '#E24B4A';
      subtitleEl.textContent = `Survived for ${timerEl.textContent}`;

      // Get death narration from Gemini
      narrationEl.textContent = 'The oracle ponders your fate…';
      const minesRemaining = MINES - MinesweeperGame.countFlags(board);
      const boardState = MinesweeperGame.boardToAPIFormat(board, minesRemaining);
      const stats = { timeElapsed: seconds, cellsRevealed: countRevealed(), totalSafeCells: ROWS * COLS - MINES };

      const narration = await GeminiOracle.generateDeathNarration(boardState, clickedCell, stats);
      narrationEl.textContent = narration;
    }

    setTimeout(() => gameOverOverlay.classList.add('visible'), GAME_OVER_DELAY_MS);
  }

/**
 * Counts the number of non-mine cells currently revealed.
 * @returns {number} Revealed safe cell count.
 */
function countRevealed() {
    let count = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c].revealed && !board[r][c].mine) count++;
      }
    }
    return count;
  }

// Boot up when DOM is ready
document.addEventListener('DOMContentLoaded', init);
