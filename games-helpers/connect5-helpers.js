const BOARD_SIZE = 10;
const WIN_LENGTH = 5;
const EMPTY = 0;
const PLAYER1 = 1; // white
const PLAYER2 = 2; // black

function connect5CreateBoard() {
    return Array(BOARD_SIZE * BOARD_SIZE).fill(EMPTY);
}

function connect5IsValidMove(board, row, col) {
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
        return false;
    }
    const index = row * BOARD_SIZE + col;
    return board[index] === EMPTY;
}

function connect5MakeMove(board, row, col, player) {
    if (!connect5IsValidMove(board, row, col)) {
        return null;
    }
    const newBoard = [...board];
    const index = row * BOARD_SIZE + col;
    newBoard[index] = player;
    return newBoard;
}

function connect5CheckWin(board, player) {
    const directions = [
        [0, 1],   // горизонталь
        [1, 0],   // вертикаль
        [1, 1],   // диагональ вправо-вниз
        [1, -1]   // диагональ вправо-вверх
    ];

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const index = row * BOARD_SIZE + col;

            if (board[index] === player) {
                for (const [dx, dy] of directions) {
                    let count = 1;

                    // Проверяем в одну сторону
                    for (let i = 1; i < WIN_LENGTH; i++) {
                        const newRow = row + dx * i;
                        const newCol = col + dy * i;

                        if (newRow < 0 || newRow >= BOARD_SIZE ||
                            newCol < 0 || newCol >= BOARD_SIZE) {
                            break;
                        }

                        if (board[newRow * BOARD_SIZE + newCol] === player) {
                            count++;
                        } else {
                            break;
                        }
                    }

                    // Проверяем в другую сторону
                    for (let i = 1; i < WIN_LENGTH; i++) {
                        const newRow = row - dx * i;
                        const newCol = col - dy * i;

                        if (newRow < 0 || newRow >= BOARD_SIZE ||
                            newCol < 0 || newCol >= BOARD_SIZE) {
                            break;
                        }

                        if (board[newRow * BOARD_SIZE + newCol] === player) {
                            count++;
                        } else {
                            break;
                        }
                    }

                    if (count >= WIN_LENGTH) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function connect5IsBoardFull(board) {
    return board.every(cell => cell !== EMPTY);
}

function connect5GetGameStatus(board, currentPlayer) {
    if (connect5CheckWin(board, PLAYER1)) {
        return {gameOver: true, winner: PLAYER1, message: 'Игрок 1 победил!'};
    }
    if (connect5CheckWin(board, PLAYER2)) {
        return {gameOver: true, winner: PLAYER2, message: 'Игрок 2 победил!'};
    }
    if (connect5IsBoardFull(board)) {
        return {gameOver: true, winner: null, message: 'Ничья!'};
    }
    return {gameOver: false, winner: null, message: `Ход игрока ${currentPlayer}`};
}

// AI functions
function getPossibleMoves(board, player, quality = 'high') {
    const opponent = player === PLAYER1 ? PLAYER2 : PLAYER1;
    const moves = [];
    const center = Math.floor(BOARD_SIZE / 2);
    const searchRadius = quality === 'high' ? 2 : 1; // Для easy ищем меньше
    const checked = new Set();

    // Если доска пустая
    if (!board.some(cell => cell !== EMPTY)) {
        // Easy: любой ход в центре, не обязательно точный центр
        if (quality === 'low') {
            const offset = Math.floor(Math.random() * 3) - 1;
            return [{row: center + offset, col: center + offset, priority: 0}];
        }
        return [{row: center, col: center, priority: 100}];
    }

    // Находим все занятые клетки
    for (let i = 0; i < board.length; i++) {
        if (board[i] !== EMPTY) {
            const row = Math.floor(i / BOARD_SIZE);
            const col = i % BOARD_SIZE;

            for (let dr = -searchRadius; dr <= searchRadius; dr++) {
                const newRow = row + dr;
                if (newRow < 0 || newRow >= BOARD_SIZE) continue;

                for (let dc = -searchRadius; dc <= searchRadius; dc++) {
                    const newCol = col + dc;
                    if (newCol < 0 || newCol >= BOARD_SIZE) continue;

                    const index = newRow * BOARD_SIZE + newCol;
                    if (board[index] !== EMPTY || checked.has(index)) continue;

                    checked.add(index);

                    // Easy: упрощенный приоритет или случайный
                    let priority = 0;
                    if (quality === 'high') {
                        priority = calculateMovePriority(board, newRow, newCol, player, opponent);
                    } else {
                        // Для easy: простой приоритет + случайность
                        priority = Math.random() * 50;
                        // Небольшой бонус за центр и соседей
                        const distFromCenter = Math.abs(newRow - center) + Math.abs(newCol - center);
                        priority += (BOARD_SIZE - distFromCenter);

                        let neighbors = 0;
                        for (let dr2 = -1; dr2 <= 1; dr2++) {
                            for (let dc2 = -1; dc2 <= 1; dc2++) {
                                if (dr2 === 0 && dc2 === 0) continue;
                                const nr = newRow + dr2;
                                const nc = newCol + dc2;
                                if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                                    if (board[nr * BOARD_SIZE + nc] !== EMPTY) neighbors++;
                                }
                            }
                        }
                        priority += neighbors * 3;
                    }

                    moves.push({row: newRow, col: newCol, priority});
                }
            }
        }
    }

    // Fallback
    if (moves.length === 0) {
        for (let i = 0; i < board.length; i++) {
            if (board[i] === EMPTY) {
                const row = Math.floor(i / BOARD_SIZE);
                const col = i % BOARD_SIZE;
                moves.push({row, col, priority: Math.random() * 100});
            }
        }
    }

    moves.sort((a, b) => b.priority - a.priority);

    // Easy: больше случайности, не всегда лучший ход
    if (quality === 'low') {
        const randomIndex = Math.floor(Math.random() * Math.min(5, moves.length));
        return [moves[randomIndex]];
    }

    return moves.slice(0, 15);
}

function calculateMovePriority(board, row, col, player, opponent) {
    let priority = 0;
    const center = Math.floor(BOARD_SIZE / 2);

    // 1. Близость к центру
    const distFromCenter = Math.abs(row - center) + Math.abs(col - center);
    priority += (BOARD_SIZE - distFromCenter) * 2;

    // 2. Соседи
    let playerNeighbors = 0;
    let opponentNeighbors = 0;

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;

            const nr = row + dr;
            const nc = col + dc;

            if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                const cell = board[nr * BOARD_SIZE + nc];
                if (cell === player) playerNeighbors++;
                else if (cell === opponent) opponentNeighbors++;
            }
        }
    }

    priority += playerNeighbors * 15;
    priority += opponentNeighbors * 12;

    // 3. Потенциальные линии
    priority += evaluatePotentialLines(board, row, col, player, opponent) * 2;

    return priority;
}

