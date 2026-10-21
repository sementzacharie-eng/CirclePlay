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
const qdnRoundChoices = [10, 20, 30, 40, 50];
const qdnRoomCodeCharacters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);

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

const findUserByUsername = database.prepare(
    "SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE"
);
const findUserById = database.prepare(
    "SELECT id, username FROM users WHERE id = ?"
);
const createUser = database.prepare(
    "INSERT INTO users (username, password_hash) VALUES (?, ?)"
);

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
    store: new SqliteSessionStore(database),
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
    if (typeof password !== "string" || password.length < 10) {
        return "Le mot de passe doit contenir au moins 10 caractères.";
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

app.get("/api/auth/me", (req, res, next) => {
    try {
        const user = req.session.userId
            ? findUserById.get(req.session.userId)
            : null;
        res.json({ user: user ? { id: user.id, username: user.username } : null });
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
        const result = createUser.run(username, passwordHash);
        await regenerateSession(req);
        req.session.userId = Number(result.lastInsertRowid);
        await saveSession(req);
        res.status(201).json({ user: { id: Number(result.lastInsertRowid), username } });
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
        req.session.userId = user.id;
        await saveSession(req);
        res.json({ user: { id: user.id, username: user.username } });
    } catch (error) {
        next(error);
    }
});

app.post("/api/auth/logout", (req, res, next) => {
    const sessionId = req.sessionID;
    req.session.destroy(error => {
        if (error) return next(error);
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

io.engine.use(sessionMiddleware);
io.use((socket, next) => {
    const userId = socket.request.session && socket.request.session.userId;
    const user = userId ? findUserById.get(userId) : null;
    if (!user) return next(new Error("AUTH_REQUIRED"));

    socket.data.user = user;
    socket.data.sessionId = socket.request.sessionID;
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
        io.to(player.socketId).emit("qdn:state", getQdnRoomState(room, player));
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

function leaveQdnRoom(socket) {
    const roomCode = socket.data.qdnRoomCode;
    if (!roomCode) return;

    socket.data.qdnRoomCode = null;
    const room = qdnRooms.get(roomCode);
    if (!room) return;

    const player = room.players.get(socket.data.user.id);
    if (!player || player.socketId !== socket.id) return;
    room.players.delete(player.userId);
    room.votes.delete(player.userId);
    socket.leave(roomCode);

    if (room.players.size === 0) {
        qdnRooms.delete(roomCode);
        return;
    }
    if (room.hostId === player.userId) {
        room.hostId = room.players.keys().next().value;
    }
    room.notice = room.players.size < 3 && room.status !== "lobby" && room.status !== "finished"
        ? "Il faut au moins 3 joueurs. La partie est revenue au salon."
        : "";
    if (room.players.size < 3 && room.status !== "lobby" && room.status !== "finished") {
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

function findQdnRoomForUser(userId) {
    return Array.from(qdnRooms.values()).find(room => room.players.has(userId));
}

function generateQdnRoomCode() {
    let code;
    do {
        code = Array.from({ length: 6 }, () =>
            qdnRoomCodeCharacters[crypto.randomInt(qdnRoomCodeCharacters.length)]
        ).join("");
    } while (qdnRooms.has(code));
    return code;
}

io.on("connection", socket => {
    socket.emit("chat:history", chatHistory);
    io.emit("chat:presence", io.of("/").sockets.size);

    socket.on("qdn:create", (settings, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const userId = socket.data.user.id;
        if (findQdnRoomForUser(userId)) {
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
                socketId: socket.id,
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

    socket.on("qdn:join", (inputCode, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const code = typeof inputCode === "string" ? inputCode.trim().toUpperCase() : "";
        if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
            return reply({ error: "Le code du salon doit contenir 6 caractères valides." });
        }
        if (findQdnRoomForUser(socket.data.user.id)) {
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
            socketId: socket.id,
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

    socket.on("qdn:start", (_payload, acknowledge) => {
        const reply = typeof acknowledge === "function" ? acknowledge : () => {};
        const room = qdnRooms.get(socket.data.qdnRoomCode);
        if (!room) return reply({ error: "Tu n'es dans aucun salon." });
        if (room.hostId !== socket.data.user.id) {
            return reply({ error: "Seul le chef du salon peut lancer la partie." });
        }
        if (room.status !== "lobby") return reply({ error: "La partie a déjà commencé." });
        if (room.players.size < 3) return reply({ error: "Il faut au moins 3 joueurs pour commencer." });

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
            username: socket.data.user.username,
            text,
            sentAt: new Date(now).toISOString()
        };
        chatHistory.push(chatMessage);
        if (chatHistory.length > maxChatHistory) chatHistory.shift();

        io.emit("chat:message", chatMessage);
        reply({ ok: true });
    });

    socket.on("disconnect", () => {
        leaveQdnRoom(socket);
        io.emit("chat:presence", io.of("/").sockets.size);
    });
});

server.listen(port, () => {
    console.log(`CirclePlay est disponible sur http://localhost:${port}`);
});
