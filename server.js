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

io.engine.use(sessionMiddleware);
io.use((socket, next) => {
    const userId = socket.request.session && socket.request.session.userId;
    const user = userId ? findUserById.get(userId) : null;
    if (!user) return next(new Error("AUTH_REQUIRED"));

    socket.data.user = user;
    socket.data.sessionId = socket.request.sessionID;
    next();
});

io.on("connection", socket => {
    socket.emit("chat:history", chatHistory);
    io.emit("chat:presence", io.of("/").sockets.size);

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
        io.emit("chat:presence", io.of("/").sockets.size);
    });
});

server.listen(port, () => {
    console.log(`CirclePlay est disponible sur http://localhost:${port}`);
});