function evaluatePotentialLines(board, row, col, player, opponent) {
    let score = 0;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (const [dx, dy] of directions) {
        // ОЦЕНКА ДЛЯ ИГРОКА
        let playerCount = 0;
        let playerOpenEnds = 0;
        let playerBlocked = false;

        // В одну сторону
        for (let i = 1; i < WIN_LENGTH; i++) {
            const newRow = row + dx * i;
            const newCol = col + dy * i;

            if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) {
                playerBlocked = true;
                break;
            }

            const cell = board[newRow * BOARD_SIZE + newCol];
            if (cell === player) {
                playerCount++;
            } else if (cell === EMPTY) {
                playerOpenEnds++;
                break;
            } else {
                playerBlocked = true;
                break;
            }
        }

        // В другую сторону
        for (let i = 1; i < WIN_LENGTH; i++) {
            const newRow = row - dx * i;
            const newCol = col - dy * i;

            if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) {
                playerBlocked = true;
                break;
            }

            const cell = board[newRow * BOARD_SIZE + newCol];
            if (cell === player) {
                playerCount++;
            } else if (cell === EMPTY) {
                playerOpenEnds++;
                break;
            } else {
                playerBlocked = true;
                break;
            }
        }

        // ОЦЕНКА ДЛЯ ПРОТИВНИКА
        let opponentCount = 0;
        let opponentOpenEnds = 0;
        let opponentBlocked = false;

        // В одну сторону
        for (let i = 1; i < WIN_LENGTH; i++) {
            const newRow = row + dx * i;
            const newCol = col + dy * i;

            if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) {
                opponentBlocked = true;
                break;
            }

            const cell = board[newRow * BOARD_SIZE + newCol];
            if (cell === opponent) {
                opponentCount++;
            } else if (cell === EMPTY) {
                opponentOpenEnds++;
                break;
            } else {
                opponentBlocked = true;
                break;
            }
        }

        // В другую сторону
        for (let i = 1; i < WIN_LENGTH; i++) {
            const newRow = row - dx * i;
            const newCol = col - dy * i;

            if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) {
                opponentBlocked = true;
                break;
            }

            const cell = board[newRow * BOARD_SIZE + newCol];
            if (cell === opponent) {
                opponentCount++;
            } else if (cell === EMPTY) {
                opponentOpenEnds++;
                break;
            } else {
                opponentBlocked = true;
                break;
            }
        }

        // ОЦЕНКА ДЛЯ ИГРОКА (атака)
        if (playerCount >= 4) score += 10000; // Готовый выигрыш
        else if (playerCount === 3 && playerOpenEnds >= 1 && !playerBlocked) score += 5000; // Открытая четверка
        else if (playerCount === 3 && playerOpenEnds >= 1) score += 2000; // Четверка с одного конца
        else if (playerCount === 3) score += 500; // Закрытая четверка
        else if (playerCount === 2 && playerOpenEnds >= 2) score += 300; // Открытая тройка
        else if (playerCount === 2 && playerOpenEnds >= 1) score += 100; // Полуоткрытая тройка
        else if (playerCount === 1 && playerOpenEnds >= 2) score += 30; // Потенциал

        // ОЦЕНКА ДЛЯ ПРОТИВНИКА (защита)
        if (opponentCount >= 4) score += 8000; // СРОЧНО БЛОКИРОВАТЬ!
        else if (opponentCount === 3 && opponentOpenEnds >= 1 && !opponentBlocked) score += 4000; // Открытая четверка противника
        else if (opponentCount === 3 && opponentOpenEnds >= 1) score += 1500; // Четверка противника
        else if (opponentCount === 2 && opponentOpenEnds >= 2) score += 400; // Открытая тройка противника
        else if (opponentCount === 2 && opponentOpenEnds >= 1) score += 150; // Полуоткрытая тройка противника
    }

    return score;
}


