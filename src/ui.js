// ═══════════════════════════════════════════════════════════
// ui.js — DOM Rendering, Accessibility & Game Controller
// ═══════════════════════════════════════════════════════════

import * as MinesweeperGame from './game.js';
import * as GeminiOracle from './gemini.js';
import * as Leaderboard from './firebase.js';

// ── Configuration ──────────────────────────────────────
  const ROWS = 16;
  const COLS = 16;
  const MINES = 40;

  // ── State ──────────────────────────────────────────────
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

  // ── Color Helpers ──────────────────────────────────────

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

  // ── DOM References ─────────────────────────────────────

  let boardEl, mineCountEl, timerEl, oracleCountEl, confidenceEl;
  let reasoningEl, heatmapBtn, askOracleBtn, gameOverOverlay;
  let narrationEl, statusEl;

  // ── Initialise ─────────────────────────────────────────

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

    newGame();
  }

  // ── New Game ───────────────────────────────────────────

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

  // ── Timer ──────────────────────────────────────────────

  function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
      seconds++;
      const m = String(Math.floor(seconds / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      timerEl.textContent = `${m}:${s}`;
    }, 1000);
  }

  // ── Mine Counter ───────────────────────────────────────

  function updateMineCounter() {
    const flags = MinesweeperGame.countFlags(board);
    mineCountEl.textContent = String(MINES - flags).padStart(3, '0');
  }

  // ── Render Board ───────────────────────────────────────

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

  function refreshCell(r, c) {
    const td = document.getElementById(`cell-${r}-${c}`);
    if (td) updateCellDOM(td, board[r][c]);
  }

  function refreshAllCells() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        refreshCell(r, c);
      }
    }
  }

  // ── Cell Click Handling ────────────────────────────────

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

  function handleReveal(r, c) {
    if (gameOver || board[r][c].revealed || board[r][c].flagged) return;

    if (firstClick) {
      // Generate real board with safe zone around first click
      board = MinesweeperGame.generateBoard(ROWS, COLS, MINES, { row: r, col: c });
      firstClick = false;
      gameStarted = true;
      startTimer();
    }

    const result = MinesweeperGame.revealCell(board, r, c);

    if (result.hitMine) {
      endGame(false, { row: r, col: c });
      return;
    }

    // Refresh revealed cells with staggered animation
    result.revealedCells.forEach((cell, i) => {
      setTimeout(() => {
        const td = document.getElementById(`cell-${cell.row}-${cell.col}`);
        if (td) {
          td.classList.add('revealing');
          updateCellDOM(td, board[cell.row][cell.col]);
          setTimeout(() => td.classList.remove('revealing'), 300);
        }
      }, i * 15);
    });

    if (MinesweeperGame.isBoardSolved(board)) {
      endGame(true);
      return;
    }

    // Trigger Gemini analysis
    triggerAnalysis();
  }

  function handleFlag(r, c) {
    if (gameOver || board[r][c].revealed) return;
    MinesweeperGame.toggleFlag(board, r, c);
    refreshCell(r, c);
    updateMineCounter();
  }

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

  // ── Keyboard Navigation ────────────────────────────────

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

  // ── Gemini Analysis ────────────────────────────────────

  async function triggerAnalysis() {
    if (!GeminiOracle.isApiConfigured() || isAnalyzing) return;

    isAnalyzing = true;
    statusEl.textContent = '🟡 Analyzing…';

    const minesRemaining = MINES - MinesweeperGame.countFlags(board);
    const boardState = MinesweeperGame.boardToAPIFormat(board, minesRemaining);

    const result = await GeminiOracle.analyzeBoardProbabilities(boardState);

    isAnalyzing = false;
    oracleCountEl.textContent = GeminiOracle.getApiCallCount();
    
    // Log oracle consult event
    Leaderboard.logEvent('oracle_consulted', { board_progress: countRevealed() });

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

  // ── Heatmap Toggle ─────────────────────────────────────

  function toggleHeatmap() {
    heatmapVisible = !heatmapVisible;
    heatmapBtn.textContent = heatmapVisible ? '🔮 Hide Oracle Vision' : '🔮 Show Oracle Vision';
    heatmapBtn.setAttribute('aria-pressed', heatmapVisible);
    refreshAllCells();
  }

  // ── Ask Oracle ─────────────────────────────────────────

  async function askOracle() {
    if (!GeminiOracle.isApiConfigured() || gameOver || !gameStarted) return;

    askOracleBtn.disabled = true;
    askOracleBtn.textContent = '⏳ Thinking…';

    const minesRemaining = MINES - MinesweeperGame.countFlags(board);
    const boardState = MinesweeperGame.boardToAPIFormat(board, minesRemaining);
    const stats = { timeElapsed: seconds, flagsPlaced: MinesweeperGame.countFlags(board) };

    // Log hint requested
    Leaderboard.logEvent('hint_requested', { mines_remaining: minesRemaining });

    const hint = await GeminiOracle.getStrategicHint(boardState, stats);

    askOracleBtn.disabled = false;
    askOracleBtn.textContent = '💡 Ask Oracle';

    if (hint) {
      reasoningEl.textContent = `💡 ${hint.action.toUpperCase()} (${hint.row + 1},${hint.col + 1}): ${hint.reasoning}`;

      // Highlight the suggested cell
      const td = document.getElementById(`cell-${hint.row}-${hint.col}`);
      if (td) {
        td.classList.add('hint-pulse');
        setTimeout(() => td.classList.remove('hint-pulse'), 2000);
      }

      oracleCountEl.textContent = GeminiOracle.getApiCallCount();
    } else {
      reasoningEl.textContent = 'Oracle could not determine a move.';
    }
  }

  // ── Game Over ──────────────────────────────────────────

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
      
      // Log game lost event
      Leaderboard.logEvent('game_lost', { cells_revealed: countRevealed() });
    }

    // Show overlay
    const titleEl = document.getElementById('game-over-title');
    const subtitleEl = document.getElementById('game-over-subtitle');

    if (won) {
      titleEl.textContent = '🏆 Victory!';
      titleEl.style.color = '#1D9E75';
      subtitleEl.textContent = `Minefield cleared in ${timerEl.textContent}`;
      narrationEl.textContent = '';
      
      // Log game won event
      Leaderboard.logEvent('game_won', { time_seconds: seconds, oracle_calls: GeminiOracle.getApiCallCount() });

      // Save to leaderboard
      const rawName = prompt('Enter your name for the leaderboard:', 'Player');
      if (rawName) {
        // Strict HTML Sanitization to prevent Stored XSS
        const name = rawName.replace(/[<>&"']/g, (c) => {
          return {'<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;'}[c];
        }).substring(0, 30);

        Leaderboard.saveScore({
          name,
          time: seconds,
          oracleUses: GeminiOracle.getApiCallCount()
        });
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

    setTimeout(() => gameOverOverlay.classList.add('visible'), 300);
  }

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
