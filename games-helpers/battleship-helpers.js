const calculateCells = (ship) => {
    const cells = [];
    if (ship.direction === 'horizontal') {
        for (let i = 0; i < ship.length; i++) {
            cells.push({x: ship.x + i, y: ship.y});
        }
    } else { // vertical
        for (let i = 0; i < ship.length; i++) {
            cells.push({x: ship.x, y: ship.y + i});
        }
    }
    return cells;
}

const getShipBounds = (ship) => {
    if (ship.direction === 'horizontal') {
        return {
            minX: ship.x,
            maxX: ship.x + ship.length - 1,
            minY: ship.y,
            maxY: ship.y
        };
    } else {
        return {
            minX: ship.x,
            maxX: ship.x,
            minY: ship.y,
            maxY: ship.y + ship.length - 1
        };
    }
}

// Function to check if two ships intersect or are too close
const shipsIntersect = (ship1, ship2, requireSpacing = true) => {
    // Quick bounding box check for efficiency
    const bounds1 = getShipBounds(ship1);
    const bounds2 = getShipBounds(ship2);

    // Expand bounds if spacing is required
    const expandAmount = requireSpacing ? 1 : 0;
    const expBounds1 = {
        minX: Math.max(0, bounds1.minX - expandAmount),
        maxX: Math.min(9, bounds1.maxX + expandAmount),
        minY: Math.max(0, bounds1.minY - expandAmount),
        maxY: Math.min(9, bounds1.maxY + expandAmount)
    };

    const expBounds2 = {
        minX: Math.max(0, bounds2.minX - expandAmount),
        maxX: Math.min(9, bounds2.maxX + expandAmount),
        minY: Math.max(0, bounds2.minY - expandAmount),
        maxY: Math.min(9, bounds2.maxY + expandAmount)
    };

    // If bounding boxes don't overlap, ships don't intersect
    if (expBounds1.maxX < expBounds2.minX ||
        expBounds1.minX > expBounds2.maxX ||
        expBounds1.maxY < expBounds2.minY ||
        expBounds1.minY > expBounds2.maxY) {
        return false;
    }

    // Detailed check for intersection or proximity
    const cells1 = calculateCells(ship1);
    const cells2 = calculateCells(ship2);

    for (const cell1 of cells1) {
        for (const cell2 of cells2) {
            // Check if cells occupy the same position
            if (cell1.x === cell2.x && cell1.y === cell2.y) {
                return true; // Direct collision
            }

            // Check spacing if required
            if (requireSpacing) {
                const dx = Math.abs(cell1.x - cell2.x);
                const dy = Math.abs(cell1.y - cell2.y);

                // If cells are adjacent or diagonal (distance <= 1 in both axes)
                if (dx <= 1 && dy <= 1) {
                    return true; // Too close (violates spacing rule)
                }
            }
        }
    }

    return false;
}

// Function to check if a ship is valid (within grid)
function isValidShip(ship) {
    if (ship.x < 0 || ship.y < 0 || ship.x > 9 || ship.y > 9) {
        return false;
    }

    if (ship.direction === 'horizontal') {
        return ship.x + ship.length - 1 <= 9;
    } else { // vertical
        return ship.y + ship.length - 1 <= 9;
    }
}

// Function to check intersection of multiple ships
const checkShipsIntersection = (ships, requireSpacing = true) => {
    const results = {
        valid: true,
        intersections: [],
        invalidShips: []
    };

    // First check if all ships are within grid
    for (let i = 0; i < ships.length; i++) {
        if (!isValidShip(ships[i])) {
            results.valid = false;
            results.invalidShips.push({
                shipIndex: i,
                reason: 'Ship extends beyond grid boundaries'
            });
        }
    }

    // Check pairwise intersections
    for (let i = 0; i < ships.length; i++) {
        for (let j = i + 1; j < ships.length; j++) {
            if (shipsIntersect(ships[i], ships[j], requireSpacing)) {
                results.valid = false;
                results.intersections.push({
                    ship1Index: i,
                    ship2Index: j,
                    ships: [ships[i], ships[j]]
                });
            }
        }
    }

    return results;
}