function connect5GetEasyMove(board, player) {
    // 1. Проверяем выигрышный ход
    const winningMove = getWinningMove(board, player);
    if (winningMove) return winningMove;

    // 2. Проверяем блокировку противника
    const opponent = player === PLAYER1 ? PLAYER2 : PLAYER1;
    const blockingMove = getWinningMove(board, opponent);
    if (blockingMove) return blockingMove;

    // 3. Используем эвристику для лучшего хода
    const moves = getPossibleMoves(board, player);
    if (moves.length > 0) {
        return moves[0]; // moves уже отсортированы по приоритету
    }

    // 4. Fallback - любой пустой ход
    for (let i = 0; i < board.length; i++) {
        if (board[i] === EMPTY) {
            return {
                row: Math.floor(i / BOARD_SIZE),
                col: i % BOARD_SIZE
            };
        }
    }

    return null;
}

function getWinningMove(board, player) {
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (connect5IsValidMove(board, row, col)) {
                const newBoard = connect5MakeMove(board, row, col, player);
                if (newBoard && connect5CheckWin(newBoard, player)) {
                    return {row, col};
                }
            }
        }
    }
    return null;
}

function connect5CompressBoard(board) {
    if (!board || board.length !== 100) {
        throw new Error('Доска должна быть массивом из 100 элементов');
    }

    // Вариант 1: Бинарная строка (наиболее компактный)
    let binaryStr = '';

    // Каждую ячейку кодируем 2 битами (00=0, 01=1, 10=2)
    for (let i = 0; i < board.length; i += 4) {
        let byte = 0;

        // Собираем 4 ячейки в один байт (8 бит)
        for (let j = 0; j < 4 && i + j < board.length; j++) {
            const cell = board[i + j];
            if (cell < 0 || cell > 2) {
                throw new Error(`Некорректное значение в ячейке ${i + j}: ${cell}`);
            }

            // Сдвигаем на 2 бита для каждой ячейки
            byte |= cell << (6 - j * 2);
        }

        // Преобразуем байт в символ (используем весь диапазон 0-255)
        binaryStr += String.fromCharCode(byte);
    }

    // Кодируем в base64 для передачи в URL/JSON
    return btoa(binaryStr);
}

