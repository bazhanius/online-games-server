function connect4CreateBoard() {
    const COLS = 7;
    const ROWS = 6;
    return Array.from({length: COLS}, () =>
        Array.from({length: ROWS}, () => null)
    );
}


function connect4MakeMove(board, column, color) {
    const playerSymbol = color === 'white' ? 0 : 1;
    const newBoard = [...board];

    if (column < 0 || column >= board.length) {
        return {
            success: false,
            error: 'Wrong column'
        };
    }

    // Находим первую свободную позицию в колонке (снизу вверх)
    const colArray = newBoard[column];
    let row = -1;

    // Идем снизу вверх
    for (let r = colArray.length - 1; r >= 0; r--) {
        if (colArray[r] === null) {
            row = r;
            break;
        }
    }

    if (row === -1) {
        return {
            success: false,
            error: 'Column is full'
        };
    }

    // Placing chip, 0 — yellow, 1 — red
    newBoard[column][row] = playerSymbol;

    const isWin = connect4CheckWin(newBoard, column, row, playerSymbol);
    const isDraw = connect4CheckDraw(newBoard);

    return {
        success: true,
        board: JSON.parse(JSON.stringify(newBoard)),
        movePosition: column && row ? {column: column, row: row} : null,
        isDraw: isDraw,
        isWin: isWin,
        position: {column, row}
    };
}

// Проверка ничьей
function connect4CheckDraw(board) {
    // Если все верхние клетки всех колонок заняты
    return board.every(col => col[0] !== null);
}

function connect4CheckWin(board, col, row, symbol) {
    const directions = [
        [1, 0],   // горизонталь →
        [0, 1],   // вертикаль ↓
        [1, 1],   // диагонал ↘
        [1, -1]   // диагонал ↙
    ];

    for (const [dx, dy] of directions) {
        let count = 1; // Текущая фишка уже есть

        // Проверяем в одну сторону
        count += connect4CountDirection(board, col, row, dx, dy, symbol);
        // Проверяем в противоположную сторону
        count += connect4CountDirection(board, col, row, -dx, -dy, symbol);

        if (count >= 4) {
            return true;
        }
    }

    return false;
}

function connect4CountDirection(board, startCol, startRow, dx, dy, symbol) {
    let count = 0;
    let col = startCol + dx;
    let row = startRow + dy;
    const cols = board.length;
    const rows = board[0].length;

    while (
        col >= 0 && col < cols &&
        row >= 0 && row < rows &&
        board[col][row] === symbol
        ) {
        count++;
        col += dx;
        row += dy;
    }

    return count;
}

class SimpleAI {
    constructor(board, playerSymbol) {
        this.board = board;
        this.playerSymbol = playerSymbol;
        this.opponentSymbol = playerSymbol === 1 ? 0 : 1;
        this.COLS = 7;
        this.ROWS = 6;
    }

    // Основной метод - возвращает номер колонки (0-6)
    getBestMove() {
        // 1. Проверяем, можем ли выиграть следующим ходом
        let winningMove = this.findWinningMove(this.playerSymbol);
        if (winningMove !== -1) return winningMove;

        // 2. Проверяем, не выиграет ли соперник следующим ходом
        let blockingMove = this.findWinningMove(this.opponentSymbol);
        if (blockingMove !== -1) return blockingMove;

        // 3. Проверяем, можем ли создать "двойную угрозу"
        let doubleThreat = this.findDoubleThreat();
        if (doubleThreat !== -1) return doubleThreat;

        // 4. Ищем стратегически выгодные позиции
        let strategicMove = this.findStrategicMove();
        if (strategicMove !== -1) return strategicMove;

        // 5. Возвращаем случайный ход
        return this.getRandomValidMove();
    }

