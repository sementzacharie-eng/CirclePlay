const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const { rateLimit } = require("express-rate-limit");
const helmet = require("helmet");
const { Server } = require("socket.io");

const qdnQuestions = {
    CHILL: require("./Game/QuiDeNous/Chill").questions,
    SOFT: require("./Game/QuiDeNous/Soft").questions,
    HARD: require("./Game/QuiDeNous/Hard").questions,
    EXTREME: require("./Game/QuiDeNous/Extreme").questions
};
const undercoverCategories = require("./data/undercover-categories");
const qdnRoundChoices = [10, 20, 30, 40, 50];
const qdnRoomCodeCharacters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const undercoverWordRevealDurationMs = 20 * 1000;
const undercoverTurnDurationMs = 15 * 1000;
const roomReconnectGracePeriodMs = 60 * 1000;
for (const [category, pairs] of Object.entries(undercoverCategories)) {
    if (!category.trim() || !Array.isArray(pairs) || pairs.length === 0 ||
        pairs.some(pair => !pair || typeof pair.normal !== "string" ||
            !pair.normal.trim() || typeof pair.undercover !== "string" ||
            !pair.undercover.trim() || pair.normal.trim() === pair.undercover.trim())) {
        throw new Error(`Catégorie Undercover invalide : ${category || "(sans nom)"}.`);
    }
}
const usernameColors = [
    "#ff6b6b",
    "#ff9f43",
    "#feca57",
    "#1dd1a1",
    "#48dbfb",
    "#54a0ff",
    "#5f27cd",
    "#c56cf0",
    "#ff6bcb",
    "#f5c7d7"
];

const app = express();
const port = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === "production";
const dataDirectory = path.join(__dirname, "data");

if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error("La variable SESSION_SECRET est obligatoire en production.");
}

fs.mkdirSync(dataDirectory, { recursive: true });

const database = new Database(path.join(dataDirectory, "circleplay.sqlite"));
database.pragma("journal_mode = WAL");
database.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL,
        username_color TEXT NOT NULL DEFAULT '#f5c7d7',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS active_account_sessions (
        user_id INTEGER PRIMARY KEY,
        sid TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS app_migrations (
        name TEXT PRIMARY KEY
    );
`);
const userColumns = database.prepare("PRAGMA table_info(users)").all();
if (!userColumns.some(column => column.name === "username_color")) {
    database.exec("ALTER TABLE users ADD COLUMN username_color TEXT NOT NULL DEFAULT '#f5c7d7'");
}

class SqliteSessionStore extends session.Store {
    constructor(db) {
        super();
        db.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                sid TEXT PRIMARY KEY,
                sess TEXT NOT NULL,
                expire INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions (expire);
        `);
        this.getSession = db.prepare(
            "SELECT sess, expire FROM sessions WHERE sid = ?"
        );
        this.saveSession = db.prepare(`
            INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?)
            ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire
        `);
        this.deleteSession = db.prepare("DELETE FROM sessions WHERE sid = ?");
        this.deleteExpiredSessions = db.prepare("DELETE FROM sessions WHERE expire <= ?");
        this.refreshSession = db.prepare(
            "UPDATE sessions SET expire = ? WHERE sid = ?"
        );
    }

    get(sid, callback) {
        try {
            const row = this.getSession.get(sid);
            if (!row) return callback(null, null);
            if (row.expire <= Date.now()) {
                this.deleteSession.run(sid);
                return callback(null, null);
            }
            callback(null, JSON.parse(row.sess));
        } catch (error) {
            callback(error);
        }
    }

    set(sid, sess, callback = () => {}) {
        try {
            const expiresAt = sess.cookie && sess.cookie.expires
                ? new Date(sess.cookie.expires).getTime()
                : Date.now() + 24 * 60 * 60 * 1000;
            this.saveSession.run(sid, JSON.stringify(sess), expiresAt);
            this.deleteExpiredSessions.run(Date.now());
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    destroy(sid, callback = () => {}) {
        try {
            this.deleteSession.run(sid);
            callback(null);
        } catch (error) {
            callback(error);
        }
    }

    touch(sid, sess, callback = () => {}) {
        try {
            const expiresAt = sess.cookie && sess.cookie.expires
                ? new Date(sess.cookie.expires).getTime()
                : Date.now() + 24 * 60 * 60 * 1000;
            this.refreshSession.run(expiresAt, sid);
            callback(null);
        } catch (error) {
            callback(error);
        }
    }
}

const sessionStore = new SqliteSessionStore(database);
const findUserByUsername = database.prepare(
    "SELECT id, username, password_hash, username_color FROM users WHERE username = ? COLLATE NOCASE"
);
const findUserById = database.prepare(
    "SELECT id, username, username_color FROM users WHERE id = ?"
);
const updateUsernameColor = database.prepare(
    "UPDATE users SET username_color = ? WHERE id = ?"
);
const createUser = database.prepare(
    "INSERT INTO users (username, password_hash, username_color) VALUES (?, ?, ?)"
);
const updateUserPassword = database.prepare(
    "UPDATE users SET password_hash = ? WHERE id = ?"
);
const findActiveAccountSession = database.prepare(
    "SELECT sid FROM active_account_sessions WHERE user_id = ?"
);
const replaceActiveAccountSession = database.prepare(`
    INSERT INTO active_account_sessions (user_id, sid) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET sid = excluded.sid
`);
const deleteActiveAccountSession = database.prepare(
    "DELETE FROM active_account_sessions WHERE user_id = ? AND sid = ?"
);
const deleteStoredSession = database.prepare("DELETE FROM sessions WHERE sid = ?");
const hasMigration = database.prepare("SELECT 1 FROM app_migrations WHERE name = ?");
const recordMigration = database.prepare("INSERT INTO app_migrations (name) VALUES (?)");

const defaultAccountNames = ["Zacharie", "Ilan", "Allan", "Nina", "Nathan", "Julia"];
const seedDefaultAccounts = database.transaction(() => {
    const migrationName = "seed-default-accounts-v1";
    if (hasMigration.get(migrationName)) return;

    for (const username of defaultAccountNames) {
        const passwordHash = bcrypt.hashSync("1234", 12);
        const existingUser = findUserByUsername.get(username);
        if (existingUser) {
            updateUserPassword.run(passwordHash, existingUser.id);
        } else {
            createUser.run(
                username,
                passwordHash,
                usernameColors[crypto.randomInt(usernameColors.length)]
            );
        }
    }
    recordMigration.run(migrationName);
});
seedDefaultAccounts();

app.disable("x-powered-by");
if (isProduction) app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "10kb" }));
const sessionMiddleware = session({
    name: "circleplay.sid",
    proxy: isProduction,
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
});
app.use(sessionMiddleware);