const markMissesAroundShip = (ship, hits) => {
    const shipCells = calculateCells(ship);

    shipCells.forEach(cell => {
        const x = cell.x;
        const y = cell.y;

        // Check all 8 surrounding cells
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const adjX = x + dx;
                const adjY = y + dy;

                // Check bounds
                if (adjX >= 0 && adjX < 10 && adjY >= 0 && adjY < 10) {
                    const adjIndex = adjY * 10 + adjX;

                    // Mark as miss only if it's water (0)
                    if (hits[adjIndex] === 0) {
                        hits[adjIndex] = 1;
                    }
                }
            }
        }
    });
}

function isShipSunk(ship, hits) {
    // ship: {x, y, length, direction}
    // hits: array[100] of 0,1,2

    const isVertical = ship.direction === 'vertical';

    for (let i = 0; i < ship.length; i++) {
        const x = isVertical ? ship.x : ship.x + i;
        const y = isVertical ? ship.y + i : ship.y;
        const index = y * 10 + x;  // Вот индекс!

        // If any cell is not hit (not 2), ship is not sunk
        if (hits[index] !== 2) {
            return false;
        }
    }

    return true;
}

// Check if a move hits any ship and return detailed result
function checkMove(ships, moveX, moveY, hits) {
    const targetXyIndex = moveY * 10 + moveX;
    let s = JSON.parse(JSON.stringify(ships));
    let h = JSON.parse(JSON.stringify(hits)); // array of 100 elements with values of 0, 1 and 2. 0 - empty water, 1 - miss, 2 - hit
    let hitShipIndex = -1;
    let isSank = false;

    // Check each ship
    for (let i = 0; i < s.length; i++) {
        s[i].cells.forEach((cell, index) => {
            if (cell.x === moveX && cell.y === moveY) {
                //s[i].cells[index].hit = 1;
                hitShipIndex = i;
            }
        });
        if (hitShipIndex > -1) {
            break;
        }
    }

    if (hitShipIndex > -1) {
        h[targetXyIndex] = 2;
        if (isShipSunk(s[hitShipIndex], h)) {
            s[hitShipIndex].isSank = true;
            isSank = true;
            markMissesAroundShip(s[hitShipIndex], h);
        }
    } else {
        h[targetXyIndex] = 1;
    }

    return {
        isHit: hitShipIndex > -1,
        isSank: isSank,
        isGameOver: s.length === s.filter(el => el.isSank === true).length,
        ships: s,
        hits: h,
    };
}