    // Поиск выигрышного хода
    findWinningMove(symbol) {
        for (let col = 0; col < this.COLS; col++) {
            if (this.isColumnFull(col)) continue;

            // Симулируем ход
            const row = this.getFirstEmptyRow(col);
            this.board[col][row] = symbol;

            // Проверяем, привел ли этот ход к победе
            const win = this.checkWin(this.board, col, row, symbol);

            // Отменяем ход
            this.board[col][row] = null;

            if (win) {
                return col;
            }
        }
        return -1;
    }

    // Поиск "двойной угрозы" (когда два направления открыты)
    findDoubleThreat() {
        for (let col = 0; col < this.COLS; col++) {
            if (this.isColumnFull(col)) continue;

            const row = this.getFirstEmptyRow(col);

            // Проверяем несколько направлений
            let threats = 0;

            // Горизонтальные возможности
            if (this.checkHorizontalThreat(col, row, this.playerSymbol)) threats++;
            // Вертикальные возможности (обычно меньше, но важны)
            if (this.checkVerticalThreat(col, row, this.playerSymbol)) threats++;
            // Диагональные возможности
            if (this.checkDiagonalThreat(col, row, this.playerSymbol, 1, 1)) threats++;
            if (this.checkDiagonalThreat(col, row, this.playerSymbol, 1, -1)) threats++;

            if (threats >= 2) {
                return col;
            }
        }
        return -1;
    }

    // Стратегические ходы (центр предпочтительнее)
    findStrategicMove() {
        const columnScores = [1, 2, 3, 4, 3, 2, 1]; // Центр лучше

        // Создаем массив с оценками для каждой колонки
        const moves = [];
        for (let col = 0; col < this.COLS; col++) {
            if (this.isColumnFull(col)) continue;

            let score = columnScores[col];

            // Бонус за создание будущих возможностей
            const row = this.getFirstEmptyRow(col);
            score += this.evaluatePosition(col, row, this.playerSymbol);

            // Штраф за то, что даем сопернику хорошую позицию
            if (row > 0) { // Проверяем позицию под нашим ходом
                const opponentRow = row - 1;
                score -= this.evaluatePosition(col, opponentRow, this.opponentSymbol) * 0.5;
            }

            moves.push({col, score});
        }

        if (moves.length === 0) return -1;

        // Сортируем по убыванию оценки
        moves.sort((a, b) => b.score - a.score);

        // Возвращаем лучшую колонку (иногда рандомизируем среди лучших)
        const topMoves = moves.filter(m => m.score >= moves[0].score * 0.8);
        const randomIndex = Math.floor(Math.random() * topMoves.length);
        return topMoves[randomIndex].col;
    }

    // Оценка позиции
    evaluatePosition(col, row, symbol) {
        let score = 0;

        // Проверяем все направления
        const directions = [
            [1, 0], [0, 1], [1, 1], [1, -1]
        ];

        for (const [dx, dy] of directions) {
            const line = this.getLine(col, row, dx, dy, symbol);
            score += this.evaluateLine(line, symbol);
        }

        return score;
    }

    // Получить линию фишек в направлении
    getLine(startCol, startRow, dx, dy, symbol) {
        const line = [];

        // В обе стороны от текущей позиции
        for (let i = -3; i <= 3; i++) {
            const col = startCol + i * dx;
            const row = startRow + i * dy;

            if (col >= 0 && col < this.COLS && row >= 0 && row < this.ROWS) {
                const cell = this.board[col][row];
                line.push(cell);
            } else {
                line.push('WALL'); // Обозначаем стену
            }
        }

        return line;
    }

    // Оценка линии
    evaluateLine(line, symbol) {
        // Разбиваем линию на группы по 4
        let score = 0;

        for (let i = 0; i <= line.length - 4; i++) {
            const segment = line.slice(i, i + 4);
            score += this.evaluateSegment(segment, symbol);
        }

        return score;
    }

