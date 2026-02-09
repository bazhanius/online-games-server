require('dotenv').config();
const {v4: uuidv4} = require('uuid');

const app = require('express')();

const server = require('http').createServer(app);
const {Server} = require('socket.io');
//const {parse} = require('cookie');

const {Chess} = require('chess.js');
const {
    battleshipCheckMove,
    battleshipGenerateRandomShips,
    battleshipCompressShips,
    battleshipCompressHits,
    battleshipDecompressShips,
    battleshipDecompressHits
} = require('./games-helpers/battleship-helpers');
const {
    reversiCreateInitialBoard,
    reversiCompressBoard,
    reversiDecompressBoard,
    reversiUpdateBoard,
    reversiFindAvailableMoves
} = require('./games-helpers/reversi-helpers');
const {
    connect4CreateBoard,
    connect4MakeMove,
    connect4ConvertFlatBoardTo2D,
    connect4Convert2dBoardToFlat,
    connect4CompressBoard,
    connect4DecompressBoard
} = require('./games-helpers/connect4-helpers');

const log4js = require('log4js');
log4js.configure({
    appenders: {
        out: {type: "stdout"},
        //app: { type: "file", filename: "application.log" },
    },
    categories: {
        default: {appenders: ["out"], level: "debug"},
    },
});

const logger = log4js.getLogger();

const port = process.env.PORT || 8484;
const host = process.env.HOST || '127.0.0.1';

const io = new Server(server, {
    cors: {
        origin: "*"
    },
    transports: ['websocket', 'polling']
});

const ipConnections = {}; // Stores { 'IP_ADDRESS': count }


/**
 *  GAMES
 */

const games = {};

const addGame = (sid, login, gameId, token, mode, name) => {

    // receive requests only from valid user token and gameId
    if (
        gameId in games // game already exist somehow
        || !(login in users) // wrong login
        || users[login].token !== token // wrong token
        || !['PvP', 'PvE'].includes(mode) // wrong mode
        || !['chess', 'battleship', 'reversi', 'connect4'].includes(name) // wrong game
    ) return;

    // allow only one game name (chess, battleship etc) at a time, for example only one 'chess' game for user
    for (const game in games) {
        if (
            games[game].name === name // name already exist
            && (games[game].players.white === login || games[game].players.black === login)
        ) {
            return;
        }
    }

    const d_t = new Date();

    games[gameId] = {
        name: name,
        players: {
            white: login,
            black: mode === 'PvP' ? null : 'Computer',
        },
        mode: mode, // PvP or PvE
        moves: {},
        status: mode === 'PvP' ? 'starting' : 'ongoing', // starting → [check] → ongoing → finished
        result: null,
        date: {
            created_at: d_t,
            started_at: mode === 'PvP' ? null : d_t,
        },
    };

    if (name === 'chess') {
        let year = d_t.getFullYear();
        let month = ("0" + (d_t.getMonth() + 1)).slice(-2);
        let day = ("0" + d_t.getDate()).slice(-2);
        let hour = ("0" + d_t.getHours()).slice(-2);
        let minute = ("0" + d_t.getMinutes()).slice(-2);
        let seconds = ("0" + d_t.getSeconds()).slice(-2);
        let chess = new Chess();
        chess.setHeader('Event', 'LAN Chess game on the RZD Media onboard infotainment system')
        chess.setHeader('White', login);
        chess.setHeader('Black', mode === 'PvP' ? null : 'Computer');
        chess.setHeader('Site', 'Moscow, Russia');
        chess.setHeader('Date', year + "." + month + "." + day);
        chess.setHeader('Time', hour + ":" + minute + ":" + seconds);

        games[gameId].moves.pgn = chess.pgn() || ''; // initial state
    }

    if (name === 'battleship') {
        games[gameId].moves = {
            ready_check: {
                white: false,
                black: mode !== 'PvP',
            },
            ships: {
                white: battleshipCompressShips(battleshipGenerateRandomShips().ships),
                black: battleshipCompressShips(battleshipGenerateRandomShips().ships), //mode === 'PvP' ? null : battleshipGenerateRandomShips().ships,
            },
            hits: {
                white: battleshipCompressHits(new Array(100).fill(0)),
                black: battleshipCompressHits(new Array(100).fill(0)),
            },
            last_hit: {
                white: null,
                black: null,
            },
            current_move: 'white', // white always first,
            in_progress: false,
        }
    }

    if (name === 'reversi') {
        games[gameId].moves = {
            board: reversiCompressBoard(reversiCreateInitialBoard()),
            current_move: 'white', // white always first,
            in_progress: false,
        }
    }

    if (name === 'connect4') {
        games[gameId].moves = {
            board: connect4CompressBoard(connect4Convert2dBoardToFlat(connect4CreateBoard())),
            current_move: 'white', // white always first,
            in_progress: false,
        }
    }

    io.sockets.emit('list of games', games);
}

