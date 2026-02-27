const PLAYER_WHITE = 1;
const PLAYER_BLACK = -1;
// Path contains board indices. Top: 12 → 23. Bottom: 0 → 11.
const WHITE_PATH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 24, 24, 24, 24, 24, 24];
const BLACK_PATH = [23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 25, 25, 25, 25, 25, 25];

function nardyCreateBoard() {
    // Array of 26 elements (0-23: field, 24: white bear off, 25: black bear off)
    // Each element — array of chip ID
    const board = new Array(26).fill().map(() => []);

    // White chips (positive ID)
    for (let i = 1; i <= 15; i++) {
        board[0].push(i); // ID 1-15 at index 0
    }

    // Black chips (negative ID)
    for (let i = 1; i <= 15; i++) {
        board[23].push(-i); // ID -1 to -15 at index 23
    }

    return board;
}

function nardyRollDice() {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const x2 = die1 === die2;
    return {
        d1: die1,
        d1l: x2 ? 2 : 1, // used (left)
        d2: die2,
        d2l: x2 ? 2 : 1,
    };
}

function nardyFlatBoard(board) {
    return board.map(el => el.length === 0 ? 0 : el.length * Math.sign(el[0]));
}

function nardyGetChipsCount(board, index) {
    return board[index].length;
}

function nardyGetPlayerAtPosition(board, index) {
    if (board[index].length === 0) return 0;
    return Math.sign(board[index][0]);
}

function nardySumArray(arr, sign) {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
        if (Math.sign(arr[i]) === sign) sum += arr[i];
    }
    return sum;
}

function nardyIsIllegalBlock(board, player, boardIndexFrom, boardIndexTo) {
    let pathIndexTo = player === 1
        ? WHITE_PATH.findIndex(el => el === boardIndexTo)
        : BLACK_PATH.findIndex(el => el === boardIndexTo);

    let countAroundTarget = 0;
    let leftSideChecked = false;
    let rightSideChecked = false;

    for (let i = 1; i < 6; i++) {
        let leftSidePlayer;
        let rightSidePlayer;
        if (player === 1) {
            leftSidePlayer = pathIndexTo + i <= 23 && !leftSideChecked
                ? nardyGetPlayerAtPosition(board, WHITE_PATH[pathIndexTo + i])
                : 0;
            rightSidePlayer = pathIndexTo - i >= 0 && !rightSideChecked
                ? nardyGetPlayerAtPosition(board, WHITE_PATH[pathIndexTo - i])
                : 0;
        }
        if (player === -1) {
            leftSidePlayer = pathIndexTo + i <= 23 && !leftSideChecked
                ? nardyGetPlayerAtPosition(board, BLACK_PATH[pathIndexTo + i])
                : 0;
            rightSidePlayer = pathIndexTo - i >= 0 && !rightSideChecked
                ? nardyGetPlayerAtPosition(board, BLACK_PATH[pathIndexTo - i])
                : 0;
        }

        if (leftSidePlayer === player) {
            countAroundTarget += 1;
        } else {
            leftSideChecked = true;
        }

        if (rightSidePlayer === player) {
            countAroundTarget += 1;
        } else {
            rightSideChecked = true;
        }

        if (countAroundTarget >= 6 || (rightSideChecked && leftSideChecked)) break;
    }

    // below is a check for illegal block (not completed)
    let opponentChipsAfterBlock = 0;
    if (countAroundTarget + 1 >= 6) {

    }
    if (opponentChipsAfterBlock > 0) {

    }
}

function nardyGetPossibleMoves(board, player, dice, headMovesLeft = 1) {
    const moves = [];

    const flatBoard = nardyFlatBoard(board);

    const headIndex = player === PLAYER_WHITE ? 0 : 23;
    const borneOffIndex = player === PLAYER_WHITE ? 24 : 25;

    let canBearOff = player === 1
        ? nardySumArray([...flatBoard.slice(0, 12), ...flatBoard.slice(18, 24)], 1) === 0
        : nardySumArray([...flatBoard.slice(0, 6), ...flatBoard.slice(12, 24)], -1) === 0;

    let from = headMovesLeft === 0 && player === 1 ? 1 : 0;
    let to = headMovesLeft === 0 && player === -1 ? 23 : 24;

    for (let boardIndexFrom = from; boardIndexFrom < to; boardIndexFrom++) {
        const playerAtPosition = nardyGetPlayerAtPosition(board, boardIndexFrom);
        if (playerAtPosition === player) {

            const pathIndexFrom = player === 1
                ? WHITE_PATH.findIndex(el => el === boardIndexFrom)
                : BLACK_PATH.findIndex(el => el === boardIndexFrom);
            const pathIndexTo = pathIndexFrom + dice;
            const boardIndexTo = player === 1
                ? WHITE_PATH[pathIndexTo]
                : BLACK_PATH[pathIndexTo];
            if (boardIndexTo >= 0 && boardIndexTo <= 23) {
                const targetPlayer = nardyGetPlayerAtPosition(board, boardIndexTo);
                if (targetPlayer === 0) {
                    // check for illegal block here
                }
                if (targetPlayer === 0 || targetPlayer === player) {
                    moves.push({
                        from: boardIndexFrom,
                        to: boardIndexTo,
                        bearOff: false,
                        dice: dice
                    });
                }
            }
            if (canBearOff) {
                if (boardIndexTo > 23) {
                    moves.push({
                        from: boardIndexFrom,
                        to: borneOffIndex,
                        bearOff: true,
                        dice: dice
                    });
                }
            }
        }
    }

    return moves;
}

function nardyGetAllPossibleMoves(board, player, dices, headMovesLeft = 1) {
    const diceOne = dices.d1l > 0 ? nardyGetPossibleMoves(board, player, dices.d1, headMovesLeft) : [];
    const diceTwo = dices.d2l > 0 ? nardyGetPossibleMoves(board, player, dices.d2, headMovesLeft) : [];
    return [...diceOne, ...diceTwo]
}

function nardyMakeMove(board, player, move) {
    // Глубокое копирование доски
    const newBoard = board.map(cell => [...cell]);
    let movingChip = newBoard[move.from].pop();
    newBoard[move.to].push(movingChip);

    const chipsLeft = nardyFlatBoard(newBoard).slice(0, 24).some(el => Math.sign(el) === player);

    return {
        board: newBoard,
        gameOver: !chipsLeft
    };
}

function nardyCompressBoard(board) {
    // Формат: "cellIndex:chipId,chipId;cellIndex:chipId,chipId"
    return board.map((cell, index) => {
        if (cell.length === 0) return '';
        return `${index}:${cell.join(',')}`;
    }).filter(str => str !== '').join(';');
}

function nardyDecompressBoard(compressed) {
    const board = new Array(26).fill().map(() => []);

    if (!compressed) return board;

    const cells = compressed.split(';');
    for (const cell of cells) {
        const [indexStr, chipsStr] = cell.split(':');
        const index = parseInt(indexStr);
        const chips = chipsStr.split(',').map(Number);
        board[index] = chips;
    }

    return board;
}

export {
    nardyCreateBoard,
    nardyRollDice,
    nardyGetPossibleMoves,
    nardyGetAllPossibleMoves,
    nardyMakeMove,
    nardyCompressBoard,
    nardyDecompressBoard,
}