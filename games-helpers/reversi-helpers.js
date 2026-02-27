/**
 * Othello game logic functions
 * Board: 1D array with 64 integers
 * 0 = empty, 1 = white, 2 = black
 * Coordinates: {x, y} where x = column (0-7), y = row (0-7)
 */

// Direction vectors for all 8 possible directions
const DIRECTIONS = [
    {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
    {dx: -1, dy: 0}, {dx: 1, dy: 0},
    {dx: -1, dy: 1}, {dx: 0, dy: 1}, {dx: 1, dy: 1}
];

/**
 * Convert 2D coordinates to 1D index
 * @param {number} x - Column (0-7)
 * @param {number} y - Row (0-7)
 * @returns {number} Index in 1D array
 */
function coordsToIndex(x, y) {
    return y * 8 + x;
}

/**
 * Check if coordinates are within board bounds
 * @param {number} x - Column
 * @param {number} y - Row
 * @returns {boolean} True if valid
 */
function isValidCoordinate(x, y) {
    return x >= 0 && x < 8 && y >= 0 && y < 8;
}

/**
 * Find all available moves for a player
 * @param {number[]} board - Current board state
 * @param {string} color - 'white' or 'black'
 * @param {string} lvl - difficulty level
 * @returns {Array<{x: number, y: number, score: number}> | null} Array of moves with scores, sorted best to worst
 */
function reversiFindAvailableMoves(board, color, lvl = 'easy') {
    const player = color === 'white' ? 1 : 2;
    const opponent = color === 'white' ? 2 : 1;
    const moves = [];

    // Find all empty squares
    for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
            const idx = coordsToIndex(x, y);

            // Check if square is empty
            if (board[idx] !== 0) continue;

            let totalFlipped = 0;

            // Check all 8 directions from this empty square
            for (const dir of DIRECTIONS) {
                let flipped = 0;
                let cx = x + dir.dx;
                let cy = y + dir.dy;

                // Move in direction while we find opponent pieces
                while (isValidCoordinate(cx, cy)) {
                    const cIdx = coordsToIndex(cx, cy);
                    if (board[cIdx] === opponent) {
                        flipped++;
                        cx += dir.dx;
                        cy += dir.dy;
                    } else if (board[cIdx] === player && flipped > 0) {
                        // Found a line of opponent pieces bracketed by player pieces
                        totalFlipped += flipped;
                        break;
                    } else {
                        break; // Empty or player without opponent pieces in between
                    }
                }
            }

            // If we can flip pieces in at least one direction, it's a valid move
            if (totalFlipped > 0) {
                if (lvl === 'medium' &&
                    ((x === 0 && y === 0)
                        || (x === 0 && y === 7)
                        || (x === 7 && y === 0)
                        || (x === 7 && y === 7))) {
                    totalFlipped += 100; // priority to capture corner
                }
                moves.push({x, y, score: totalFlipped});
            }
        }
    }

    // Sort moves by score (best to worst)
    moves.sort((a, b) => b.score - a.score);

    // Remove score property if not needed in final output
    const result = moves.map(({x, y}) => ({x, y}));

    return result.length > 0 ? result : null;
}

/**
 * Apply a move to the board and flip necessary disks
 * @param {number[]} board - Current board state
 * @param {Object} move - {x: number, y: number}
 * @param {string} color - 'white' or 'black'
 * @returns {number[]} New board state
 */
function reversiUpdateBoard(board, move, color) {
    // Create a copy of the board
    const newBoard = [...board];
    const {x, y} = move;
    const player = color === 'white' ? 1 : 2;
    const opponent = color === 'white' ? 2 : 1;

    // Place the player's piece
    const moveIdx = coordsToIndex(x, y);
    newBoard[moveIdx] = player;

    // Check all 8 directions for pieces to flip
    for (const dir of DIRECTIONS) {
        let piecesToFlip = [];
        let cx = x + dir.dx;
        let cy = y + dir.dy;

        // Collect opponent pieces in this direction
        while (isValidCoordinate(cx, cy)) {
            const cIdx = coordsToIndex(cx, cy);
            if (newBoard[cIdx] === opponent) {
                piecesToFlip.push({x: cx, y: cy, idx: cIdx});
                cx += dir.dx;
                cy += dir.dy;
            } else if (newBoard[cIdx] === player && piecesToFlip.length > 0) {
                // Valid line found - flip all collected pieces
                for (const piece of piecesToFlip) {
                    newBoard[piece.idx] = player;
                }
                break;
            } else {
                break; // Empty or player without opponent pieces in between
            }
        }
    }

    return newBoard;
}