const calcGameResult = (gameId) => {
    if (gameId in games) {

        if (games[gameId].name === 'chess') {
            let chess = new Chess();
            chess.loadPgn(games[gameId].moves.pgn);

            if (chess.isCheckmate()) {
                // There is the winner
                if (chess.turn() === 'w') {
                    games[gameId].result = 'black won';
                } else if (chess.turn() === 'b') {
                    games[gameId].result = 'white won';
                }
            } else if (chess.isDraw() || chess.isStalemate() || chess.isInsufficientMaterial() || chess.isThreefoldRepetition()) {
                // Draw by positions
                games[gameId].result = 'draw';
            } else if (games[gameId].players.black === null && games[gameId].players.white !== null) {
                // Black retired
                games[gameId].result = 'white won';
            } else if (games[gameId].players.black !== null && games[gameId].players.white === null) {
                // White retired
                games[gameId].result = 'black won';
            } else {
                // Draw by time
                games[gameId].result = 'draw';
            }
        }

        if (games[gameId].name === 'battleship') {
            let decompressedHitsWhite = battleshipDecompressHits(games[gameId].moves.hits.white);
            let decompressedHitsBlack = battleshipDecompressHits(games[gameId].moves.hits.black);
            if (decompressedHitsWhite.filter(h => h === 2).length === 16
                && decompressedHitsBlack.filter(h => h === 2).length < 16) {
                games[gameId].result = 'white won';
            } else if (decompressedHitsBlack.filter(h => h === 2).length === 16
                && decompressedHitsWhite.filter(h => h === 2).length < 16) {
                games[gameId].result = 'black won';
            } else if (games[gameId].players.black === null && games[gameId].players.white !== null) {
                // Black retired
                games[gameId].result = 'white won';
            } else if (games[gameId].players.black !== null && games[gameId].players.white === null) {
                // White retired
                games[gameId].result = 'black won';
            } else {
                games[gameId].result = 'draw'; // somehow
            }
        }

        if (games[gameId].name === 'reversi') {
            let decompressBoard = reversiDecompressBoard(games[gameId].moves.board);
            let countWhite = decompressBoard.filter(w => w === 1).length;
            let countBlack = decompressBoard.filter(b => b === 2).length;

            if (games[gameId].players.black === null && games[gameId].players.white !== null) {
                // Black retired
                games[gameId].result = 'white won';
            } else if (games[gameId].players.black !== null && games[gameId].players.white === null) {
                // White retired
                games[gameId].result = 'black won';
            } else if (countWhite > countBlack) {
                games[gameId].result = 'white won';
            } else if (countBlack > countWhite) {
                games[gameId].result = 'black won';
            } else {
                games[gameId].result = 'draw';
            }
        }

        if (games[gameId].name === 'connect4') {
            if (games[gameId].players.black === null && games[gameId].players.white !== null) {
                // Black retired
                games[gameId].result = 'white won';
            } else if (games[gameId].players.black !== null && games[gameId].players.white === null) {
                // White retired
                games[gameId].result = 'black won';
            } else if (countWhite > countBlack) {
                games[gameId].result = 'white won';
            } else if (countBlack > countWhite) {
                games[gameId].result = 'black won';
            } else {
                games[gameId].result = 'draw';
            }
        }

    }
}