const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Trop de tentatives. Réessaie dans quelques minutes." }
});

function validateCredentials(username, password) {
    if (typeof username !== "string" || !/^[A-Za-z0-9_]{3,20}$/.test(username)) {
        return "Le pseudo doit contenir de 3 à 20 lettres, chiffres ou tirets bas.";
    }
    if (typeof password !== "string" || password.length < 5) {
        return "Le mot de passe doit contenir au moins 5 caractères.";
    }
    if (Buffer.byteLength(password, "utf8") > 72) {
        return "Le mot de passe ne doit pas dépasser 72 octets.";
    }
    return null;
}

function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate(error => error ? reject(error) : resolve());
    });
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save(error => error ? reject(error) : resolve());
    });
}

async function activateAccountSession(req, userId) {
    const previousSessionId = findActiveAccountSession.get(userId)?.sid;
    req.session.userId = userId;
    await saveSession(req);

    database.transaction(() => {
        replaceActiveAccountSession.run(userId, req.sessionID);
        if (previousSessionId && previousSessionId !== req.sessionID) {
            deleteStoredSession.run(previousSessionId);
        }
    })();

    if (previousSessionId && previousSessionId !== req.sessionID) {
        const previousSockets = Array.from(io.sockets.sockets.values())
            .filter(socket => socket.data.sessionId === previousSessionId);
        for (const previousSocket of previousSockets) {
            previousSocket.emit("account:session-replaced", () => {
                previousSocket.disconnect(true);
            });
        }
        if (previousSockets.length > 0) {
            const disconnectFallback = setTimeout(() => {
                for (const previousSocket of previousSockets) {
                    if (previousSocket.connected) previousSocket.disconnect(true);
                }
            }, 1000);
            disconnectFallback.unref();
        }
    }
}

app.get("/api/auth/me", (req, res, next) => {
    try {
        const user = req.session.userId &&
            findActiveAccountSession.get(req.session.userId)?.sid === req.sessionID
            ? findUserById.get(req.session.userId)
            : null;
        res.json({
            user: user
                ? { id: user.id, username: user.username, usernameColor: user.username_color }
                : null
        });
    } catch (error) {
        next(error);
    }
});

app.post("/api/auth/register", authRateLimit, async (req, res, next) => {
    const { username, password } = req.body || {};
    const validationError = validateCredentials(username, password);
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const usernameColor = usernameColors[crypto.randomInt(usernameColors.length)];
        const result = createUser.run(username, passwordHash, usernameColor);
        await regenerateSession(req);
        await activateAccountSession(req, Number(result.lastInsertRowid));
        res.status(201).json({
            user: {
                id: Number(result.lastInsertRowid),
                username,
                usernameColor
            }
        });
    } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({ error: "Ce pseudo est déjà utilisé." });
        }
        next(error);
    }
});

app.post("/api/auth/login", authRateLimit, async (req, res, next) => {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string") {
        return res.status(400).json({ error: "Indique un pseudo et un mot de passe." });
    }

    try {
        const user = findUserByUsername.get(username.trim());
        const passwordMatches = user && Buffer.byteLength(password, "utf8") <= 72
            ? await bcrypt.compare(password, user.password_hash)
            : false;
        if (!passwordMatches) {
            return res.status(401).json({ error: "Pseudo ou mot de passe incorrect." });
        }
        await regenerateSession(req);
        await activateAccountSession(req, user.id);
        res.json({
            user: {
                id: user.id,
                username: user.username,
                usernameColor: user.username_color
            }
        });
    } catch (error) {
        next(error);
    }
});

app.post("/api/profile/color", (req, res, next) => {
    const { color } = req.body || {};
    if (typeof color !== "string" || !usernameColors.includes(color.toLowerCase())) {
        return res.status(400).json({ error: "Choisis une couleur valide." });
    }
    if (!req.session.userId ||
        findActiveAccountSession.get(req.session.userId)?.sid !== req.sessionID) {
        return res.status(401).json({ error: "Connecte-toi pour modifier ton profil." });
    }

    try {
        updateUsernameColor.run(color.toLowerCase(), req.session.userId);
        const user = findUserById.get(req.session.userId);
        io.emit("chat:profile", {
            userId: user.id,
            usernameColor: user.username_color
        });
        for (const message of chatHistory) {
            if (message.userId === user.id) message.usernameColor = user.username_color;
        }
        for (const room of qdnRooms.values()) {
            const player = room.players.get(user.id);
            if (player) {
                player.usernameColor = user.username_color;
                broadcastQdnRoom(room);
            }
        }
        res.json({
            user: {
                id: user.id,
                username: user.username,
                usernameColor: user.username_color
            }
        });
    } catch (error) {
        next(error);
    }
});