    // Оценка сегмента из 4 клеток
    evaluateSegment(segment, symbol) {
        const opponent = symbol === 'R' ? 'Y' : 'R';

        let myCount = 0;
        let oppCount = 0;
        let emptyCount = 0;

        for (const cell of segment) {
            if (cell === symbol) myCount++;
            else if (cell === opponent) oppCount++;
            else if (cell === null) emptyCount++;
        }

        // Если есть и наши, и чужие фишки - сегмент бесполезен
        if (myCount > 0 && oppCount > 0) return 0;

        // Оценка в зависимости от количества наших фишек
        if (myCount === 4) return 1000; // Победа
        if (myCount === 3 && emptyCount === 1) return 100; // Почти победа
        if (myCount === 2 && emptyCount === 2) return 10; // Хорошая возможность
        if (myCount === 1 && emptyCount === 3) return 1; // Слабая возможность

        // Штрафуем сегменты соперника
        if (oppCount === 3 && emptyCount === 1) return -50; // Почти проигрыш
        if (oppCount === 2 && emptyCount === 2) return -10; // Угроза

        return 0;
    }

    // Проверка угроз по горизонтали
    checkHorizontalThreat(col, row, symbol) {
        let count = 0;
        let openEnds = 0;

        // Проверяем влево
        for (let c = col - 1; c >= 0 && c >= col - 3; c--) {
            if (this.board[c][row] === symbol) count++;
            else if (this.board[c][row] === null) openEnds++;
            else break;
        }

        // Проверяем вправо
        for (let c = col + 1; c < this.COLS && c <= col + 3; c++) {
            if (this.board[c][row] === symbol) count++;
            else if (this.board[c][row] === null) openEnds++;
            else break;
        }

        return count >= 2 && openEnds >= 1;
    }

    // Проверка угроз по вертикали
    checkVerticalThreat(col, row, symbol) {
        // В вертикали проверяем только вниз (вверх не может быть фишек)
        let count = 0;
        for (let r = row - 1; r >= 0 && r >= row - 3; r--) {
            if (this.board[col][r] === symbol) count++;
            else break;
        }
        return count >= 2;
    }

    // Проверка угроз по диагонали
    checkDiagonalThreat(col, row, symbol, dx, dy) {
        let count = 0;
        let openEnds = 0;

        // В одном направлении
        for (let i = 1; i <= 3; i++) {
            const c = col + i * dx;
            const r = row + i * dy;
            if (c < 0 || c >= this.COLS || r < 0 || r >= this.ROWS) break;
            if (this.board[c][r] === symbol) count++;
            else if (this.board[c][r] === null) openEnds++;
            else break;
        }

        // В противоположном направлении
        for (let i = 1; i <= 3; i++) {
            const c = col - i * dx;
            const r = row - i * dy;
            if (c < 0 || c >= this.COLS || r < 0 || r >= this.ROWS) break;
            if (this.board[c][r] === symbol) count++;
            else if (this.board[c][r] === null) openEnds++;
            else break;
        }

        return count >= 2 && openEnds >= 1;
    }

    // Случайный допустимый ход
    getRandomValidMove() {
        const validMoves = [];
        for (let col = 0; col < this.COLS; col++) {
            if (!this.isColumnFull(col)) {
                validMoves.push(col);
            }
        }
        return validMoves.length > 0 ?
            validMoves[Math.floor(Math.random() * validMoves.length)] : -1;
    }

    // Вспомогательные методы
    isColumnFull(col) {
        return this.board[col][0] !== null;
    }

    getFirstEmptyRow(col) {
        for (let row = this.ROWS - 1; row >= 0; row--) {
            if (this.board[col][row] === null) return row;
        }
        return -1;
    }

    // Проверка победы (та же, что и в основной логике)
    checkWin(board, col, row, symbol) {
        const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

        for (const [dx, dy] of directions) {
            let count = 1;

            // В одну сторону
            for (let i = 1; i < 4; i++) {
                const c = col + i * dx;
                const r = row + i * dy;
                if (c < 0 || c >= this.COLS || r < 0 || r >= this.ROWS ||
                    board[c][r] !== symbol) break;
                count++;
            }

            // В другую сторону
            for (let i = 1; i < 4; i++) {
                const c = col - i * dx;
                const r = row - i * dy;
                if (c < 0 || c >= this.COLS || r < 0 || r >= this.ROWS ||
                    board[c][r] !== symbol) break;
                count++;
            }

            if (count >= 4) return true;
        }
        return false;
    }
}