const updateGame = (command, gameId, login, token, move = '', name = '') => {
    // receive requests only from valid user token and gameId
    if (gameId in games && login in users && users[login].token === token) {
        let isUpdated = false;
        if (command === 'join' && games[gameId].players.black === null) {
            if (games[gameId].name === 'chess') {
                let chess = new Chess();
                chess.loadPgn(games[gameId].moves.pgn);
                chess.setHeader('Black', login);
                games[gameId].moves.pgn = chess.pgn();
            }
            games[gameId].players.black = login;
            games[gameId].status = 'ongoing';
            games[gameId].date.started_at = new Date();
            isUpdated = true;
        }
        if (command === 'leave') {
            if (games[gameId].players.white === login) {
                games[gameId].players.white = null;
                isUpdated = true;
            } else if (games[gameId].players.black === login) {
                games[gameId].players.black = null;
                isUpdated = true;
            }
            if (isUpdated) {
                if ((games[gameId].players.black === null
                        || games[gameId].players.black === 'Computer')
                    && games[gameId].players.white === null) {
                    // Delete game if no players left
                    delete games[gameId];
                } else {
                    games[gameId].status = 'finished';
                    calcGameResult(gameId);
                }
            }
        }
        if (command === 'update_move'
            // Allow update only from current players
            && (games[gameId].players.white === login || games[gameId].players.black === login)
        ) {

            if (
                name === 'chess'
                && games[gameId].moves.pgn !== move.pgn
                && move.pgn.length > games[gameId].moves.pgn.length
                && games[gameId].status === 'ongoing'
            ) {
                games[gameId].moves.pgn = move.pgn;
                isUpdated = true;
            }

            if (name === 'battleship'
                && games[gameId].status !== 'finished'
                && !games[gameId].moves.in_progress // don't receive events if move is in progress
                //&& ((games[gameId].players.white === login && games[gameId].moves.current_move === 'white')
                //    || (games[gameId].players.black === login && games[gameId].moves.current_move === 'black'))
                //&& move.x >= 0 && move.x <= 9 && move.y >= 0 && move.y <= 9
            ) {

                games[gameId].moves.in_progress = true;

                try {
                    let color = games[gameId].players.white === login
                        ? 'white'
                        : games[gameId].players.black === login
                            ? 'black'
                            : '';
                    if (color === '') return;
                    let opColor = color === 'white' ? 'black' : 'white';

                    if (games[gameId].moves.ready_check.white === false
                        || games[gameId].moves.ready_check.black === false
                    ) {
                        if (move?.ships?.length > 0) {
                            games[gameId].moves.ships[color] = move.ships; // already compressed ships
                            games[gameId].moves.ready_check[color] = true;
                        }
                    }

                    if (games[gameId]['moves']['ready_check']['white'] === true
                        && games[gameId]['moves']['ready_check']['black'] === true
                        && move?.x >= 0 && move?.x <= 9
                        && move?.y >= 0 && move?.y <= 9) {

                        // computer move triggers by player
                        if (games[gameId].moves.current_move === 'black' && games[gameId].players?.black === 'Computer') {
                            color = color === 'white' ? 'black' : 'white';
                            opColor = opColor === 'white' ? 'black' : 'white';
                        }

                        let updatedHitsAndShips = null;
                        try {
                            updatedHitsAndShips = battleshipCheckMove(
                                JSON.parse(JSON.stringify(battleshipDecompressShips(games[gameId].moves.ships[opColor]))),
                                parseInt(move.x),
                                parseInt(move.y),
                                JSON.parse(JSON.stringify(battleshipDecompressHits(games[gameId].moves.hits[color]))),
                            );
                        } catch (error) {
                            logger.error('Error updating board:', error);
                            newBoard = null;
                        }
                        if (updatedHitsAndShips) {
                            // change side on miss
                            if (!updatedHitsAndShips.isHit) {
                                games[gameId].moves.current_move = opColor;
                            }
                            games[gameId].moves.last_hit[color] = move;
                            games[gameId].moves.hits[color] = battleshipCompressHits(updatedHitsAndShips.hits);
                            games[gameId].moves.ships[opColor] = battleshipCompressShips(updatedHitsAndShips.ships);


                            if (updatedHitsAndShips.isGameOver) {
                                games[gameId].status = 'finished';
                                calcGameResult(gameId);
                            }
                        }
                    }

                    isUpdated = true;
                } catch (error) {
                    logger.error('Error processing battleship move:', error);
                } finally {
                    // always reset in_progress, no matter what happens
                    games[gameId].moves.in_progress = false;
                }
            }

            if (name === 'reversi'
                && games[gameId].status !== 'finished'
                && !games[gameId].moves.in_progress) {

                games[gameId].moves.in_progress = true;

                try {
                    let color = games[gameId].players.white === login
                        ? 'white'
                        : games[gameId].players.black === login
                            ? 'black'
                            : '';
                    let opColor = color === 'white' ? 'black' : 'white';

                    // computer move triggers by player
                    if (games[gameId].moves.current_move === 'black' && games[gameId].players?.black === 'Computer') {
                        color = color === 'white' ? 'black' : 'white';
                        opColor = opColor === 'white' ? 'black' : 'white';
                    }

                    if (color === '' || games[gameId].moves.current_move !== color) {
                        return; // But we need to reset in_progress!
                    }

                    let newBoard = null;
                    try {
                        newBoard = reversiUpdateBoard(
                            JSON.parse(JSON.stringify(reversiDecompressBoard(games[gameId].moves.board))),
                            move,
                            color
                        );
                    } catch (error) {
                        logger.error('Error updating board:', error);
                        newBoard = null;
                    }

                    if (newBoard) {
                        games[gameId].moves.board = reversiCompressBoard(JSON.parse(JSON.stringify(newBoard)));

                        if (newBoard.filter(cell => cell === 0).length === 0) {
                            games[gameId].status = 'finished';
                            calcGameResult(gameId);
                        }
                    }

                    if (games[gameId].status !== 'finished') {
                        // Change color to opposite if opposite can move
                        let opAvailableMoves = reversiFindAvailableMoves(
                            reversiDecompressBoard(games[gameId].moves.board),
                            opColor
                        );
                        let availableMoves = reversiFindAvailableMoves(
                            reversiDecompressBoard(games[gameId].moves.board),
                            color
                        );

                        if (opAvailableMoves) {
                            // opponent move if possible
                            games[gameId].moves.current_move = opColor;
                        } else if (availableMoves) {
                            // side remain still if opponent have no possible moves
                            games[gameId].moves.current_move = color;
                        } else {
                            // both players have no moves
                            games[gameId].status = 'finished';
                            calcGameResult(gameId);
                        }
                    }
                    isUpdated = true;
                } catch
                    (error) {
                    logger.error('Error processing reversi move:', error);
                } finally {
                    // always reset in_progress, no matter what happens
                    games[gameId].moves.in_progress = false;
                }
            }

            if (name === 'connect4'
                && games[gameId].status !== 'finished'
                && !games[gameId].moves.in_progress) {

                games[gameId].moves.in_progress = true;

                try {
                    let color = games[gameId].players.white === login
                        ? 'white'
                        : games[gameId].players.black === login
                            ? 'black'
                            : '';
                    let opColor = color === 'white' ? 'black' : 'white';

                    // computer move triggers by player
                    if (games[gameId].moves.current_move === 'black' && games[gameId].players?.black === 'Computer') {
                        color = color === 'white' ? 'black' : 'white';
                        opColor = opColor === 'white' ? 'black' : 'white';
                    }

                    if (color === '' || games[gameId].moves.current_move !== color) {
                        return; // But we need to reset in_progress!
                    }

                    let newBoard = null;
                    try {
                        newBoard = connect4MakeMove(
                            connect4ConvertFlatBoardTo2D(connect4DecompressBoard(games[gameId].moves.board)),
                            move.column,
                            color
                        );
                    } catch (error) {
                        logger.error('Error updating board:', error);
                        newBoard = null;
                    }

                    if (newBoard && newBoard.success) {
                        games[gameId].moves.board = connect4CompressBoard(connect4Convert2dBoardToFlat(newBoard.board));

                        if (newBoard.isDraw || newBoard.isWin) {
                            games[gameId].status = 'finished';
                            if (newBoard.isDraw) {
                                games[gameId].result = 'draw';
                            }
                            if (newBoard.isWin) {
                                games[gameId].result = `${color} won`;
                            }
                        } else {
                            games[gameId].moves.current_move = opColor;
                        }
                    }

                    isUpdated = true;
                } catch
                    (error) {
                    logger.error('Error processing connect4 move:', error);
                } finally {
                    // always reset in_progress, no matter what happens
                    games[gameId].moves.in_progress = false;
                }
            }

        }
        if (command === 'game_over') {
            games[gameId].status = 'finished';
            calcGameResult(gameId);
            isUpdated = true;
        }
        if (isUpdated) {
            io.sockets.emit('list of games', games);
        }
    }
}