app.post("/api/auth/logout", (req, res, next) => {
    const sessionId = req.sessionID;
    const userId = req.session.userId;
    req.session.destroy(error => {
        if (error) return next(error);
        if (userId) deleteActiveAccountSession.run(userId, sessionId);
        for (const socket of io.sockets.sockets.values()) {
            if (socket.data.sessionId === sessionId) socket.disconnect(true);
        }
        res.clearCookie("circleplay.sid", {
            httpOnly: true,
            sameSite: "lax",
            secure: isProduction
        });
        res.status(204).end();
    });
});

app.get("/api/undercover/categories", (req, res) => {
    if (!req.session.userId ||
        findActiveAccountSession.get(req.session.userId)?.sid !== req.sessionID) {
        return res.status(401).json({ error: "Connecte-toi pour voir les catégories." });
    }
    res.json({ categories: Object.keys(undercoverCategories) });
});

app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.use("/Game", express.static(path.join(__dirname, "Game")));
app.use("/img", express.static(path.join(__dirname, "img")));
app.get("/script.js", (_req, res) => res.sendFile(path.join(__dirname, "script.js")));
app.get("/style.css", (_req, res) => res.sendFile(path.join(__dirname, "style.css")));

app.use((error, _req, res, _next) => {
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ error: "La requête envoyée n'est pas un JSON valide." });
    }
    console.error(error);
    res.status(500).json({ error: "Une erreur interne est survenue." });
});

const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 8 * 1024
});
const chatHistory = [];
const lastMessageByUser = new Map();
const maxChatHistory = 50;
const maxMessageLength = 500;
const qdnRooms = new Map();
const undercoverRooms = new Map();

io.engine.use(sessionMiddleware);
io.use((socket, next) => {
    const userId = socket.request.session && socket.request.session.userId;
    const user = userId ? findUserById.get(userId) : null;
    if (!user || findActiveAccountSession.get(userId)?.sid !== socket.request.sessionID) {
        return next(new Error("AUTH_REQUIRED"));
    }

    socket.data.user = user;
    socket.data.sessionId = socket.request.sessionID;
    socket.use((_packet, next) => {
        if (findActiveAccountSession.get(userId)?.sid !== socket.data.sessionId) {
            socket.disconnect(true);
            return;
        }
        next();
    });
    next();
});

function shuffleQuestions(questions) {
    const shuffled = [...questions];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const randomIndex = crypto.randomInt(index + 1);
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
}

function getNextQdnQuestion(room) {
    if (room.questionQueue.length === 0) {
        room.questionQueue = shuffleQuestions(qdnQuestions[room.difficulty]);
        if (room.questionQueue.length > 1 &&
            room.questionQueue[room.questionQueue.length - 1].text === room.lastQuestion) {
            [room.questionQueue[0], room.questionQueue[room.questionQueue.length - 1]] =
                [room.questionQueue[room.questionQueue.length - 1], room.questionQueue[0]];
        }
    }
    const question = room.questionQueue.pop();
    room.lastQuestion = question.text;
    return question;
}

function getQdnRoomState(room, player) {
    const state = {
        code: room.code,
        hostId: room.hostId,
        difficulty: room.difficulty,
        rounds: room.rounds,
        status: room.status,
        round: room.round,
        question: room.question,
        players: Array.from(room.players.values(), member => ({
            id: member.userId,
            username: member.username,
            usernameColor: member.usernameColor,
            score: member.score
        })),
        votesSubmitted: room.votes.size,
        hasVoted: room.votes.has(player.userId),
        notice: room.notice,
        reveal: room.reveal
    };
    return state;
}

function broadcastQdnRoom(room) {
    for (const player of room.players.values()) {
        if (player.socketId) {
            io.to(player.socketId).emit("qdn:state", getQdnRoomState(room, player));
        }
    }
}

function completeQdnVoting(room) {
    if (room.status !== "voting" || room.votes.size !== room.players.size) return;

    const votesByPlayer = new Map();
    for (const targetId of room.votes.values()) {
        votesByPlayer.set(targetId, (votesByPlayer.get(targetId) || 0) + 1);
    }
    const highestVoteCount = Math.max(...votesByPlayer.values());
    const awardedIds = Array.from(votesByPlayer.entries())
        .filter(([, voteCount]) => voteCount === highestVoteCount)
        .map(([playerId]) => playerId);
    for (const playerId of awardedIds) {
        const player = room.players.get(playerId);
        if (player) player.score += room.question.points;
    }

    room.reveal = {
        results: Array.from(room.players.values(), player => ({
            playerId: player.userId,
            username: player.username,
            votes: votesByPlayer.get(player.userId) || 0
        })).sort((first, second) => second.votes - first.votes),
        awardedIds,
        points: room.question.points
    };
    room.status = "reveal";
    broadcastQdnRoom(room);
}

