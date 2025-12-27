const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Database = require("better-sqlite3");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3001;
const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASS = process.env.ADMIN_PASS || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Middlewares
app.use(helmet());
app.use(express.json({ limit: "20kb" }));

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl/postman
      return allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error("CORS blocked"));
    },
  })
);

app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Admin auth (JWT)
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) return res.status(401).json({ error: "Unauthorized" });
  if (!JWT_SECRET) return res.status(500).json({ error: "Server misconfigured" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// DB
const db = new Database("./data.sqlite");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    people INTEGER NOT NULL,
    notes TEXT,
    createdAt TEXT NOT NULL
  );
`);

// Prevent double booking (same date+time)
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_res_date_time ON reservations(date, time);`);
} catch {
  // If you already have duplicates, index creation can fail; handle later if needed.
}

app.get("/health", (req, res) => res.json({ ok: true }));

// ADMIN: login -> token
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Липсват данни" });

  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ error: "Грешно име или парола" });
  }

  if (!JWT_SECRET) return res.status(500).json({ error: "Server misconfigured" });

  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "8h" });
  res.json({ token });
});

// PUBLIC: see occupied times for a date (no personal data)
app.get("/availability", (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date е задължително (YYYY-MM-DD)" });

  const rows = db
    .prepare(`SELECT time FROM reservations WHERE date = ? ORDER BY time ASC`)
    .all(date);

  res.json({ date, bookedTimes: rows.map((r) => r.time) });
});

// ADMIN: full list
app.get("/reservations", requireAdmin, (req, res) => {
  const { date } = req.query;
  const rows = date
    ? db.prepare("SELECT * FROM reservations WHERE date = ? ORDER BY time ASC, id DESC").all(date)
    : db.prepare("SELECT * FROM reservations ORDER BY date DESC, time DESC, id DESC").all();
  res.json(rows);
});

// PUBLIC: create reservation
app.post("/reservations", (req, res) => {
  const { name, phone, date, time, people, notes } = req.body || {};
  if (!name || !date || !time || !people) {
    return res.status(400).json({ error: "Липсват: name, date, time, people" });
  }

  const p = Number(people);
  if (!Number.isInteger(p) || p < 1 || p > 50) {
    return res.status(400).json({ error: "people трябва да е 1–50" });
  }

  const createdAt = new Date().toISOString();

  try {
    const info = db
      .prepare(
        `INSERT INTO reservations (name, phone, date, time, people, notes, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(name.trim(), phone?.trim() || null, date, time, p, notes?.trim() || null, createdAt);

    const row = db.prepare("SELECT * FROM reservations WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    // Unique index blocks duplicate slot
    if (String(e?.message || "").toLowerCase().includes("unique")) {
      return res.status(409).json({ error: "Този час вече е зает" });
    }
    return res.status(500).json({ error: "Server error" });
  }
});

// ADMIN: delete
app.delete("/reservations/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM reservations WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Няма такава резервация" });

  db.prepare("DELETE FROM reservations WHERE id = ?").run(id);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`API: http://localhost:${PORT}`));
