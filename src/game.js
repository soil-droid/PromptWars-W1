// ═══════════════════════════════════════════════════════════
// game.js — Core Minesweeper Logic (Pure Functions)
// ═══════════════════════════════════════════════════════════

/** @constant {number} */
export const CELL_HIDDEN = 0;
/** @constant {number} */
export const CELL_REVEALED = 1;
/** @constant {number} */
export const CELL_FLAGGED = 2;

// ── Board Generation ───────────────────────────────────

/**
 * Generates a new Minesweeper board.
 * @param {number} rows - Number of rows.
 * @param {number} cols - Number of columns.
 * @param {number} mineCount - Total number of mines to place.
 * @param {{row: number, col: number}} [safeCell] - A coordinate guaranteed to be mine-free along with its neighbours.
 * @returns {Array<Array<Object>>} A 2D array representing the board state.
 */
export function generateBoard(rows, cols, mineCount, safeCell) {
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

  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }

  const actualMineCount = Math.min(mineCount, eligible.length);
  for (let i = 0; i < actualMineCount; i++) {
    board[eligible[i].r][eligible[i].c].mine = true;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      board[r][c].adjacentMines = calculateAdjacentMines(board, r, c);
    }
  }

  return board;
}

// ── Adjacent Mine Count ────────────────────────────────

/**
 * Calculates the number of adjacent mines for a given cell.
 * @param {Array<Array<Object>>} board - The board state.
 * @param {number} row - The row index.
 * @param {number} col - The column index.
 * @returns {number} The integer count of adjacent mines.
 */
export function calculateAdjacentMines(board, row, col) {
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
 * Reveals a cell and cascades if it has zero adjacent mines.
 * @param {Array<Array<Object>>} board - The current board state.
 * @param {number} row - The row index to reveal.
 * @param {number} col - The column index to reveal.
 * @returns {{ board: Array<Array<Object>>, revealedCells: Array<{row: number, col: number}>, hitMine: boolean }}
 */
export function revealCell(board, row, col) {
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

/**
 * Toggles a flag on a given hidden cell.
 * @param {Array<Array<Object>>} board - The current board state.
 * @param {number} row - The row index.
 * @param {number} col - The column index.
 * @returns {Array<Array<Object>>} The updated board.
 */
export function toggleFlag(board, row, col) {
  const cell = board[row][col];
  if (cell.revealed) return board;

  cell.flagged = !cell.flagged;
  cell.state = cell.flagged ? CELL_FLAGGED : CELL_HIDDEN;
  return board;
}

// ── Chord Reveal ───────────────────────────────────────

/**
 * Performs a chord reveal around a revealed numbered cell.
 * @param {Array<Array<Object>>} board - The current board state.
 * @param {number} row - The row index of the numbered cell.
 * @param {number} col - The column index of the numbered cell.
 * @returns {{ board: Array<Array<Object>>, revealedCells: Array<{row: number, col: number}>, hitMine: boolean }}
 */
export function chordReveal(board, row, col) {
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

/**
 * Detects if the board represents a cleared minefield.
 * @param {Array<Array<Object>>} board - The current board state.
 * @returns {boolean} True if the board is completely solved.
 */
export function isBoardSolved(board) {
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[0].length; c++) {
      const cell = board[r][c];
      if (!cell.mine && !cell.revealed) return false;
    }
  }
  return true;
}

// ── Board Serialisation for Gemini ─────────────────────

/**
 * Returns a JSON-serializable structured view of the board for Gemini context.
 * @param {Array<Array<Object>>} board - The current board state.
 * @param {number} minesRemaining - Pre-calculated remaining mine count.
 * @returns {Object} JSON payload of board state.
 */
export function boardToAPIFormat(board, minesRemaining) {
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

  return { rows, cols, minesRemaining, cells };
}

// ── Count Flags ────────────────────────────────────────

/**
 * Utility to count total active flags on the board.
 * @param {Array<Array<Object>>} board - The board array.
 * @returns {number} The flag count.
 */
export function countFlags(board) {
  let count = 0;
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[0].length; c++) {
      if (board[r][c].flagged) count++;
    }
  }
  return count;
}

// ── Reveal All Mines (game over) ───────────────────────

/**
 * Exposes all hidden mines on the board typically triggered by Game Over.
 * @param {Array<Array<Object>>} board - The board array.
 * @returns {Array<Array<Object>>} The updated board.
 */
export function revealAllMines(board) {
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