class EnhancedSimpleAI {
    constructor(board, playerSymbol) {
        this.board = board;
        this.playerSymbol = playerSymbol;
        this.opponentSymbol = playerSymbol === 1 ? 0 : 1;
        this.COLS = 7;
        this.ROWS = 6;
    }

    getBestMove() {
        //console.log("AI думает...");

        // 1. Мгновенная победа
        let winningMove = this.findWinningMove(this.playerSymbol);
        if (winningMove !== -1) {
            //console.log("Нашел выигрышный ход:", winningMove);
            return winningMove;
        }

        // 2. Блокировка мгновенной победы соперника
        let blockingMove = this.findWinningMove(this.opponentSymbol);
        if (blockingMove !== -1) {
            //console.log("Блокирую выигрыш соперника:", blockingMove);
            return blockingMove;
        }

        // 3. Блокировка будущих угроз (2-3 хода вперед)
        let threatBlock = this.findAndBlockFutureThreats();
        if (threatBlock !== -1) {
            //console.log("Блокирую будущую угрозу:", threatBlock);
            return threatBlock;
        }

        // 4. Создание двойной угрозы
        let doubleThreat = this.findDoubleThreat();
        if (doubleThreat !== -1) {
            //console.log("Создаю двойную угрозу:", doubleThreat);
            return doubleThreat;
        }

        // 5. Стратегический ход с улучшенной оценкой
        let strategicMove = this.findStrategicMove();
        if (strategicMove !== -1) {
            //console.log("Стратегический ход:", strategicMove);
            return strategicMove;
        }

        // 6. Случайный ход из лучших вариантов
        return this.getRandomValidMove();
    }

    // НОВАЯ ФУНКЦИЯ: Поиск и блокировка будущих угроз
    findAndBlockFutureThreats() {
        // Список приоритетных угроз для блокировки
        const threats = [];

        for (let col = 0; col < this.COLS; col++) {
            if (this.isColumnFull(col)) continue;

            const row = this.getFirstEmptyRow(col);
            if (row === -1) continue;

            // Проверяем, создает ли ход соперника здесь опасную ситуацию
            let threatLevel = this.evaluateOpponentThreat(col, row);

            if (threatLevel > 0) {
                threats.push({col, threatLevel});
            }
        }

        if (threats.length === 0) return -1;

        // Сортируем по уровню угрозы
        threats.sort((a, b) => b.threatLevel - a.threatLevel);

        // Возвращаем колонку с самой высокой угрозой
        return threats[0].col;
    }

    // Оценка угрозы от соперника
    evaluateOpponentThreat(col, row) {
        // Симулируем ход соперника
        this.board[col][row] = this.opponentSymbol;

        let threatScore = 0;

        // 1. Проверяем, дает ли это сопернику двойную угрозу
        threatScore += this.countThreats(col, row, this.opponentSymbol) * 50;

        // 2. Проверяем, создает ли это "открытые" линии для соперника
        threatScore += this.evaluateOpenLines(col, row, this.opponentSymbol) * 30;

        // 3. Особенно опасны угрозы в нижних рядах!
        if (row >= 3) { // Нижние 3 ряда
            threatScore += (6 - row) * 20; // Чем ниже, тем опаснее
        }

        // 4. Проверяем, можем ли мы потом заблокировать эту угрозу
        // (если не можем - угроза очень высокая)
        const canWeBlock = this.canBlockFutureThreat(col, row);
        if (!canWeBlock) {
            threatScore += 100;
        }

        // Отменяем симуляцию
        this.board[col][row] = null;

        return threatScore;
    }