function removeQdnPlayer(room, player) {
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
    room.players.delete(player.userId);
    room.votes.delete(player.userId);

    if (room.players.size === 0) {
        qdnRooms.delete(room.code);
        return;
    }
    if (room.hostId === player.userId) {
        room.hostId = room.players.keys().next().value;
    }
    room.notice = room.players.size < 2 && room.status !== "lobby" && room.status !== "finished"
        ? "Il faut au moins 2 joueurs. La partie est revenue au salon."
        : "";
    if (room.players.size < 2 && room.status !== "lobby" && room.status !== "finished") {
        room.status = "lobby";
        room.round = 0;
        room.question = null;
        room.reveal = null;
        room.votes.clear();
    } else {
        completeQdnVoting(room);
    }
    broadcastQdnRoom(room);
}

function leaveQdnRoom(socket) {
    const roomCode = socket.data.qdnRoomCode;
    socket.data.qdnRoomCode = null;
    if (!roomCode) return;

    const room = qdnRooms.get(roomCode);
    if (!room) return;
    const player = room.players.get(socket.data.user.id);
    if (!player || player.socketId !== socket.id) return;
    socket.leave(roomCode);
    removeQdnPlayer(room, player);
}

function deferQdnRoomLeave(socket) {
    const roomCode = socket.data.qdnRoomCode;
    socket.data.qdnRoomCode = null;
    if (!roomCode) return;

    const room = qdnRooms.get(roomCode);
    const player = room?.players.get(socket.data.user.id);
    if (!room || !player || player.socketId !== socket.id) return;

    player.socketId = null;
    player.disconnectTimer = setTimeout(() => {
        if (player.socketId !== null) return;
        removeQdnPlayer(room, player);
    }, roomReconnectGracePeriodMs);
    broadcastQdnRoom(room);
}

function findQdnRoomForUser(userId) {
    return Array.from(qdnRooms.values()).find(room => room.players.has(userId));
}

function generateQdnRoomCode() {
    let code;
    do {
        code = Array.from({ length: 6 }, () =>
            qdnRoomCodeCharacters[crypto.randomInt(qdnRoomCodeCharacters.length)]
        ).join("");
    } while (qdnRooms.has(code) || undercoverRooms.has(code));
    return code;
}

function findUndercoverRoomForUser(userId) {
    return Array.from(undercoverRooms.values()).find(room => room.players.has(userId));
}

function clearUndercoverTimer(room) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
}

function getUndercoverRoomState(room, player) {
    return {
        code: room.code,
        hostId: room.hostId,
        category: room.category,
        rounds: room.rounds,
        status: room.status,
        round: room.round,
        endsAt: room.endsAt,
        remainingSeconds: room.endsAt
            ? Math.max(0, Math.ceil((room.endsAt - Date.now()) / 1000))
            : 0,
        currentSpeakerId: room.status === "speaking"
            ? room.turnOrder[room.turnIndex]
            : null,
        turnNumber: room.status === "speaking" ? room.turnIndex + 1 : 0,
        turnCount: room.turnOrder.length,
        players: Array.from(room.players.values(), member => ({
            id: member.userId,
            username: member.username,
            usernameColor: member.usernameColor,
            score: member.score
        })),
        votesSubmitted: room.votes.size,
        eligibleVoters: Array.from(room.players.values()).filter(member => !member.isUndercover).length,
        hasVoted: room.votes.has(player.userId),
        isUndercover: Boolean(player.isUndercover),
        word: room.status === "lobby" ? "" : player.word,
        reveal: room.reveal,
        notice: room.notice
    };
}

function broadcastUndercoverRoom(room) {
    for (const player of room.players.values()) {
        if (player.socketId) {
            io.to(player.socketId).emit(
                "undercover:state",
                getUndercoverRoomState(room, player)
            );
        }
    }
}

function revealUndercoverRound(room) {
    if (room.status !== "voting") return;
    clearUndercoverTimer(room);

    const undercover = Array.from(room.players.values()).find(player => player.isUndercover);
    if (!undercover) {
        room.status = "lobby";
        room.round = 0;
        room.notice = "La manche a été annulée : undercover introuvable. Relance la partie.";
        broadcastUndercoverRoom(room);
        return;
    }
    const votesByPlayer = new Map();
    for (const targetId of room.votes.values()) {
        votesByPlayer.set(targetId, (votesByPlayer.get(targetId) || 0) + 1);
    }
    const highestVotes = Math.max(0, ...votesByPlayer.values());
    const leaders = Array.from(votesByPlayer.entries())
        .filter(([, count]) => count === highestVotes)
        .map(([playerId]) => playerId);
    const undercoverFound = highestVotes > 0 &&
        leaders.length === 1 &&
        leaders[0] === undercover.userId;

    if (undercoverFound) {
        for (const player of room.players.values()) {
            if (!player.isUndercover) player.score++;
        }
    } else {
        undercover.score++;
    }

    room.reveal = {
        undercoverId: undercover.userId,
        undercoverUsername: undercover.username,
        undercoverWord: undercover.word,
        normalWord: room.normalWord,
        votes: Array.from(room.players.values(), player => ({
            playerId: player.userId,
            username: player.username,
            count: votesByPlayer.get(player.userId) || 0
        })).sort((first, second) => second.count - first.count),
        undercoverFound,
        votesSubmitted: room.votes.size
    };
    room.status = "reveal";
    room.endsAt = null;
    broadcastUndercoverRoom(room);
}

function completeUndercoverVoting(room) {
    if (room.status !== "voting") return;
    const eligibleVoters = Array.from(room.players.values())
        .filter(player => !player.isUndercover);
    if (eligibleVoters.every(player => room.votes.has(player.userId))) {
        revealUndercoverRound(room);
    } else {
        broadcastUndercoverRoom(room);
    }
}

