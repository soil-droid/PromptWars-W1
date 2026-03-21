// ═══════════════════════════════════════════════════════════
// game.js — Core Minesweeper Logic (Pure Functions)
// ═══════════════════════════════════════════════════════════

const MinesweeperGame = (() => {
  'use strict';

  // ── Cell States ────────────────────────────────────────
  const CELL_HIDDEN  = 0;
  const CELL_REVEALED = 1;
  const CELL_FLAGGED = 2;

  // ── Board Generation ───────────────────────────────────

  /**
   * Generate a new board with mines placed randomly.
   * @param {number} rows
   * @param {number} cols
   * @param {number} mineCount
   * @param {{row: number, col: number}} safeCell — guaranteed safe on first click
   * @returns {object[][]} 2D array of cell objects
   */
  function generateBoard(rows, cols, mineCount, safeCell) {
    // Create empty board
    const board = [];
    for (let r = 0; r < rows; r++) {
      board[r] = [];
      for (let c = 0; c < cols; c++) {
        board[r][c] = {
          row: r,
          col: c,
          mine: false,
          revealed: false,
          flagged: false,
          adjacentMines: 0,
          state: CELL_HIDDEN
        };
      }
    }

    // Build list of eligible positions (exclude safe cell + neighbours)
    const safeCells = new Set();
    if (safeCell) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = safeCell.row + dr;
          const nc = safeCell.col + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            safeCells.add(`${nr},${nc}`);
          }
        }
      }
    }

    const eligible = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!safeCells.has(`${r},${c}`)) {
          eligible.push({ r, c });
        }
      }
    }

    // Fisher-Yates shuffle & pick first mineCount
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }

    const actualMineCount = Math.min(mineCount, eligible.length);
    for (let i = 0; i < actualMineCount; i++) {
      board[eligible[i].r][eligible[i].c].mine = true;
    }

    // Pre-compute adjacent mine counts
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        board[r][c].adjacentMines = calculateAdjacentMines(board, r, c);
      }
    }

    return board;
  }

  // ── Adjacent Mine Count ────────────────────────────────

  function calculateAdjacentMines(board, row, col) {
    const rows = board.length;
    const cols = board[0].length;
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) {
          count++;
        }
      }
    }
    return count;
  }

  // ── Reveal Cell (with cascade) ─────────────────────────

  /**
   * Reveal a cell. If adjacentMines === 0, cascade-reveal neighbours.
   * @returns {{ board, revealedCells: {row,col}[], hitMine: boolean }}
   */
  function revealCell(board, row, col) {
    const cell = board[row][col];
    const revealedCells = [];

    if (cell.revealed || cell.flagged) {
      return { board, revealedCells, hitMine: false };
    }

    if (cell.mine) {
      cell.revealed = true;
      cell.state = CELL_REVEALED;
      return { board, revealedCells: [{ row, col }], hitMine: true };
    }

    // BFS cascade
    const queue = [{ row, col }];
    const visited = new Set();
    visited.add(`${row},${col}`);

    while (queue.length > 0) {
      const { row: r, col: c } = queue.shift();
      const current = board[r][c];

      if (current.revealed || current.flagged || current.mine) continue;

      current.revealed = true;
      current.state = CELL_REVEALED;
      revealedCells.push({ row: r, col: c });

      if (current.adjacentMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < board.length && nc >= 0 && nc < board[0].length) {
              const key = `${nr},${nc}`;
              if (!visited.has(key)) {
                visited.add(key);
                queue.push({ row: nr, col: nc });
              }
            }
          }
        }
      }
    }

    return { board, revealedCells, hitMine: false };
  }

  // ── Toggle Flag ────────────────────────────────────────

  function toggleFlag(board, row, col) {
    const cell = board[row][col];
    if (cell.revealed) return board;

    cell.flagged = !cell.flagged;
    cell.state = cell.flagged ? CELL_FLAGGED : CELL_HIDDEN;
    return board;
  }

  // ── Chord Reveal ───────────────────────────────────────

  /**
   * If the revealed cell's number matches the flag count around it,
   * reveal all unflagged hidden neighbours.
   */
  function chordReveal(board, row, col) {
    const cell = board[row][col];
    if (!cell.revealed || cell.adjacentMines === 0) {
      return { board, revealedCells: [], hitMine: false };
    }

    const rows = board.length;
    const cols = board[0].length;
    let flagCount = 0;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].flagged) {
          flagCount++;
        }
      }
    }

    if (flagCount !== cell.adjacentMines) {
      return { board, revealedCells: [], hitMine: false };
    }

    let allRevealed = [];
    let hitMine = false;

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const neighbour = board[nr][nc];
          if (!neighbour.revealed && !neighbour.flagged) {
            const result = revealCell(board, nr, nc);
            allRevealed = allRevealed.concat(result.revealedCells);
            if (result.hitMine) hitMine = true;
          }
        }
      }
    }

    return { board, revealedCells: allRevealed, hitMine };
  }

  // ── Win Detection ──────────────────────────────────────

  function isBoardSolved(board) {
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[0].length; c++) {
        const cell = board[r][c];
        if (!cell.mine && !cell.revealed) return false;
      }
    }
    return true;
  }

  // ── Board Serialisation for Gemini ─────────────────────

  function boardToAPIFormat(board, minesRemaining) {
    const rows = board.length;
    const cols = board[0].length;
    const cells = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c];
        if (cell.revealed) {
          cells.push({ row: r, col: c, state: 'revealed', adjacentMines: cell.adjacentMines });
        } else if (cell.flagged) {
          cells.push({ row: r, col: c, state: 'flagged' });
        } else {
          cells.push({ row: r, col: c, state: 'hidden' });
        }
      }
    }

    return {
      rows,
      cols,
      minesRemaining,
      cells
    };
  }

  // ── Count Flags ────────────────────────────────────────

  function countFlags(board) {
    let count = 0;
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[0].length; c++) {
        if (board[r][c].flagged) count++;
      }
    }
    return count;
  }

  // ── Reveal All Mines (game over) ───────────────────────

  function revealAllMines(board) {
    for (let r = 0; r < board.length; r++) {
      for (let c = 0; c < board[0].length; c++) {
        if (board[r][c].mine) {
          board[r][c].revealed = true;
          board[r][c].state = CELL_REVEALED;
        }
      }
    }
    return board;
  }

  // ── Public API ─────────────────────────────────────────
  return {
    CELL_HIDDEN,
    CELL_REVEALED,
    CELL_FLAGGED,
    generateBoard,
    calculateAdjacentMines,
    revealCell,
    toggleFlag,
    chordReveal,
    isBoardSolved,
    boardToAPIFormat,
    countFlags,
    revealAllMines
  };
})();