/**
 * Helper function: Count pieces for each player
 * @param {number[]} board
 * @returns {Object} Counts for white and black
 */
function countPieces(board) {
    let white = 0, black = 0;
    for (let i = 0; i < 64; i++) {
        if (board[i] === 1) white++;
        if (board[i] === 2) black++;
    }
    return {white, black};
}

/**
 * Compress an 8x8 board (64 cells) to a compact string
 * Uses 2 bits per cell: 0=empty, 1=white, 2=black
 * @param {number[]} boardArray - Array of 64 integers (0, 1, or 2)
 * @returns {string} Compressed string (~16 characters)
 */
function reversiCompressBoard(boardArray) {
    // 0=empty, 1=white, 2=black → use 2 bits per cell
    let binaryStr = '';

    // Process 4 cells at a time (4 cells * 2 bits = 8 bits = 1 byte)
    for (let i = 0; i < boardArray.length; i += 4) {
        let byte = 0;
        for (let j = 0; j < 4 && i + j < boardArray.length; j++) {
            // Store value using 2 bits, shift into position
            byte |= (boardArray[i + j] & 3) << (j * 2);
        }
        // Convert to printable character (starting from space char 32)
        binaryStr += String.fromCharCode(byte + 32);
    }
    return binaryStr; // 64/4 = 16 characters
}

/**
 * Decompress a string back to 8x8 board array
 * @param {string} compressedStr - Compressed string from compressBoard()
 * @returns {number[]} Array of 64 integers (0, 1, or 2)
 */
function reversiDecompressBoard(compressedStr) {
    const board = new Array(64).fill(0);

    for (let i = 0; i < compressedStr.length; i++) {
        const byte = compressedStr.charCodeAt(i) - 32;

        // Extract 4 values from each byte
        for (let j = 0; j < 4 && i * 4 + j < 64; j++) {
            // Extract 2 bits for each cell
            board[i * 4 + j] = (byte >> (j * 2)) & 3;
        }
    }
    return board;
}

/**
 * Alternative version with Base64 encoding for even more compact storage
 * @param {number[]} boardArray - Array of 64 integers (0, 1, or 2)
 * @returns {string} Base64 encoded string (only 11 characters)
 */
function compressBoardBase64(boardArray) {
    // Pack 4 cells into each byte (4 cells * 2 bits = 8 bits)
    let bytes = new Uint8Array(Math.ceil(boardArray.length / 4));

    for (let i = 0; i < boardArray.length; i += 4) {
        let byte = 0;
        for (let j = 0; j < 4 && i + j < boardArray.length; j++) {
            byte |= (boardArray[i + j] & 3) << (j * 2);
        }
        bytes[i / 4] = byte;
    }

    // Convert to Base64
    return btoa(String.fromCharCode.apply(null, bytes));
}

/**
 * Decompress from Base64 back to board array
 * @param {string} base64Str - Base64 encoded string
 * @returns {number[]} Array of 64 integers
 */
function decompressBoardBase64(base64Str) {
    // Decode Base64
    const binaryStr = atob(base64Str);
    const board = new Array(64).fill(0);

    for (let i = 0; i < binaryStr.length; i++) {
        const byte = binaryStr.charCodeAt(i);

        for (let j = 0; j < 4 && i * 4 + j < 64; j++) {
            board[i * 4 + j] = (byte >> (j * 2)) & 3;
        }
    }

    return board;
}

// Helper function from previous implementation
function reversiCreateInitialBoard() {
    const board = new Array(64).fill(0);
    // Set up initial pieces
    board[3 * 8 + 3] = 1; // white (3,3)
    board[4 * 8 + 4] = 1; // white (4,4)
    board[3 * 8 + 4] = 2; // black (3,4)
    board[4 * 8 + 3] = 2; // black (4,3)
    return board;
}

export {
    reversiFindAvailableMoves,
    reversiUpdateBoard,
    reversiCreateInitialBoard,
    reversiCompressBoard,
    reversiDecompressBoard
}