// Cleanup games
const msOneMinute = 1000 * 60;
const msGameFinished = msOneMinute * (process.env.LIMIT_GAME_DURATION_MIN || 60);
const msGameClosed = 30 * msOneMinute + msGameFinished;
const msUserInactive = msOneMinute * (process.env.LIMIT_USER_INACTIVE_MIN || 300);

let clearingGamesIsRunning = false; // to prevent several function executions
const clearGames = () => {
    if (!clearingGamesIsRunning && Object.keys(games).length > 0) {
        clearingGamesIsRunning = true;
        try {
            logger.info(`Games cleanup just started (${Object.keys(games).length} games total)`);
            let shouldNotify = false;
            const d_t = new Date();
            for (const gameId in games) {
                // Corner/rare cases
                if (games[gameId].players.white === null && games[gameId].players.black === null) {
                    delete games[gameId];
                }
                // Check if not deleted already
                if (gameId in games && games[gameId].date.started_at) {
                    const msFromStart = d_t - games[gameId].date.started_at;
                    // Clear games older than X minutes
                    if (msFromStart > msGameFinished && games[gameId].status !== 'finished') {
                        games[gameId].status = 'finished';
                        calcGameResult(gameId);
                        logger.info(`Game ${gameId} finished due to time limit exceeded`);
                        shouldNotify = true;
                    }
                    // Delete games older than X minutes
                    if (msFromStart > msGameClosed) {
                        delete games[gameId];
                        logger.info(`Game ${gameId} deleted due to time limit exceeded`);
                        shouldNotify = true;
                    }
                }
            }
            if (shouldNotify) {
                io.sockets.emit('list of games', games);
            }
        } finally {
            logger.info(`Games cleanup finished (${Object.keys(games).length} games left)`);
            clearingGamesIsRunning = false;
        }
    }
}