function startUndercoverRound(room) {
    const wordPairs = undercoverCategories[room.category];
    const pair = wordPairs[crypto.randomInt(wordPairs.length)];
    const undercoverIndex = crypto.randomInt(room.players.size);
    const players = Array.from(room.players.values());
    room.normalWord = pair.normal;
    room.undercoverWord = pair.undercover;
    room.votes.clear();
    room.reveal = null;
    room.notice = "";
    room.status = "word-reveal";
    room.endsAt = Date.now() + undercoverWordRevealDurationMs;
    room.turnOrder = players.map(player => player.userId);
    room.turnIndex = -1;
    players.forEach((player, index) => {
        player.isUndercover = index === undercoverIndex;
        player.word = player.isUndercover ? pair.undercover : pair.normal;
    });
    clearUndercoverTimer(room);
    room.timer = setTimeout(() => startUndercoverTurns(room), undercoverWordRevealDurationMs);
}

function startUndercoverTurns(room) {
    if (room.status !== "word-reveal") return;
    room.status = "speaking";
    room.turnIndex = 0;
    startUndercoverTurn(room);
}

function startUndercoverTurn(room) {
    if (room.status !== "speaking") return;
    if (room.turnIndex >= room.turnOrder.length) {
        room.status = "voting";
        room.endsAt = null;
        clearUndercoverTimer(room);
        broadcastUndercoverRoom(room);
        return;
    }
    room.endsAt = Date.now() + undercoverTurnDurationMs;
    clearUndercoverTimer(room);
    room.timer = setTimeout(() => advanceUndercoverTurn(room), undercoverTurnDurationMs);
    broadcastUndercoverRoom(room);
}

function advanceUndercoverTurn(room) {
    if (room.status !== "speaking") return;
    room.turnIndex++;
    startUndercoverTurn(room);
}

function resetUndercoverRound(room, notice) {
    clearUndercoverTimer(room);
    room.status = "lobby";
    room.round = 0;
    room.endsAt = null;
    room.turnOrder = [];
    room.turnIndex = -1;
    room.votes.clear();
    room.reveal = null;
    room.players.forEach(member => {
        member.isUndercover = false;
        member.word = "";
    });
    room.notice = notice;
    broadcastUndercoverRoom(room);
}

function handleUndercoverPlayerRemoved(room, player) {
    for (const [voterId, targetId] of room.votes) {
        if (targetId === player.userId) room.votes.delete(voterId);
    }
    if (room.status === "word-reveal" || room.status === "speaking" || room.status === "voting") {
        if (player.isUndercover || room.players.size < 3) {
            resetUndercoverRound(
                room,
                player.isUndercover
                    ? "L'undercover a quitté le salon. La partie est revenue au salon."
                    : "Il faut au moins 3 joueurs. La partie est revenue au salon."
            );
            return;
        }
    }

    if (room.status === "speaking") {
        const removedTurnIndex = room.turnOrder.indexOf(player.userId);
        if (removedTurnIndex !== -1) {
            room.turnOrder.splice(removedTurnIndex, 1);
            if (removedTurnIndex < room.turnIndex) {
                room.turnIndex--;
            } else if (removedTurnIndex === room.turnIndex) {
                clearUndercoverTimer(room);
                startUndercoverTurn(room);
                return;
            }
        }
    } else if (room.status === "word-reveal") {
        room.turnOrder = room.turnOrder.filter(userId => userId !== player.userId);
    }

    room.notice = "";
    if (room.status === "voting") {
        completeUndercoverVoting(room);
    } else {
        broadcastUndercoverRoom(room);
    }
}

function removeUndercoverPlayer(room, player) {
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
    room.players.delete(player.userId);
    room.votes.delete(player.userId);

    if (room.players.size === 0) {
        clearUndercoverTimer(room);
        undercoverRooms.delete(room.code);
        return;
    }
    if (room.hostId === player.userId) {
        room.hostId = room.players.keys().next().value;
    }
    handleUndercoverPlayerRemoved(room, player);
}

function leaveUndercoverRoom(socket) {
    const roomCode = socket.data.undercoverRoomCode;
    socket.data.undercoverRoomCode = null;
    if (!roomCode) return;

    const room = undercoverRooms.get(roomCode);
    if (!room) return;
    const player = room.players.get(socket.data.user.id);
    if (!player || player.socketId !== socket.id) return;
    socket.leave(roomCode);
    removeUndercoverPlayer(room, player);
}

function deferUndercoverRoomLeave(socket) {
    const roomCode = socket.data.undercoverRoomCode;
    socket.data.undercoverRoomCode = null;
    if (!roomCode) return;

    const room = undercoverRooms.get(roomCode);
    const player = room?.players.get(socket.data.user.id);
    if (!room || !player || player.socketId !== socket.id) return;

    player.socketId = null;
    player.disconnectTimer = setTimeout(() => {
        if (player.socketId !== null) return;
        removeUndercoverPlayer(room, player);
    }, roomReconnectGracePeriodMs);
    broadcastUndercoverRoom(room);
}