function connect5DecompressBoard(compressedStr) {
    if (!compressedStr || typeof compressedStr !== 'string') {
        throw new Error('Сжатая строка должна быть непустой строкой');
    }

    // Декодируем из base64
    const binaryStr = atob(compressedStr);
    const board = new Array(100).fill(0);

    // Восстанавливаем из бинарной строки
    for (let i = 0; i < binaryStr.length; i++) {
        const byte = binaryStr.charCodeAt(i);

        // Извлекаем 4 ячейки из одного байта
        for (let j = 0; j < 4 && i * 4 + j < board.length; j++) {
            // Извлекаем 2 бита для каждой ячейки
            const shift = 6 - j * 2;
            const cellValue = (byte >> shift) & 0b11;

            // Проверяем на валидность (должно быть 0, 1 или 2)
            if (cellValue > 2) {
                board[i * 4 + j] = 0;
            } else {
                board[i * 4 + j] = cellValue;
            }
        }
    }

    return board;
}

function connect5FindAllWins(board, symbol) {
    if (!board || board.length !== 100) {
        throw new Error('Доска должна быть массивом из 100 элементов (10×10)');
    }

    if (symbol !== 1 && symbol !== 2) {
        throw new Error('Символ должен быть 1 (игрок 1) или 2 (игрок 2)');
    }

    const winningCombinations = [];
    const BOARD_SIZE = 10;
    const WIN_LENGTH = 5;

    // 1. Горизонтальные линии (10 рядов × 6 комбинаций в ряду = 60)
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let startCol = 0; startCol <= BOARD_SIZE - WIN_LENGTH; startCol++) {
            const indices = [];
            // Собираем индексы для проверяемой линии
            for (let i = 0; i < WIN_LENGTH; i++) {
                indices.push(row * BOARD_SIZE + startCol + i);
            }

            // Проверяем, что все 5 клеток содержат symbol
            if (indices.every(idx => board[idx] === symbol)) {
                const positions = indices.map(idx => ({
                    col: idx % BOARD_SIZE,
                    row: Math.floor(idx / BOARD_SIZE)
                }));

                winningCombinations.push({
                    type: 'horizontal',
                    row: row,
                    startCol: startCol,
                    endCol: startCol + WIN_LENGTH - 1,
                    indices: [...indices], // копия массива
                    positions: positions
                });
            }
        }
    }

    // 2. Вертикальные линии (10 колонок × 6 комбинаций = 60)
    for (let col = 0; col < BOARD_SIZE; col++) {
        for (let startRow = 0; startRow <= BOARD_SIZE - WIN_LENGTH; startRow++) {
            const indices = [];
            for (let i = 0; i < WIN_LENGTH; i++) {
                indices.push((startRow + i) * BOARD_SIZE + col);
            }

            if (indices.every(idx => board[idx] === symbol)) {
                const positions = indices.map(idx => ({
                    col: idx % BOARD_SIZE,
                    row: Math.floor(idx / BOARD_SIZE)
                }));

                winningCombinations.push({
                    type: 'vertical',
                    col: col,
                    startRow: startRow,
                    endRow: startRow + WIN_LENGTH - 1,
                    indices: [...indices],
                    positions: positions
                });
            }
        }
    }

    // 3. Диагонали вниз-вправо ↘ (6×6 = 36)
    for (let startRow = 0; startRow <= BOARD_SIZE - WIN_LENGTH; startRow++) {
        for (let startCol = 0; startCol <= BOARD_SIZE - WIN_LENGTH; startCol++) {
            const indices = [];
            for (let i = 0; i < WIN_LENGTH; i++) {
                indices.push((startRow + i) * BOARD_SIZE + (startCol + i));
            }

            if (indices.every(idx => board[idx] === symbol)) {
                const positions = indices.map(idx => ({
                    col: idx % BOARD_SIZE,
                    row: Math.floor(idx / BOARD_SIZE)
                }));

                winningCombinations.push({
                    type: 'diagonal_down',
                    startRow: startRow,
                    startCol: startCol,
                    endRow: startRow + WIN_LENGTH - 1,
                    endCol: startCol + WIN_LENGTH - 1,
                    indices: [...indices],
                    positions: positions
                });
            }
        }
    }

    // 4. Диагонали вверх-вправо ↙ (6×6 = 36)
    for (let startRow = WIN_LENGTH - 1; startRow < BOARD_SIZE; startRow++) {
        for (let startCol = 0; startCol <= BOARD_SIZE - WIN_LENGTH; startCol++) {
            const indices = [];
            for (let i = 0; i < WIN_LENGTH; i++) {
                indices.push((startRow - i) * BOARD_SIZE + (startCol + i));
            }

            if (indices.every(idx => board[idx] === symbol)) {
                const positions = indices.map(idx => ({
                    col: idx % BOARD_SIZE,
                    row: Math.floor(idx / BOARD_SIZE)
                }));

                winningCombinations.push({
                    type: 'diagonal_up',
                    startRow: startRow,
                    startCol: startCol,
                    endRow: startRow - WIN_LENGTH + 1,
                    endCol: startCol + WIN_LENGTH - 1,
                    indices: [...indices],
                    positions: positions
                });
            }
        }
    }

    // Собираем все уникальные индексы (без дубликатов)
    const allIndices = winningCombinations.flatMap(combo => combo.indices);
    const uniqueIndices = [...new Set(allIndices)].sort((a, b) => a - b);

    return {
        win: winningCombinations.length > 0,
        count: winningCombinations.length,
        combinations: winningCombinations,
        // Все позиции во всех комбинациях (с дубликатами)
        allPositions: winningCombinations.flatMap(combo => combo.positions),
        // Уникальные позиции
        uniquePositions: uniqueIndices.map(idx => ({
            index: idx,
            col: idx % BOARD_SIZE,
            row: Math.floor(idx / BOARD_SIZE)
        })),
        // Массив уникальных индексов (для быстрого доступа)
        uniqueIndices: uniqueIndices
    };
}

export {
    connect5CreateBoard,
    connect5IsValidMove,
    connect5MakeMove,
    connect5CheckWin,
    connect5IsBoardFull,
    connect5GetGameStatus,
    connect5GetEasyMove,
    connect5CompressBoard,
    connect5DecompressBoard,
    connect5FindAllWins
};