    // Подсчет угроз от позиции
    countThreats(col, row, symbol) {
        let threatCount = 0;
        const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

        for (const [dx, dy] of directions) {
            // Проверяем линию в обе стороны
            let line = [];

            // Собираем 7 клеток в линии
            for (let i = -3; i <= 3; i++) {
                const c = col + i * dx;
                const r = row + i * dy;

                if (c >= 0 && c < this.COLS && r >= 0 && r < this.ROWS) {
                    line.push(this.board[c][r]);
                } else {
                    line.push('WALL');
                }
            }

            // Проверяем все возможные четверки в этой линии
            for (let i = 0; i <= 3; i++) {
                const segment = line.slice(i, i + 4);
                if (this.isDangerousSegment(segment, symbol)) {
                    threatCount++;
                }
            }
        }

        return threatCount;
    }

    // Опасный сегмент для соперника
    isDangerousSegment(segment, symbol) {
        let symbolCount = 0;
        let emptyCount = 0;

        for (const cell of segment) {
            if (cell === symbol) symbolCount++;
            else if (cell === null) emptyCount++;
            else if (cell !== 'WALL') return false; // Есть чужая фишка
        }

        // Опасен, если 2-3 фишки соперника и есть пустые клетки
        return (symbolCount >= 2 && emptyCount >= 1 && symbolCount + emptyCount === 4);
    }

    // Оценка открытых линий
    evaluateOpenLines(col, row, symbol) {
        let openLines = 0;
        const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

        for (const [dx, dy] of directions) {
            const hasOpenEnds = this.checkOpenEnds(col, row, dx, dy, symbol);
            if (hasOpenEnds) openLines++;
        }

        return openLines;
    }

    // Проверка открытых концов линии
    checkOpenEnds(col, row, dx, dy, symbol) {
        // Проверяем в одну сторону
        let open1 = false;
        for (let i = 1; i <= 3; i++) {
            const c = col + i * dx;
            const r = row + i * dy;

            if (c < 0 || c >= this.COLS || r < 0 || r >= this.ROWS) {
                break; // Стена
            }

            if (this.board[c][r] === null) {
                open1 = true;
                break;
            } else if (this.board[c][r] !== symbol) {
                break; // Чужая фишка
            }
        }

        // Проверяем в другую сторону
        let open2 = false;
        for (let i = 1; i <= 3; i++) {
            const c = col - i * dx;
            const r = row - i * dy;

            if (c < 0 || c >= this.COLS || r < 0 || r >= this.ROWS) {
                break;
            }

            if (this.board[c][r] === null) {
                open2 = true;
                break;
            } else if (this.board[c][r] !== symbol) {
                break;
            }
        }

        return open1 || open2;
    }

    // Можем ли мы заблокировать угрозу в будущем
    canBlockFutureThreat(threatCol, threatRow) {
        // Проверяем соседние колонки
        for (let col = Math.max(0, threatCol - 1); col <= Math.min(this.COLS - 1, threatCol + 1); col++) {
            if (col === threatCol) continue;

            if (!this.isColumnFull(col)) {
                const row = this.getFirstEmptyRow(col);

                // Если можем поставить свою фишку рядом
                this.board[col][row] = this.playerSymbol;

                // Проверяем, блокирует ли это угрозу
                this.board[threatCol][threatRow] = this.opponentSymbol;
                const stillThreat = this.countThreats(threatCol, threatRow, this.opponentSymbol) > 0;
                this.board[threatCol][threatRow] = null;

                this.board[col][row] = null;

                if (!stillThreat) {
                    return true; // Можем заблокировать
                }
            }
        }

        return false;
    }