io.on("connection", socket => {
    socket.emit("chat:history", chatHistory);
    io.emit("chat:presence", io.of("/").sockets.size);

    socket.on("undercover:create", (settings, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const userId = socket.data.user.id;
        if (findQdnRoomForUser(userId) || findUndercoverRoomForUser(userId)) {
            return reply({ error: "Tu es déjà dans un salon." });
        }
        if (undercoverRooms.size >= 500) {
            return reply({ error: "Trop de salons sont actuellement ouverts. Réessaie plus tard." });
        }
        if (!settings || !Object.hasOwn(undercoverCategories, settings.category)) {
            return reply({ error: "Choisis une catégorie valide." });
        }
        if (!qdnRoundChoices.includes(settings.rounds)) {
            return reply({ error: "Choisis un nombre de manches valide." });
        }

        const code = generateQdnRoomCode();
        const room = {
            code,
            hostId: userId,
            category: settings.category,
            rounds: settings.rounds,
            status: "lobby",
            round: 0,
            endsAt: null,
            turnOrder: [],
            turnIndex: -1,
            normalWord: "",
            undercoverWord: "",
            players: new Map([[userId, {
                userId,
                username: socket.data.user.username,
                usernameColor: socket.data.user.username_color,
                socketId: socket.id,
                disconnectTimer: null,
                score: 0,
                isUndercover: false,
                word: ""
            }]]),
            votes: new Map(),
            timer: null,
            reveal: null,
            notice: ""
        };
        undercoverRooms.set(code, room);
        socket.data.undercoverRoomCode = code;
        socket.join(code);
        reply({ ok: true, code });
        broadcastUndercoverRoom(room);
    });

    socket.on("undercover:resume", (inputCode, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const code = typeof inputCode === "string" ? inputCode.trim().toUpperCase() : "";
        const room = undercoverRooms.get(code);
        const userId = socket.data.user.id;
        if (!room) return reply({ error: "Cette partie Undercover n'est plus disponible." });
        const qdnRoom = findQdnRoomForUser(userId);
        if (qdnRoom && qdnRoom.code !== code) {
            return reply({ error: "Tu participes déjà à une autre partie." });
        }
        const currentUndercoverRoom = findUndercoverRoomForUser(userId);
        if (currentUndercoverRoom && currentUndercoverRoom.code !== code) {
            return reply({ error: "Tu participes déjà à une autre partie." });
        }
        const player = room.players.get(userId);
        if (!player) return reply({ error: "Tu ne fais plus partie de ce salon." });

        if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
        if (player.socketId && player.socketId !== socket.id) {
            const previousSocket = io.sockets.sockets.get(player.socketId);
            if (previousSocket) {
                previousSocket.data.undercoverRoomCode = null;
                previousSocket.leave(code);
            }
        }
        player.disconnectTimer = null;
        player.socketId = socket.id;
        socket.data.undercoverRoomCode = code;
        socket.join(code);
        reply({ ok: true, code });
        broadcastUndercoverRoom(room);
    });

    socket.on("undercover:join", (inputCode, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const code = typeof inputCode === "string" ? inputCode.trim().toUpperCase() : "";
        if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
            return reply({ error: "Le code du salon doit contenir 6 caractères valides." });
        }
        if (findQdnRoomForUser(socket.data.user.id) || findUndercoverRoomForUser(socket.data.user.id)) {
            return reply({ error: "Tu es déjà dans un salon." });
        }

        const room = undercoverRooms.get(code);
        if (!room) return reply({ error: "Aucun salon Undercover ne correspond à ce code." });
        if (room.status !== "lobby") return reply({ error: "La partie a déjà commencé." });
        if (room.players.size >= 12) return reply({ error: "Ce salon est complet (12 joueurs maximum)." });

        const userId = socket.data.user.id;
        room.players.set(userId, {
            userId,
            username: socket.data.user.username,
            usernameColor: socket.data.user.username_color,
            socketId: socket.id,
            disconnectTimer: null,
            score: 0,
            isUndercover: false,
            word: ""
        });
        room.notice = "";
        socket.data.undercoverRoomCode = code;
        socket.join(code);
        reply({ ok: true, code });
        broadcastUndercoverRoom(room);
    });

    socket.on("undercover:leave", (_payload, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        leaveUndercoverRoom(socket);
        reply({ ok: true });
    });

    socket.on("undercover:kick", (targetId, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const room = undercoverRooms.get(socket.data.undercoverRoomCode);
        if (!room) return reply({ error: "Tu n'es dans aucun salon." });
        if (room.hostId !== socket.data.user.id) {
            return reply({ error: "Seul le chef du salon peut expulser un joueur." });
        }
        if (!Number.isInteger(targetId) || targetId === socket.data.user.id) {
            return reply({ error: "Choisis un autre joueur à expulser." });
        }
        const target = room.players.get(targetId);
        if (!target) return reply({ error: "Ce joueur n'est plus dans le salon." });

        const targetSocket = io.sockets.sockets.get(target.socketId);
        if (targetSocket) {
            targetSocket.emit("undercover:kicked");
            leaveUndercoverRoom(targetSocket);
        } else {
            if (room.hostId === targetId) room.hostId = room.players.keys().next().value;
            removeUndercoverPlayer(room, target);
        }
        reply({ ok: true });
    });

    socket.on("undercover:start", (_payload, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const room = undercoverRooms.get(socket.data.undercoverRoomCode);
        if (!room) return reply({ error: "Tu n'es dans aucun salon." });
        if (room.hostId !== socket.data.user.id) {
            return reply({ error: "Seul le chef du salon peut lancer la partie." });
        }
        if (room.status !== "lobby") return reply({ error: "La partie a déjà commencé." });
        if (room.players.size < 3) {
            return reply({ error: "Il faut au moins 3 joueurs pour commencer." });
        }

        for (const player of room.players.values()) player.score = 0;
        room.round = 1;
        startUndercoverRound(room);
        reply({ ok: true });
        broadcastUndercoverRoom(room);
    });

    socket.on("undercover:vote", (targetId, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const room = undercoverRooms.get(socket.data.undercoverRoomCode);
        if (!room || room.status !== "voting") {
            return reply({ error: "Aucun vote n'est attendu pour le moment." });
        }
        const voter = room.players.get(socket.data.user.id);
        if (!voter || voter.socketId !== socket.id) {
            return reply({ error: "Tu ne fais pas partie de ce salon." });
        }
        if (voter.isUndercover) {
            return reply({ error: "L'undercover ne peut pas voter." });
        }
        if (room.votes.has(voter.userId)) {
            return reply({ error: "Tu as déjà voté pour cette manche." });
        }
        if (!Number.isInteger(targetId) || targetId === voter.userId || !room.players.has(targetId)) {
            return reply({ error: "Choisis un autre joueur présent dans le salon." });
        }

        room.votes.set(voter.userId, targetId);
        completeUndercoverVoting(room);
        reply({ ok: true });
    });

    socket.on("undercover:next", (_payload, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const room = undercoverRooms.get(socket.data.undercoverRoomCode);
        if (!room) return reply({ error: "Tu n'es dans aucun salon." });
        if (room.hostId !== socket.data.user.id) {
            return reply({ error: "Seul le chef du salon peut continuer." });
        }
        if (room.status !== "reveal") {
            return reply({ error: "Attends la fin du vote." });
        }
        if (room.players.size < 3) {
            room.status = "lobby";
            room.round = 0;
            room.endsAt = null;
            room.votes.clear();
            room.reveal = null;
            room.notice = "Il faut au moins 3 joueurs pour continuer. La partie est revenue au salon.";
            room.players.forEach(player => {
                player.isUndercover = false;
                player.word = "";
            });
            reply({ ok: true });
            broadcastUndercoverRoom(room);
            return;
        }
        if (room.round >= room.rounds) {
            room.status = "finished";
            room.notice = "";
        } else {
            room.round++;
            startUndercoverRound(room);
        }
        reply({ ok: true });
        broadcastUndercoverRoom(room);
    });

    socket.on("qdn:create", (settings, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const userId = socket.data.user.id;
        if (findQdnRoomForUser(userId) || findUndercoverRoomForUser(userId)) {
            return reply({ error: "Tu es déjà dans un salon." });
        }
        if (qdnRooms.size >= 500) {
            return reply({ error: "Trop de salons sont actuellement ouverts. Réessaie plus tard." });
        }
        if (!settings || !Object.hasOwn(qdnQuestions, settings.difficulty)) {
            return reply({ error: "Choisis une difficulté valide." });
        }
        if (!qdnRoundChoices.includes(settings.rounds)) {
            return reply({ error: "Choisis un nombre de manches valide." });
        }

        const code = generateQdnRoomCode();
        const room = {
            code,
            hostId: userId,
            difficulty: settings.difficulty,
            rounds: settings.rounds,
            status: "lobby",
            round: 0,
            question: null,
            questionQueue: [],
            lastQuestion: "",
            players: new Map([[userId, {
                userId,
                username: socket.data.user.username,
                usernameColor: socket.data.user.username_color,
                socketId: socket.id,
                disconnectTimer: null,
                score: 0
            }]]),
            votes: new Map(),
            reveal: null,
            notice: ""
        };
        qdnRooms.set(code, room);
        socket.data.qdnRoomCode = code;
        socket.join(code);
        reply({ ok: true, code });
        broadcastQdnRoom(room);
    });

    socket.on("qdn:resume", (inputCode, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const code = typeof inputCode === "string" ? inputCode.trim().toUpperCase() : "";
        const room = qdnRooms.get(code);
        const userId = socket.data.user.id;
        if (!room) return reply({ error: "Cette partie Qui de nous ? n'est plus disponible." });
        const undercoverRoom = findUndercoverRoomForUser(userId);
        if (undercoverRoom) {
            return reply({ error: "Tu participes déjà à une autre partie." });
        }
        const currentQdnRoom = findQdnRoomForUser(userId);
        if (currentQdnRoom && currentQdnRoom.code !== code) {
            return reply({ error: "Tu participes déjà à une autre partie." });
        }
        const player = room.players.get(userId);
        if (!player) return reply({ error: "Tu ne fais plus partie de ce salon." });

        if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
        if (player.socketId && player.socketId !== socket.id) {
            const previousSocket = io.sockets.sockets.get(player.socketId);
            if (previousSocket) {
                previousSocket.data.qdnRoomCode = null;
                previousSocket.leave(code);
            }
        }
        player.disconnectTimer = null;
        player.socketId = socket.id;
        socket.data.qdnRoomCode = code;
        socket.join(code);
        reply({ ok: true, code });
        broadcastQdnRoom(room);
    });

    socket.on("qdn:join", (inputCode, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const code = typeof inputCode === "string" ? inputCode.trim().toUpperCase() : "";
        if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
            return reply({ error: "Le code du salon doit contenir 6 caractères valides." });
        }
        if (findQdnRoomForUser(socket.data.user.id) || findUndercoverRoomForUser(socket.data.user.id)) {
            return reply({ error: "Tu es déjà dans un salon." });
        }

        const room = qdnRooms.get(code);
        if (!room) return reply({ error: "Aucun salon ne correspond à ce code." });
        if (room.status !== "lobby") return reply({ error: "La partie a déjà commencé." });
        if (room.players.size >= 12) return reply({ error: "Ce salon est complet (12 joueurs maximum)." });

        const userId = socket.data.user.id;
        room.players.set(userId, {
            userId,
            username: socket.data.user.username,
            usernameColor: socket.data.user.username_color,
            socketId: socket.id,
            disconnectTimer: null,
            score: 0
        });
        room.notice = "";
        socket.data.qdnRoomCode = code;
        socket.join(code);
        reply({ ok: true, code });
        broadcastQdnRoom(room);
    });

    socket.on("qdn:leave", (_payload, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        leaveQdnRoom(socket);
        reply({ ok: true });
    });

    socket.on("qdn:kick", (targetId, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const room = qdnRooms.get(socket.data.qdnRoomCode);
        if (!room) return reply({ error: "Tu n'es dans aucun salon." });
        if (room.hostId !== socket.data.user.id) {
            return reply({ error: "Seul le chef du salon peut expulser un joueur." });
        }
        if (!Number.isInteger(targetId) || targetId === socket.data.user.id) {
            return reply({ error: "Choisis un autre joueur à expulser." });
        }
        const target = room.players.get(targetId);
        if (!target) return reply({ error: "Ce joueur n'est plus dans le salon." });

        const targetSocket = io.sockets.sockets.get(target.socketId);
        if (targetSocket) {
            targetSocket.emit("qdn:kicked");
            leaveQdnRoom(targetSocket);
        } else {
            removeQdnPlayer(room, target);
        }
        reply({ ok: true });
    });

    socket.on("qdn:start", (_payload, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const room = qdnRooms.get(socket.data.qdnRoomCode);
        if (!room) return reply({ error: "Tu n'es dans aucun salon." });
        if (room.hostId !== socket.data.user.id) {
            return reply({ error: "Seul le chef du salon peut lancer la partie." });
        }
        if (room.status !== "lobby") return reply({ error: "La partie a déjà commencé." });
        if (room.players.size < 2) return reply({ error: "Il faut au moins 2 joueurs pour commencer." });

        for (const player of room.players.values()) player.score = 0;
        room.questionQueue = [];
        room.lastQuestion = "";
        room.round = 1;
        room.question = getNextQdnQuestion(room);
        room.votes.clear();
        room.reveal = null;
        room.notice = "";
        room.status = "voting";
        reply({ ok: true });
        broadcastQdnRoom(room);
    });

    socket.on("qdn:vote", (targetId, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const room = qdnRooms.get(socket.data.qdnRoomCode);
        if (!room || room.status !== "voting") {
            return reply({ error: "Aucun vote n'est attendu pour le moment." });
        }
        const voter = room.players.get(socket.data.user.id);
        if (!voter || voter.socketId !== socket.id) {
            return reply({ error: "Tu ne fais pas partie de ce salon." });
        }
        if (room.votes.has(voter.userId)) {
            return reply({ error: "Tu as déjà voté pour cette manche." });
        }
        if (!Number.isInteger(targetId) || !room.players.has(targetId)) {
            return reply({ error: "Choisis un joueur présent dans le salon." });
        }

        room.votes.set(voter.userId, targetId);
        completeQdnVoting(room);
        if (room.status === "voting") broadcastQdnRoom(room);
        reply({ ok: true });
    });

    socket.on("qdn:next", (_payload, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const room = qdnRooms.get(socket.data.qdnRoomCode);
        if (!room) return reply({ error: "Tu n'es dans aucun salon." });
        if (room.hostId !== socket.data.user.id) {
            return reply({ error: "Seul le chef du salon peut continuer." });
        }
        if (room.status !== "reveal") {
            return reply({ error: "Attends la révélation des votes." });
        }
        if (room.round >= room.rounds) {
            room.status = "finished";
            room.notice = "";
        } else {
            room.round++;
            room.question = getNextQdnQuestion(room);
            room.votes.clear();
            room.reveal = null;
            room.status = "voting";
            room.notice = "";
        }
        reply({ ok: true });
        broadcastQdnRoom(room);
    });

    socket.on("chat:send", (message, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        if (typeof message !== "string") {
            return reply({ error: "Le message doit être du texte." });
        }

        const text = message.trim();
        if (!text || text.length > maxMessageLength) {
            return reply({ error: `Le message doit contenir de 1 à ${maxMessageLength} caractères.` });
        }

        const now = Date.now();
        if (lastMessageByUser.size > 1000) {
            for (const [userId, sentAt] of lastMessageByUser) {
                if (now - sentAt > 60_000) lastMessageByUser.delete(userId);
            }
        }
        const lastSent = lastMessageByUser.get(socket.data.user.id) || 0;
        if (now - lastSent < 1000) {
            return reply({ error: "Attends une seconde avant d'envoyer un autre message." });
        }

        lastMessageByUser.set(socket.data.user.id, now);
        const chatMessage = {
            userId: socket.data.user.id,
            username: socket.data.user.username,
            usernameColor: findUserById.get(socket.data.user.id).username_color,
            text,
            sentAt: new Date(now).toISOString()
        };
        chatHistory.push(chatMessage);
        if (chatHistory.length > maxChatHistory) chatHistory.shift();

        io.emit("chat:message", chatMessage);
        reply({ ok: true });
    });

    socket.on("disconnect", () => {
        deferQdnRoomLeave(socket);
        deferUndercoverRoomLeave(socket);
        io.emit("chat:presence", io.of("/").sockets.size);
    });
});

server.listen(port, () => {
    console.log(`CirclePlay est disponible sur http://localhost:${port}`);
});