const generateRandomShips = () => {
    const gridSize = 10;
    const ships = [
        {length: 5, placed: false},
        {length: 3, placed: false},
        {length: 3, placed: false},
        {length: 2, placed: false},
        {length: 2, placed: false},
        {length: 1, placed: false}
    ];

    // Create grid tracking arrays
    const shipGrid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
    const spacingGrid = Array(gridSize).fill().map(() => Array(gridSize).fill(false));

    // Directions: 0=horizontal, 1=vertical
    const directions = [
        {dx: 1, dy: 0},  // right
        {dx: 0, dy: 1}   // down
    ];

    // Function to check if a placement is valid
    function canPlaceShip(x, y, length, direction) {
        const {dx, dy} = directions[direction];

        // Check if ship fits within grid
        if (x + (length - 1) * dx >= gridSize || y + (length - 1) * dy >= gridSize) {
            return false;
        }

        // Check each cell for overlap and spacing
        for (let i = 0; i < length; i++) {
            const checkX = x + i * dx;
            const checkY = y + i * dy;

            // Check if cell is already occupied
            if (shipGrid[checkY][checkX] !== 0) {
                return false;
            }

            // Check surrounding cells for spacing (including diagonals)
            for (let dy2 = -1; dy2 <= 1; dy2++) {
                for (let dx2 = -1; dx2 <= 1; dx2++) {
                    const adjX = checkX + dx2;
                    const adjY = checkY + dy2;

                    if (adjX >= 0 && adjX < gridSize && adjY >= 0 && adjY < gridSize) {
                        if (shipGrid[adjY][adjX] !== 0) {
                            return false;
                        }
                    }
                }
            }
        }

        return true;
    }

    // Function to place a ship on the grid
    function placeShip(x, y, length, direction, shipId) {
        const {dx, dy} = directions[direction];

        for (let i = 0; i < length; i++) {
            const placeX = x + i * dx;
            const placeY = y + i * dy;

            // Mark ship cell
            shipGrid[placeY][placeX] = shipId;

            // Mark spacing buffer cells
            for (let dy2 = -1; dy2 <= 1; dy2++) {
                for (let dx2 = -1; dx2 <= 1; dx2++) {
                    const bufferX = placeX + dx2;
                    const bufferY = placeY + dy2;

                    if (bufferX >= 0 && bufferX < gridSize && bufferY >= 0 && bufferY < gridSize) {
                        spacingGrid[bufferY][bufferX] = true;
                    }
                }
            }
        }
    }

    // Try to place all ships
    let attempts = 0;
    const maxAttempts = 1000;

    for (let shipIndex = 0; shipIndex < ships.length; shipIndex++) {
        let placed = false;
        let attemptCount = 0;

        while (!placed && attemptCount < 100) {
            attemptCount++;
            attempts++;

            if (attempts > maxAttempts) {
                // Reset and try again if we get stuck
                return generateRandomShips();
            }

            // Random position and direction
            const x = Math.floor(Math.random() * gridSize);
            const y = Math.floor(Math.random() * gridSize);
            const direction = Math.floor(Math.random() * 2);

            if (canPlaceShip(x, y, ships[shipIndex].length, direction)) {
                placeShip(x, y, ships[shipIndex].length, direction, shipIndex + 1);
                ships[shipIndex].placed = true;
                ships[shipIndex].x = x;
                ships[shipIndex].y = y;
                ships[shipIndex].direction = direction;
                placed = true;
            }
        }

        if (!placed) {
            // Reset and try again if we can't place this ship
            return generateRandomShips();
        }
    }

    // Format the output
    const placedShips = ships.map((ship, index) => ({
        length: ship.length,
        x: ship.x,
        y: ship.y,
        direction: ship.direction === 0 ? 'horizontal' : 'vertical',
        cells: (() => {
            const cells = [];
            const {dx, dy} = directions[ship.direction];
            for (let i = 0; i < ship.length; i++) {
                cells.push({
                    x: ship.x + i * dx,
                    y: ship.y + i * dy
                });
            }
            return cells;
        })(),
        isSank: false,
    }));

    return {
        ships: placedShips,
        grid: shipGrid // Optional: returns the grid for visualization
    };
}

function computerShoot(hits) {
    // hits - массив из 100 элементов: 0, 1, 2
    // 0 - не стреляли, 1 - промах, 2 - попадание

    // Находим все индексы, куда еще не стреляли (значение 0)
    const availableCells = [];

    for (let i = 0; i < hits.length; i++) {
        if (hits[i] === 0) {
            availableCells.push(i);
        }
    }

    // Если нет доступных клеток (все уже обстреляны)
    if (availableCells.length === 0) {
        return null; // или можно бросить ошибку
    }

    // Выбираем случайную доступную клетку
    const randomIndex = Math.floor(Math.random() * availableCells.length);
    const cellIndex = availableCells[randomIndex];

    // Преобразуем индекс в координаты (x, y)
    const y = Math.floor(cellIndex / 10); // строка
    const x = cellIndex % 10;            // столбец

    return {
        x: x,
        y: y,
        index: cellIndex
    };
}

// Улучшенная версия с "умной" логикой
function smartComputerShoot(hits) {
    const hitsString = hits.join(''); // Преобразуем в строку для удобства

    // Стратегия 1: Если есть раненый корабль, стреляем вокруг него
    const nextToHit = findCellNextToHit(hitsString);
    if (nextToHit) {
        return nextToHit;
    }

    // Стратегия 2: Случайный выстрел, но с приоритетом определенных клеток
    return randomShootWithPattern(hitsString);
}

// Найти клетку рядом с попаданием (для добивания корабля)
function findCellNextToHit(hitsString) {
    for (let i = 0; i < hitsString.length; i++) {
        if (hitsString[i] === '2') { // Нашли попадание
            const y = Math.floor(i / 10);
            const x = i % 10;

            // Проверяем 4 направления (вверх, вниз, влево, вправо)
            const directions = [
                {dx: 0, dy: -1}, // вверх
                {dx: 1, dy: 0},  // вправо
                {dx: 0, dy: 1},  // вниз
                {dx: -1, dy: 0}  // влево
            ];

            // Перемешиваем направления для случайности
            shuffleArray(directions);

            for (const dir of directions) {
                const newX = x + dir.dx;
                const newY = y + dir.dy;

                if (newX >= 0 && newX < 10 && newY >= 0 && newY < 10) {
                    const newIndex = newY * 10 + newX;

                    // Если клетка не обстреляна (0) - стреляем туда
                    if (hitsString[newIndex] === '0') {
                        return {
                            x: newX,
                            y: newY,
                            index: newIndex,
                            reason: 'next_to_hit'
                        };
                    }
                }
            }
        }
    }

    return null;
}