    // Улучшенная стратегическая оценка
    findStrategicMove() {
        const columnScores = [1, 2, 3, 4, 3, 2, 1];
        const moves = [];

        for (let col = 0; col < this.COLS; col++) {
            if (this.isColumnFull(col)) continue;

            const row = this.getFirstEmptyRow(col);
            let score = columnScores[col];

            // Бонус за создание своих возможностей
            score += this.evaluatePosition(col, row, this.playerSymbol) * 2;

            // Штраф за создание возможностей сопернику (ВАЖНО!)
            score -= this.evaluatePosition(col, row, this.opponentSymbol) * 3;

            // Особый штраф за "подставу" в нижнем ряду
            if (row === 5) { // Самый нижний ряд
                // Проверяем, не откроем ли мы сопернику линию
                if (this.wouldGiveBottomLine(col, row)) {
                    score -= 100;
                }
            }

            // Бонус за ходы рядом со своими фишками
            score += this.getAdjacentBonus(col, row, this.playerSymbol);

            // Штраф за ходы рядом с фишками соперника (кроме блокировки)
            score -= this.getAdjacentBonus(col, row, this.opponentSymbol) * 0.5;

            moves.push({col, score});
        }

        if (moves.length === 0) return -1;

        moves.sort((a, b) => b.score - a.score);

        // Логируем оценки для отладки
        //console.log("Оценки ходов:", moves);

        // Берем лучший ход, но иногда рандомизируем среди топ-3
        const topMoves = moves.slice(0, 3);
        const randomIndex = Math.floor(Math.random() * topMoves.length);
        return topMoves[randomIndex].col;
    }

    // Проверяем, откроем ли сопернику нижнюю линию
    wouldGiveBottomLine(col, row) {
        if (row !== 5) return false; // Только нижний ряд

        // Симулируем наш ход
        this.board[col][row] = this.playerSymbol;

        // Проверяем все горизонтали в нижнем ряду
        let wouldGive = false;
        for (let startCol = 0; startCol <= 3; startCol++) {
            const segment = [
                this.board[startCol][5],
                this.board[startCol + 1][5],
                this.board[startCol + 2][5],
                this.board[startCol + 3][5]
            ];

            // Если в сегменте 3 пустых и 1 наша - опасно!
            let emptyCount = 0;
            let myCount = 0;

            for (const cell of segment) {
                if (cell === null) emptyCount++;
                else if (cell === this.playerSymbol) myCount++;
            }

            if (emptyCount === 3 && myCount === 1) {
                // Проверяем, может ли соперник завершить эту линию
                for (let c = startCol; c < startCol + 4; c++) {
                    if (this.board[c][5] === null && !this.isColumnFull(c)) {
                        // Симулируем ход соперника
                        this.board[c][5] = this.opponentSymbol;
                        const wins = this.checkWin(this.board, c, 5, this.opponentSymbol);
                        this.board[c][5] = null;

                        if (wins) {
                            wouldGive = true;
                            break;
                        }
                    }
                }
            }

            if (wouldGive) break;
        }

        // Отменяем симуляцию
        this.board[col][row] = null;

        return wouldGive;
    }

