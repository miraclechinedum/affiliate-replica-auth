// backend/index.js
require("dotenv").config();
console.log(">>> starting backend/index.js (MySQL mode)");

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);

// Read .env values (adjust for Laragon)
const {
  PORT = 4000,
  SESSION_SECRET = "dev-session-secret",
  DB_HOST = "127.0.0.1",
  DB_PORT = 3306,
  DB_USER = "root",
  DB_PASS = "",
  DB_NAME = "robin_affiliate_db",
  ADMIN_EMAIL = "admin@example.com",
  ADMIN_PASS = "password123",
} = process.env;

// Upload directory
const UPLOAD_DIR = path.resolve(__dirname, "mock-storage");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Create DB (if needed) and tables, return pool
// ---------- REPLACE initDbAndTables() with this ----------
async function initDbAndTables() {
  // Connect without database to possibly create DB
  const adminConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    multipleStatements: true, // OK here for the DB create
  });

  await adminConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`
  );
  await adminConn.end();

  // Create pool (do NOT enable multipleStatements here; we'll issue queries one at a time)
  const pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // Create tables one-by-one to avoid multi-statement parse errors
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS account_details (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bank JSON NULL,
      crypto JSON NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id VARCHAR(32) PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255),
      method ENUM('wire','crypto') DEFAULT 'crypto',
      selected_network VARCHAR(50),
      amount DECIMAL(20,2),
      txid VARCHAR(255),
      id_file_url VARCHAR(512),
      payment_proof_url VARCHAR(512),
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure at least one account_details row exists if absent
  const [accountCountRows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM account_details"
  );
  if (accountCountRows[0].cnt === 0) {
    const defaultBank = {
      bankName: "Demo Bank",
      accountName: "Demo Account",
      accountNumber: "0123456789",
      swift: "",
      notes: "",
    };
    const defaultCrypto = {
      btc: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
      eth: "0x0000000000000000000000000000000000000000",
      usdt: "TETHER-DEMO-ADDRESS",
    };
    await pool.query(
      "INSERT INTO account_details (bank, crypto) VALUES (?, ?)",
      [JSON.stringify(defaultBank), JSON.stringify(defaultCrypto)]
    );
    console.log("Inserted default account_details row into DB");
  }

  // Ensure a default admin exists
  const [adminCountRows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM admin"
  );
  if (adminCountRows[0].cnt === 0) {
    const hash = await bcrypt.hash(ADMIN_PASS, 10);
    await pool.query("INSERT INTO admin (email, password) VALUES (?, ?)", [
      ADMIN_EMAIL,
      hash,
    ]);
    console.log(`Created default admin: ${ADMIN_EMAIL}`);
  } else {
    console.log("Admin already exists in DB; skipping seeding.");
  }

  return pool;
}
// ---------- end replacement ----------

// Optional migration from mock-data.json into DB (runs only when DB tables empty)
// Replace your existing tryMigrateFromMockJson(pool) with this function
async function tryMigrateFromMockJson(pool) {
  const mockPath = path.resolve(__dirname, "mock-data.json");
  if (!fs.existsSync(mockPath)) {
    return;
  }

  let mock;
  try {
    mock = JSON.parse(fs.readFileSync(mockPath, "utf8"));
  } catch (err) {
    console.warn("Failed to parse mock-data.json; skipping migration.", err);
    return;
  }

  // Only migrate if submissions table is empty (idempotent)
  const [subCountRows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM submissions"
  );
  if (!(subCountRows && subCountRows[0] && subCountRows[0].cnt === 0)) {
    // already have submissions -> skip migration to avoid duplicates
    return;
  }

  if (!Array.isArray(mock.submissions) || mock.submissions.length === 0) {
    return;
  }

  const insertSqlWithDate = `INSERT INTO submissions
      (id, name, email, method, selected_network, amount, txid, id_file_url, payment_proof_url, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const insertSqlNoDate = `INSERT INTO submissions
      (id, name, email, method, selected_network, amount, txid, id_file_url, payment_proof_url, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

  for (const s of mock.submissions) {
    const id = s.id || nanoid(12);
    const name = s.name || null;
    const email = s.email || null;
    const method = s.method || "crypto";
    const selectedNetwork = s.selectedNetwork || null;
    const amount =
      s.amount !== undefined && s.amount !== null ? s.amount : null;
    const txid = s.txid || null;
    const idFileUrl = s.idFileUrl || null;
    const paymentProofUrl = s.paymentProofUrl || null;
    const status = s.status || "pending";

    // Normalize createdAt for MySQL: 'YYYY-MM-DD HH:MM:SS'
    let createdAtSql = null;
    if (s.createdAt) {
      try {
        const dt = new Date(s.createdAt);
        if (!isNaN(dt.getTime())) {
          // Format as 'YYYY-MM-DD HH:MM:SS'
          createdAtSql = dt.toISOString().slice(0, 19).replace("T", " ");
        } else {
          createdAtSql = null;
        }
      } catch (e) {
        createdAtSql = null;
      }
    }

    try {
      if (createdAtSql) {
        await pool.query(insertSqlWithDate, [
          id,
          name,
          email,
          method,
          selectedNetwork,
          amount,
          txid,
          idFileUrl,
          paymentProofUrl,
          status,
          createdAtSql,
        ]);
      } else {
        // createdAt invalid or missing -> use NOW()
        await pool.query(insertSqlNoDate, [
          id,
          name,
          email,
          method,
          selectedNetwork,
          amount,
          txid,
          idFileUrl,
          paymentProofUrl,
          status,
        ]);
      }
    } catch (err) {
      // Duplicate key (id) or other error: log an informative message and continue
      if (err && err.code === "ER_DUP_ENTRY") {
        console.warn(`Skipping migrate submission (duplicate id): ${id}`);
      } else {
        console.warn(
          `Skipping migrate submission (${id}): ${
            err && err.message ? err.message : err
          }`
        );
      }
      continue;
    }
  }

  console.log("Migrated submissions from mock-data.json into DB");
}

/* --------------------------
   Start server and wire routes
   -------------------------- */
(async () => {
  const pool = await initDbAndTables();

  // Attempt migration from mock file only if tables empty (idempotent)
  try {
    await tryMigrateFromMockJson(pool);
  } catch (err) {
    console.warn("Migration check failed:", err);
  }

  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(bodyParser.json());

  // optional request logger
  app.use((req, res, next) => {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} from ${
        req.ip
      }`
    );
    next();
  });

  // global error handler (catch-all)
  app.use((err, req, res, next) => {
    console.error(
      "Unhandled error middleware:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ message: "Internal server error" });
  });

  // Sessions store in MySQL
  const sessionStore = new MySQLStore(
    {
      // defaults, table will be created automatically
    },
    {
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
    }
  );

  app.use(
    session({
      key: "sid",
      secret: SESSION_SECRET,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 1000 * 60 * 60 * 8 },
    })
  );

  // Helper for queries
  const dbQuery = async (sql, params = []) => {
    const [rows] = await pool.query(sql, params);
    return rows;
  };

  // Auth middleware
  function requireAuth(req, res, next) {
    if (req.session && req.session.adminId) return next();
    return res.status(401).json({ message: "Unauthorized" });
  }

  /* --------------------------
     Admin auth routes
     -------------------------- */
  // defensive admin login route
  app.post("/admin/login", async (req, res) => {
    try {
      console.log("POST /admin/login called from", req.ip);
      // Log request body shape but avoid printing passwords plainly in production
      console.log("body keys:", req.body && Object.keys(req.body));

      const { email, password } = req.body || {};
      if (!email || !password) {
        console.warn("Missing credentials in request");
        return res.status(400).json({ message: "Missing credentials" });
      }

      // Query DB for admin by email
      const rows = await dbQuery("SELECT * FROM admin WHERE email = ?", [
        email,
      ]);
      if (!rows || rows.length === 0) {
        console.warn("Login failed - admin not found:", email);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const admin = rows[0];
      if (!admin.password) {
        console.error("Admin row has no password hash for", email);
        return res
          .status(500)
          .json({ message: "Server configuration error (no password set)" });
      }

      // bcrypt compare - make sure to use async compare
      const ok = await bcrypt.compare(password, admin.password);
      if (!ok) {
        console.warn("Login failed - bad password for", email);
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // success: create session
      req.session.adminId = admin.id;
      req.session.email = admin.email;
      console.log(
        `Admin login successful: id=${admin.id} email=${admin.email} from=${req.ip}`
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error(
        "POST /admin/login error:",
        err && err.stack ? err.stack : err
      );
      return res.status(500).json({
        message: "Server error",
        details: err && err.message ? err.message : String(err),
      });
    }
  });

  app.post("/admin/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.post("/admin/change-password", requireAuth, async (req, res) => {
    const { password } = req.body || {};
    if (!password || password.length < 6)
      return res.status(400).json({ message: "Password too short" });
    const hash = await bcrypt.hash(password, 10);
    try {
      await dbQuery("UPDATE admin SET password = ? WHERE id = ?", [
        hash,
        req.session.adminId,
      ]);
      return res.json({ ok: true });
    } catch (err) {
      console.error("Change password error", err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  /* --------------------------
     Account details endpoints (DB-backed)
     GET public, PUT protected
     -------------------------- */
  // defensive GET /account-details
  app.get("/account-details", async (req, res) => {
    try {
      console.log(
        "GET /account-details called from",
        req.ip,
        "session:",
        !!req.session?.adminId
      );
      const rows = await dbQuery(
        "SELECT * FROM account_details ORDER BY id DESC LIMIT 1"
      );
      console.log(
        "DB returned rows (account_details):",
        Array.isArray(rows) ? rows.length : typeof rows
      );

      if (!rows || rows.length === 0) {
        return res.json({});
      }

      const r = rows[0];
      // log field types and sample
      Object.keys(r).forEach((k) => {
        console.log(
          `account_details.${k} type=${
            r[k] === null ? "null" : Object.prototype.toString.call(r[k])
          }`
        );
      });
      console.log("account_details row preview:", r);

      // safe parser that handles strings, Buffers, objects
      const safeParseValue = (v) => {
        if (v === null || v === undefined) return null;
        // Buffer (mysql might return Buffer for JSON in some setups)
        if (Buffer.isBuffer(v)) {
          try {
            const s = v.toString("utf8");
            return JSON.parse(s);
          } catch (e) {
            return v.toString("utf8");
          }
        }
        if (typeof v === "object") {
          // convert RowDataPacket -> plain object
          try {
            return JSON.parse(JSON.stringify(v));
          } catch (e) {
            return v;
          }
        }
        if (typeof v === "string") {
          try {
            return JSON.parse(v);
          } catch (e) {
            return v;
          }
        }
        return v;
      };

      const bank = safeParseValue(r.bank);
      const crypto = safeParseValue(r.crypto);

      console.log(
        "Returning account-details bank type:",
        typeof bank,
        "crypto type:",
        typeof crypto
      );
      return res.json({ bank, crypto });
    } catch (err) {
      console.error(
        "GET /account-details error stack:",
        err && err.stack ? err.stack : err
      );
      return res.status(500).json({
        message: "Server error",
        details: err && err.message ? err.message : String(err),
      });
    }
  });

  app.put("/account-details", requireAuth, async (req, res) => {
    const { bank, crypto } = req.body || {};
    try {
      const rows = await dbQuery(
        "SELECT id FROM account_details ORDER BY id DESC LIMIT 1"
      );
      if (rows.length) {
        await dbQuery(
          "UPDATE account_details SET bank = ?, crypto = ? WHERE id = ?",
          [JSON.stringify(bank || {}), JSON.stringify(crypto || {}), rows[0].id]
        );
      } else {
        await dbQuery(
          "INSERT INTO account_details (bank, crypto) VALUES (?, ?)",
          [JSON.stringify(bank || {}), JSON.stringify(crypto || {})]
        );
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error("Put account details error", err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  /* --------------------------
     Submissions (DB-backed). Accept idFile, paymentProof
     -------------------------- */
  app.get("/submissions", requireAuth, async (req, res) => {
    try {
      console.log("GET /submissions by admin:", req.session?.email || req.ip);
      const rows = await dbQuery(
        "SELECT * FROM submissions ORDER BY created_at DESC LIMIT 1000"
      );
      console.log(
        "DB returned rows (submissions):",
        Array.isArray(rows) ? rows.length : typeof rows
      );

      // log a short preview to avoid flooding logs
      console.log(
        "Submissions preview (first 3):",
        (rows || []).slice(0, 3).map((r) => {
          // show id, created_at raw, and field types
          return {
            id: r.id,
            created_at_raw: r.created_at,
            types: Object.keys(r).reduce((acc, k) => {
              acc[k] = Object.prototype.toString.call(r[k]);
              return acc;
            }, {}),
          };
        })
      );

      const out = (rows || []).map((r) => {
        let created = null;
        try {
          // normalize created_at to ISO string if possible
          created = r.created_at ? new Date(r.created_at).toISOString() : null;
        } catch (e) {
          created = null;
        }
        // ensure URLs are strings
        return {
          ...r,
          created_at: created,
          id_file_url: r.id_file_url ? String(r.id_file_url) : null,
          payment_proof_url: r.payment_proof_url
            ? String(r.payment_proof_url)
            : null,
        };
      });

      return res.json(out);
    } catch (err) {
      console.error(
        "GET /submissions error stack:",
        err && err.stack ? err.stack : err
      );
      return res.status(500).json({
        message: "Server error",
        details: err && err.message ? err.message : String(err),
      });
    }
  });

  // defensive GET /submissions (admin-protected)
  app.get("/submissions", requireAuth, async (req, res) => {
    try {
      console.log("GET /submissions by admin:", req.session?.email || req.ip);
      const rows = await dbQuery(
        "SELECT * FROM submissions ORDER BY created_at DESC LIMIT 1000"
      );
      // Ensure created_at is a string that can be consumed by frontend
      const out = (rows || []).map((r) => ({
        ...r,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
        // leave id_file_url / payment_proof_url as-is
      }));
      return res.json(out);
    } catch (err) {
      console.error(
        "GET /submissions error:",
        err && err.stack ? err.stack : err
      );
      return res.status(500).json({
        message: "Server error",
        details: err && err.message ? err.message : String(err),
      });
    }
  });

  app.put("/submissions/:id/status", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body || {};
      await dbQuery("UPDATE submissions SET status = ? WHERE id = ?", [
        status,
        id,
      ]);
      return res.json({ ok: true });
    } catch (err) {
      console.error("Update submission status error", err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // Serve uploaded files (existing front-end URLs will still work)
  app.use("/mock-storage", express.static(UPLOAD_DIR));

  // health
  app.get("/_health", (req, res) => res.json({ ok: true }));

  app.listen(PORT, () => {
    console.log(`Backend (MySQL) listening on http://localhost:${PORT}`);
    console.log(`Using DB ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  });
})().catch((err) => {
  console.error("Fatal startup error", err);
  process.exit(1);
});