// Clearing games periodically
const schedulingClearGames = setInterval(
    clearGames,
    msOneMinute * (process.env.CLEAR_GAMES_EACH_X_MIN || 10)
);

const stopSymbols = /[\\\.\+\*\?\^\$\[\]\(\)\{\}\/\'\#\:\!\=\|\<\>\"\'\%\&]/ig;
const stopWords = [
    "stockfish",
    "ass",
    "arse",
    "ball",
    "bollock",
    "cock",
    "dick",
    "prick",
    "tits",
    "boob",
    "cunt",
    "jesus",
    "christ",
    "jew",
    "nigger",
    "cretin",
    "stupid",
    "fool",
    "bukkake",
    "naz",
    "путин",
    "трамп",
    "putin",
    "trump",
    "psych",
    "псих",
    "дурак",
    "twat",
    "fuck",
    "wank",
    "paki",
    "shag",
    "bugg",
    "come",
    "cum",
    "sod",
    "slut",
    "dildo",
    "god",
    "bitch",
    "whor",
    "basta",
    "piss",
    "pussy",
    "shit",
    "crap",
    "fart",
    "suck",
    "admin",
    "user",
    "админ",
    "комп",
    "comp",
    "电脑",
    "сука",
    "бля",
    "блед",
    "залуп",
    "перд",
    "пизд",
    "пезд",
    "пёзд",
    "пись",
    "пист",
    "писю",
    "ебл",
    "ёбл",
    "еба",
    "ёба",
    "ебк",
    "ёбк",
    "ёбу",
    "ебу",
    "ёбщ",
    "ебщ",
    "ебен",
    "ябу",
    "хуя",
    "хуй",
    "хуи",
    "хер",
    "говн",
    "гавн",
    "дерьм",
    "трах",
    "минет",
    "клит",
    "кастр",
    "мастур",
    "муда",
    "муди",
    "мудо",
    "соса",
    "срат",
    "срак",
    "сран",
    "ссат",
    "драч",
    "дроч",
    "дрюч",
    "жоп",
    "анус",
    "манд",
    "кака"
];

/**
 *  USERS
 */

const users = {}; // { 'login': {token: 'token' , ip: 'ip', updated_at: 'Date'} }
const clearUsersByIp = (ip) => {
    let usersWithIp = [];
    for (const login in users) {
        if (users[login].ip === ip) {
            usersWithIp.push({
                user_login: login,
                user_updated_at: users[login].updated_at
            })
        }
    }
    if (usersWithIp.length > (process.env.LIMIT_USERS_PER_IP || 3)) {
        usersWithIp.sort((a, b) => a.user_updated_at - b.user_updated_at);
        let usersToDelete = usersWithIp.slice(0, -3);
        usersToDelete.forEach((u) => {
            try {
                delete users[u.user_login];
            } catch (e) {
                //
            }

        })
    }

}
const updateUser = (login, token, ip) => {
    if (login && token && ip && login in users && users[login].token === token) {
        // IP changed
        if (users[login].ip !== ip) {
            users[login].ip = ip;
        }
        users[login].updated_at = new Date();
    }
    clearUsersByIp(ip);
}

const deleteUser = (login, token) => {
    if (login in users && users[login].token === token) {
        try {
            // Leave all games for given login
            for (const gameId in games) {
                if (games[gameId].players.white === login || games[gameId].players.black === login) {
                    updateGame('leave', gameId, login, token);
                }
            }
        } finally {
            // Delete user
            delete users[login];
            io.sockets.emit('online list', getOnlineList());
        }
    }
}

let clearingUsersIsRunning = false;
const clearUsers = () => {
    if (!clearingUsersIsRunning && Object.keys(users).length > 0) {
        clearingUsersIsRunning = true;
        try {
            logger.info(`Users cleanup just started (${Object.keys(users).length} users total)`);
            const d_t = new Date();
            for (const login in users) {
                const msFromLastUpdate = d_t - users[login].updated_at;
                // Clear user older than X minutes
                if (msFromLastUpdate > msUserInactive) {
                    deleteUser(login, users[login].token);
                }
            }
        } finally {
            logger.info(`Users cleanup finished (${Object.keys(users).length} users left)`);
            clearingUsersIsRunning = false;
        }
    }
}
// Clearing games periodically
const schedulingClearUsers = setInterval(
    clearUsers,
    msOneMinute * (process.env.CLEAR_USERS_EACH_X_MIN || 10)
);

const clients = {};
const getOnlineList = () => {
    let ol = {};
    for (const key in clients) {
        let v = clients[key];
        ol[v.last_login] = v.last_pathname;
    }
    return ol;
}

const addClient = (socketId, login = '', pathname = '') => {
    clients[socketId] = {};
    clients[socketId].last_login = login;
    clients[socketId].last_pathname = pathname;
    io.sockets.emit('online list', getOnlineList());
}

const deleteClient = (socketId) => {
    delete clients[socketId];
    io.sockets.emit('online list', getOnlineList());
}

const clearDisconnectedUsers = (clientIp) => {

    ipConnections[clientIp] -= 1;
    if (ipConnections[clientIp] <= 0) {
        delete ipConnections[clientIp]; // Clean up if no more connections from this IP
    }
    logger.info(`Disconnected from IP: ${clientIp}. Remaining connections for this IP: ${ipConnections[clientIp] || 0}`);

    let allActiveSockets = [];
    io.sockets.sockets.forEach((socket) => {
        allActiveSockets.push(socket.id);
    })

    for (const key in clients) {
        if (!allActiveSockets.includes(key)) {
            delete clients[key];
            clearGames();
        }
    }

    io.sockets.emit('online list', getOnlineList());
    logger.info('Total clients connected: ' + io.engine.clientsCount);
}

app.get('/', (req, res) => {
    res.send('<h3>LAN Games Server</h3>');
});

app.get('/clients', (req, res) => {

    let allActiveSockets = [];
    io.sockets.sockets.forEach((socket) => {
        allActiveSockets.push(socket.id);
    })

    res.status(200).json(
        {
            total_clients: io.engine.clientsCount,
            clients: allActiveSockets,
            online: getOnlineList(),
        }
    )
});

app.get('/status', (req, res) => {

    const serializedPayload = JSON.stringify(games);
    const sizeInBytes = Buffer.byteLength(serializedPayload, 'utf8');

    res.status(200).json(
        {
            total_clients: io.engine.clientsCount,
            total_users: Object.keys(users).length,
            active_games: Object.keys(games).length,
            gamesSizeInBytes: sizeInBytes,
            //users: users
        }
    )
});

/*
app.get('/clients/:id', (req, res) => {
    let s;
    io.sockets.sockets.forEach((socket) => {
        if (socket.id === req.params.id) {
            s = socket;
        }
    })

    if (s) {
        res.status(200).send(s.handshake);
    } else {
        res.status(404);
    }
});

 */

io.on('connection', (socket) => {

    const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.conn.remoteAddress || socket.handshake.address;

    if (ipConnections[clientIp] && ipConnections[clientIp] >= (process.env.LIMIT_CONN_PER_IP || 2)) {
        logger.info(`Connection rejected for IP: ${clientIp} (limit reached)`);
        socket.disconnect(true); // Disconnect the client
        return;
    }

    ipConnections[clientIp] = (ipConnections[clientIp] || 0) + 1;

    logger.info(`New connection "${socket.id}" from IP "${clientIp}". Total connections for this IP: ${ipConnections[clientIp]}`);
    logger.info('Total clients connected: ' + io.engine.clientsCount);

    /*
    const cookies = parse(socket.request.headers.cookie || "");
    //console.log("ip: " + socket.request.connection.remoteAddress);
    //console.log("user-agent: " + socket.request.headers['user-agent']);
    //console.log("user-agent: " + socket.handshake.headers["user-agent"]);
    //console.log("cookie: " + cookies['pmp-token']);
    if (!cookies['some-token']) {
        //logger.info('client ' + socket.id + ' disconnected due missed required header');
        //socket.disconnect(true);
    }
    */

    socket.emit('online list', getOnlineList());
    socket.emit('list of games', games);

    if (socket.recovered) {
        socket.emit('online list', getOnlineList());
        socket.emit('list of games', games);
    }

    socket.on('list of games', () => {
        socket.emit('list of games', games);
    })

    socket.on('create game', payload => {
        let id = Math.random().toString(36).slice(9);
        // crypto.randomUUID() ?
        // crypto.getRandomValues() ?
        addGame(socket.id, payload.login, id, payload.token, payload.mode, payload.name);
    })

    socket.on('join game', payload => {
        updateGame('join', payload.gameId, payload.login, payload.token);
    })

    socket.on('leave game', payload => {
        updateGame('leave', payload.gameId, payload.login, payload.token);
    })

    socket.on('update game', payload => {
        updateGame('update_move', payload.gameId, payload.login, payload.token, payload.move, payload.name);
        updateUser(payload.login, payload.token, clientIp);
    })

    socket.on('game over', payload => {
        updateGame('game_over', payload.gameId, payload.login, payload.token, payload.move);
    })

    socket.on('user is online', payload => {
        if (
            !payload.login
            || stopSymbols.test(payload.login) // login contains deprecated symbols
            || stopWords.find((s) => payload.login.toLowerCase().indexOf(s) > -1)?.length > 0
            || (
                payload.login in users && users[payload.login].token !== null // user already exists
                && users[payload.login].token !== payload.token // token mismatch to user
                && payload.token !== null // no token was received
            )
        ) {
            socket.emit('wrong token', {
                login: payload.login,
                token: payload.token,
            });
        } else if (
            !(payload.login in users) // no user already exists with this login
            && !stopWords.includes(payload.login.toLowerCase()) // not deprecated login
        ) {
            let newToken = uuidv4();
            users[payload.login] = {
                token: newToken,
                ip: clientIp,
                updated_at: new Date(),
            };
            socket.emit('use token', {login: payload.login, token: newToken})
        } else {
            addClient(socket.id, payload.login, payload.path);
            updateUser(payload.login, payload.token, clientIp); // all good, update IP if needed
        }
        //
    })

    socket.on('user is offline', payload => {
        deleteClient(socket.id);
    });

    socket.on('logout', payload => {
        deleteUser(payload.login, payload.token);
    })

    socket.on('page content updated', payload => {
        if (payload.login in getOnlineList()) {
            socket.broadcast.emit('reload page content', payload);
        }
    })

    socket.on('disconnect', payload => {
        clearDisconnectedUsers(clientIp);
    })

});

server.listen(port, host, () => {
    logger.info(`Started WebSocket server on host ${host} and port ${port}.`);
});