    // Бонус за ходы рядом со своими фишками
    getAdjacentBonus(col, row, symbol) {
        let bonus = 0;
        const directions = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]];

        for (const [dx, dy] of directions) {
            const c = col + dx;
            const r = row + dy;

            if (c >= 0 && c < this.COLS && r >= 0 && r < this.ROWS) {
                if (this.board[c][r] === symbol) {
                    bonus += 5;

                    // Дополнительный бонус за создание цепочек
                    if (dx !== 0 && dy !== 0) { // Диагональ
                        bonus += 3;
                    }
                }
            }
        }

        return bonus;
    }

    // Остальные методы такие же, как в оригинальном SimpleAI
    findWinningMove(symbol) {
        for (let col = 0; col < this.COLS; col++) {
            if (this.isColumnFull(col)) continue;

            const row = this.getFirstEmptyRow(col);
            this.board[col][row] = symbol;

            const win = this.checkWin(this.board, col, row, symbol);

            this.board[col][row] = null;

            if (win) return col;
        }
        return -1;
    }

    findDoubleThreat() {
        for (let col = 0; col < this.COLS; col++) {
            if (this.isColumnFull(col)) continue;

            const row = this.getFirstEmptyRow(col);
            let threats = 0;

            if (this.checkHorizontalThreat(col, row, this.playerSymbol)) threats++;
            if (this.checkVerticalThreat(col, row, this.playerSymbol)) threats++;
            if (this.checkDiagonalThreat(col, row, this.playerSymbol, 1, 1)) threats++;
            if (this.checkDiagonalThreat(col, row, this.playerSymbol, 1, -1)) threats++;

            if (threats >= 2) return col;
        }
        return -1;
    }

    // ... остальные вспомогательные методы без изменений ...
    isColumnFull(col) {
        return this.board[col][0] !== null;
    }

    getFirstEmptyRow(col) {
        for (let row = this.ROWS - 1; row >= 0; row--) {
            if (this.board[col][row] === null) return row;
        }
        return -1;
    }

    checkWin(board, col, row, symbol) {
        const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

        for (const [dx, dy] of directions) {
            let count = 1;

            for (let i = 1; i < 4; i++) {
                const c = col + i * dx;
                const r = row + i * dy;
                if (c < 0 || c >= this.COLS || r < 0 || r >= this.ROWS ||
                    board[c][r] !== symbol) break;
                count++;
            }

            for (let i = 1; i < 4; i++) {
                const c = col - i * dx;
                const r = row - i * dy;
                if (c < 0 || c >= this.COLS || r < 0 || r >= this.ROWS ||
                    board[c][r] !== symbol) break;
                count++;
            }

            if (count >= 4) return true;
        }
        return false;
    }

    getRandomValidMove() {
        const validMoves = [];
        for (let col = 0; col < this.COLS; col++) {
            if (!this.isColumnFull(col)) validMoves.push(col);
        }
        return validMoves.length > 0 ?
            validMoves[Math.floor(Math.random() * validMoves.length)] : -1;
    }
}

function connect4GetBestMoveSimple(board, playerSymbol) {
    return new SimpleAI(board, playerSymbol).getBestMove();
}

function connect4GetBestMoveEnhancedSimple(board, playerSymbol) {
    return new EnhancedSimpleAI(board, playerSymbol).getBestMove();
}

const connect4ConvertFlatBoardTo2D = flat =>
    [...Array(7)].map((_, col) =>
        [...Array(6)].map((_, row) =>
            flat[row * 7 + col]
        )
    );

const connect4Convert2dBoardToFlat = server =>
    [].concat(...[...Array(6)].map((_, row) =>
        [...Array(7)].map((_, col) =>
            server[col][row]
        )
    ));

function connect4CompressBoard(boardArray) {
    // Конвертируем в строку:
    // null → '.', 0 → '0', 1 → '1'
    let str = '';
    for (let i = 0; i < 42; i++) {
        const cell = boardArray[i];
        if (cell === null) str += '.';
        else if (cell === 0) str += '0';
        else str += '1'; // cell === 1
    }

    // Сжимаем простым RLE (Run-Length Encoding)
    let compressed = '';
    let count = 1;
    let current = str[0];

    for (let i = 1; i < str.length; i++) {
        if (str[i] === current && count < 9) {
            count++;
        } else {
            compressed += current + count;
            current = str[i];
            count = 1;
        }
    }
    compressed += current + count;

    return compressed; // Пример: ".42031201..." - примерно 20 символов
}

function connect4DecompressBoard(compressedStr) {
    const board = new Array(42).fill(null);
    let index = 0;

    for (let i = 0; i < compressedStr.length; i += 2) {
        const char = compressedStr[i];
        const count = parseInt(compressedStr[i + 1], 10);

        let value;
        switch(char) {
            case '.': value = null; break;
            case '0': value = 0; break;
            case '1': value = 1; break;
            default: value = null;
        }

        for (let j = 0; j < count && index < 42; j++) {
            board[index++] = value;
        }
    }

    return board;
}