// Случайный выстрел с паттерном (через клетку для поиска крупных кораблей)
function randomShootWithPattern(hitsString) {
    const availableCells = [];
    const patternCells = []; // Клетки по паттерну (через одну)

    for (let i = 0; i < hitsString.length; i++) {
        if (hitsString[i] === '0') {
            const y = Math.floor(i / 10);
            const x = i % 10;

            // Паттерн: стреляем в клетки где оба индекса четные или оба нечетные
            // Это помогает быстрее находить крупные корабди
            if ((x % 2 === 0 && y % 2 === 0) || (x % 2 === 1 && y % 2 === 1)) {
                patternCells.push(i);
            } else {
                availableCells.push(i);
            }
        }
    }

    // Сначала пытаемся выстрелить по паттерну
    let targetCells = patternCells.length > 0 ? patternCells : availableCells;

    if (targetCells.length === 0) {
        // Если все клетки по паттерну уже обстреляны, стреляем в оставшиеся
        for (let i = 0; i < hitsString.length; i++) {
            if (hitsString[i] === '0') {
                targetCells.push(i);
            }
        }
    }

    if (targetCells.length === 0) {
        return null; // Все клетки обстреляны
    }

    const randomIndex = Math.floor(Math.random() * targetCells.length);
    const cellIndex = targetCells[randomIndex];
    const y = Math.floor(cellIndex / 10);
    const x = cellIndex % 10;

    return {
        x: x,
        y: y,
        index: cellIndex,
        reason: patternCells.includes(cellIndex) ? 'pattern' : 'random'
    };
}

// Вспомогательная функция для перемешивания массива
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const getRandomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const compressShips = (ships) => {
    return ships.map(ship => [
        ship.x,                    // 0: x coordinate (0-9)
        ship.y,                    // 1: y coordinate (0-9)
        ship.length,               // 2: length (1-5)
        ship.direction === 'vertical' ? 1 : 0, // 3: direction
        ship.isSank ? 1 : 0        // 4: sunk status (optional)
    ]);
}

const decompressShips = (compressed) => {
    let ship = compressed.map(ship => ({
        x: ship[0],
        y: ship[1],
        length: ship[2],
        direction: ship[3] === 1 ? 'vertical' : 'horizontal',
        isSank: ship[4] === 1,
        cells: calculateCells({
            x: ship[0],
            y: ship[1],
            length: ship[2],
            direction: ship[3] === 1 ? 'vertical' : 'horizontal',
        }),
    }));
    return ship;
}

// Server
function compressHits(hitsArray) {
    // 0=water, 1=miss, 2=hit → use 2 bits per cell
    let binaryStr = '';
    for (let i = 0; i < hitsArray.length; i += 4) {
        let byte = 0;
        for (let j = 0; j < 4 && i + j < hitsArray.length; j++) {
            byte |= (hitsArray[i + j] & 3) << (j * 2); // 2 bits per cell
        }
        binaryStr += String.fromCharCode(byte + 32); // Use printable chars
    }
    return binaryStr; // ~25 chars instead of 100 numbers
}

// Client
function decompressHits(compressedStr) {
    const hits = new Array(100).fill(0);
    for (let i = 0; i < compressedStr.length; i++) {
        const byte = compressedStr.charCodeAt(i) - 32;
        for (let j = 0; j < 4 && i * 4 + j < 100; j++) {
            hits[i * 4 + j] = (byte >> (j * 2)) & 3;
        }
    }
    return hits;
}

export {
    calculateCells,
    shipsIntersect,
    isValidShip,
    checkShipsIntersection,
    checkMove,
    generateRandomShips,
    smartComputerShoot,
    getRandomInt,
    compressShips,
    decompressShips,
    compressHits,
    decompressHits
};