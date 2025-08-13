// backend/index.js
// MySQL-backed server with auth, sessions, account-details, submissions, file uploads

require("dotenv").config();

console.log(">>> starting backend/index.js");

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const { nanoid } = require("nanoid");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);

/* --------------------------
   Env
   -------------------------- */
const {
  PORT = 4000,
  SESSION_SECRET = "dev-session-secret",
  DB_HOST = "127.0.0.1",
  DB_PORT = 3306,
  DB_USER = "root",
  DB_PASS = "",
  DB_NAME = "affiliate_db",
  ADMIN_EMAIL = "admin@example.com",
  ADMIN_PASS = "password123",
} = process.env;

/* --------------------------
   DB bootstrap (create DB/tables if missing)
   -------------------------- */
async function initDb() {
  // Create database if not exists
  const adminConn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
  });
  await adminConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`
  );
  await adminConn.end();

  // App pool
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

  // Tables
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

  // Ensure one account_details row exists
  const [cntRows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM account_details"
  );
  if (cntRows[0].cnt === 0) {
    const defaultBank = {
      bankName: "Demo Bank",
      accountName: "Demo Account",
      accountNumber: "0123456789",
      swift: "",
      notes: "Local transfers only",
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
    console.log("Inserted default account_details row");
  }

  // Seed default admin if none
  const [aRows] = await pool.query("SELECT COUNT(*) AS cnt FROM admin");
  if (aRows[0].cnt === 0) {
    const hash = await bcrypt.hash(ADMIN_PASS, 10);
    await pool.query("INSERT INTO admin (email, password) VALUES (?, ?)", [
      ADMIN_EMAIL,
      hash,
    ]);
    console.log(`Created default admin: ${ADMIN_EMAIL}`);
  } else {
    console.log("Admin user exists; seeding skipped.");
  }

  return pool;
}

/* --------------------------
   Start server
   -------------------------- */
(async () => {
  const pool = await initDb();

  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(bodyParser.json());

  // Upload dir
  const uploadDir = "./mock-storage";
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
  });
  const upload = multer({ storage });

  // Sessions in MySQL
  const sessionStore = new MySQLStore(
    {
      // defaults are fine; table will be created automatically
    },
    // pass native mysql2 connection options, not the pool object
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
      cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 hours
    })
  );

  // Helper query
  const dbQuery = async (sql, params = []) => {
    const [rows] = await pool.query(sql, params);
    return rows;
  };

  /* --------------------------
     Auth middleware
     -------------------------- */
  function requireAuth(req, res, next) {
    if (req.session && req.session.adminId) return next();
    return res.status(401).json({ message: "Unauthorized" });
  }

  /* --------------------------
     Admin routes
     -------------------------- */
  app.post("/admin/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ message: "Missing credentials" });

    try {
      const rows = await dbQuery("SELECT * FROM admin WHERE email = ?", [
        email,
      ]);
      if (!rows.length)
        return res.status(401).json({ message: "Invalid credentials" });
      const admin = rows[0];
      const ok = await bcrypt.compare(password, admin.password);
      if (!ok) return res.status(401).json({ message: "Invalid credentials" });

      req.session.adminId = admin.id;
      req.session.email = admin.email;
      return res.json({ ok: true });
    } catch (err) {
      console.error("Login error", err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/admin/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.post("/admin/change-password", requireAuth, async (req, res) => {
    const { password } = req.body || {};
    if (!password || password.length < 6)
      return res.status(400).json({ message: "Password too short" });

    try {
      const hash = await bcrypt.hash(password, 10);
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
     Account details
     GET public, PUT protected
     -------------------------- */
  app.get("/account-details", async (req, res) => {
    try {
      const rows = await dbQuery(
        "SELECT * FROM account_details ORDER BY id DESC LIMIT 1"
      );
      if (!rows.length) return res.json({});
      const r = rows[0];
      const bank = r.bank ? JSON.parse(r.bank) : null;
      const crypto = r.crypto ? JSON.parse(r.crypto) : null;
      return res.json({ bank, crypto });
    } catch (err) {
      console.error("Get account details error", err);
      return res.status(500).json({ message: "Server error" });
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
     Submissions (files: idFile, paymentProof)
     -------------------------- */
  app.post(
    "/submissions",
    upload.fields([
      { name: "idFile", maxCount: 1 },
      { name: "paymentProof", maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        const id = nanoid(12);
        const {
          name = null,
          email = null,
          method = null,
          selectedNetwork = null,
          amount = null,
          txid = null,
        } = req.body || {};

        let idFileUrl = null;
        let paymentProofUrl = null;
        if (req.files && req.files["idFile"]?.[0]) {
          idFileUrl = "/mock-storage/" + req.files["idFile"][0].filename;
        }
        if (req.files && req.files["paymentProof"]?.[0]) {
          paymentProofUrl =
            "/mock-storage/" + req.files["paymentProof"][0].filename;
        }

        await dbQuery(
          `INSERT INTO submissions
           (id, name, email, method, selected_network, amount, txid, id_file_url, payment_proof_url, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            name,
            email,
            method,
            selectedNetwork,
            amount ? Number(amount) : null,
            txid,
            idFileUrl,
            paymentProofUrl,
            "pending",
          ]
        );

        console.log("New submission saved", id);
        return res.json({ id });
      } catch (err) {
        console.error("Submission error", err);
        return res.status(500).json({ message: "Server error" });
      }
    }
  );

  // Admin: list submissions
  app.get("/submissions", requireAuth, async (req, res) => {
    try {
      const rows = await dbQuery(
        "SELECT * FROM submissions ORDER BY created_at DESC LIMIT 1000"
      );
      return res.json(rows);
    } catch (err) {
      console.error("Get submissions error", err);
      return res.status(500).json({ message: "Server error" });
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
      console.error("Update submission status", err);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // Serve uploaded files
  app.use("/mock-storage", express.static("mock-storage"));

  // Health
  app.get("/_health", (req, res) => res.json({ ok: true }));

  // Listen
  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
})().catch((err) => {
  console.error("Fatal startup error", err);
  process.exit(1);
});