function connect4FindAllWins(board, symbol) {
    // board - flat array из 42 элементов (7x6)
    // symbol - 0 или 1

    const winningCombinations = [];

    // 1. Горизонтальные линии (6 рядов × 4 комбинации в ряду = 24)
    for (let row = 0; row < 6; row++) {
        for (let startCol = 0; startCol <= 3; startCol++) {
            const indices = [
                row * 7 + startCol,
                row * 7 + startCol + 1,
                row * 7 + startCol + 2,
                row * 7 + startCol + 3
            ];

            // Проверяем, что все 4 клетки содержат symbol
            if (indices.every(idx => board[idx] === symbol)) {
                const positions = indices.map(idx => [
                    idx % 7,           // col
                    Math.floor(idx / 7) // row
                ]);

                winningCombinations.push({
                    type: 'horizontal',
                    row: row,
                    startCol: startCol,
                    indices: indices,
                    positions: positions
                });
            }
        }
    }

    // 2. Вертикальные линии (7 колонок × 3 комбинации = 21)
    for (let col = 0; col < 7; col++) {
        for (let startRow = 0; startRow <= 2; startRow++) {
            const indices = [
                startRow * 7 + col,
                (startRow + 1) * 7 + col,
                (startRow + 2) * 7 + col,
                (startRow + 3) * 7 + col
            ];

            if (indices.every(idx => board[idx] === symbol)) {
                const positions = indices.map(idx => [
                    idx % 7,
                    Math.floor(idx / 7)
                ]);

                winningCombinations.push({
                    type: 'vertical',
                    col: col,
                    startRow: startRow,
                    indices: indices,
                    positions: positions
                });
            }
        }
    }

    // 3. Диагонали вниз-вправо ↘ (4×3 = 12)
    for (let col = 0; col <= 3; col++) {
        for (let row = 0; row <= 2; row++) {
            const indices = [
                row * 7 + col,
                (row + 1) * 7 + col + 1,
                (row + 2) * 7 + col + 2,
                (row + 3) * 7 + col + 3
            ];

            if (indices.every(idx => board[idx] === symbol)) {
                const positions = indices.map(idx => [
                    idx % 7,
                    Math.floor(idx / 7)
                ]);

                winningCombinations.push({
                    type: 'diagonal_down',
                    startCol: col,
                    startRow: row,
                    indices: indices,
                    positions: positions
                });
            }
        }
    }

    // 4. Диагонали вверх-вправо ↙ (4×3 = 12)
    for (let col = 0; col <= 3; col++) {
        for (let row = 3; row < 6; row++) {
            const indices = [
                row * 7 + col,
                (row - 1) * 7 + col + 1,
                (row - 2) * 7 + col + 2,
                (row - 3) * 7 + col + 3
            ];

            if (indices.every(idx => board[idx] === symbol)) {
                const positions = indices.map(idx => [
                    idx % 7,
                    Math.floor(idx / 7)
                ]);

                winningCombinations.push({
                    type: 'diagonal_up',
                    startCol: col,
                    startRow: row,
                    indices: indices,
                    positions: positions
                });
            }
        }
    }

    return {
        win: winningCombinations.length > 0,
        combinations: winningCombinations,
        // Для обратной совместимости - все выигрышные позиции
        positions: winningCombinations.flatMap(combo => combo.positions),
        // Уникальные позиции (без дубликатов, если несколько комбинаций пересекаются)
        uniquePositions: Array.from(new Set(
            winningCombinations.flatMap(combo => combo.indices)
        )).sort((a, b) => a - b)
    };
}

export {
    connect4CreateBoard,
    connect4MakeMove,
    connect4GetBestMoveSimple,
    connect4GetBestMoveEnhancedSimple,
    connect4ConvertFlatBoardTo2D,
    connect4Convert2dBoardToFlat,
    connect4CompressBoard,
    connect4DecompressBoard,
    connect4FindAllWins
};