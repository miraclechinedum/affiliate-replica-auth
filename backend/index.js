require("dotenv").config();
console.log(">>> starting backend/index.js (MySQL mode)");

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { nanoid } = require("nanoid");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);

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

const UPLOAD_DIR = path.resolve(__dirname, "mock-storage");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

async function initDbAndTables() {
  const adminConn = mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    multipleStatements: true,
  });
  const adminConnP = adminConn.promise();

  await adminConnP.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`
  );
  await adminConnP.end();

  const rawPool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  const pool = rawPool.promise();

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

  const [accountCountRows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM account_details"
  );
  if (
    accountCountRows &&
    accountCountRows[0] &&
    accountCountRows[0].cnt === 0
  ) {
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

  const [adminCountRows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM admin"
  );
  if (adminCountRows && adminCountRows[0] && adminCountRows[0].cnt === 0) {
    const hash = await bcrypt.hash(ADMIN_PASS, 10);
    await pool.query("INSERT INTO admin (email, password) VALUES (?, ?)", [
      ADMIN_EMAIL,
      hash,
    ]);
    console.log(`Created default admin: ${ADMIN_EMAIL}`);
  } else {
    console.log("Admin already exists in DB; skipping seeding.");
  }

  return { rawPool, pool };
}

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

  const [subCountRows] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM submissions"
  );
  if (!(subCountRows && subCountRows[0] && subCountRows[0].cnt === 0)) {
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

    let createdAtSql = null;
    if (s.createdAt) {
      try {
        const dt = new Date(s.createdAt);
        if (!isNaN(dt.getTime())) {
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

(async () => {
  const { rawPool, pool } = await initDbAndTables();
  try {
    await tryMigrateFromMockJson(pool);
  } catch (err) {
    console.warn("Migration check failed:", err);
  }

  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(bodyParser.json());

  app.use((req, res, next) => {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} from ${
        req.ip
      }`
    );
    next();
  });

  app.use((err, req, res, next) => {
    console.error(
      "Unhandled error middleware:",
      err && err.stack ? err.stack : err
    );
    res.status(500).json({ message: "Internal server error" });
  });

  const sessionStore = new MySQLStore({}, rawPool);

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

  const dbQuery = async (sql, params = []) => {
    const [rows] = await pool.query(sql, params);
    return rows;
  };

  function requireAuth(req, res, next) {
    if (req.session && req.session.adminId) return next();
    return res.status(401).json({ message: "Unauthorized" });
  }

  app.post("/admin/login", async (req, res) => {
    try {
      console.log("POST /admin/login called from", req.ip);
      console.log("body keys:", req.body && Object.keys(req.body));

      const { email, password } = req.body || {};
      if (!email || !password) {
        console.warn("Missing credentials in request");
        return res.status(400).json({ message: "Missing credentials" });
      }

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

      const ok = await bcrypt.compare(password, admin.password);
      if (!ok) {
        console.warn("Login failed - bad password for", email);
        return res.status(401).json({ message: "Invalid credentials" });
      }

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
      Object.keys(r).forEach((k) => {
        console.log(
          `account_details.${k} type=${
            r[k] === null ? "null" : Object.prototype.toString.call(r[k])
          }`
        );
      });
      console.log("account_details row preview:", r);

      const safeParseValue = (v) => {
        if (v === null || v === undefined) return null;

        if (Buffer.isBuffer(v)) {
          try {
            const s = v.toString("utf8");
            return JSON.parse(s);
          } catch (e) {
            return v.toString("utf8");
          }
        }
        if (typeof v === "object") {
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

      console.log(
        "Submissions preview (first 3):",
        (rows || []).slice(0, 3).map((r) => {
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
          created = r.created_at ? new Date(r.created_at).toISOString() : null;
        } catch (e) {
          created = null;
        }

        return {
          ...r,
          created_at: created,
          idFileUrl: r.id_file_url ? String(r.id_file_url) : null,
          paymentProofUrl: r.payment_proof_url
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

  app.post(
    "/submissions",
    upload.fields([
      { name: "idFile", maxCount: 1 },
      { name: "paymentProof", maxCount: 1 },
    ]),
    async (req, res) => {
      try {
        console.log("Received submission:", {
          body: req.body,
          files: req.files,
        });

        const { name, email, method, amount, txid, selectedNetwork } = req.body;

        if (!name || !email || !amount || !method) {
          return res.status(400).json({
            error: "Missing required fields",
            message: "Name, email, amount, and payment method are required",
          });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            error: "Invalid email format",
            message: "Please provide a valid email address",
          });
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
          return res.status(400).json({
            error: "Invalid amount",
            message: "Amount must be a positive number",
          });
        }

        if (!req.files || !req.files.idFile) {
          return res.status(400).json({
            error: "Missing ID file",
            message: "Proof of identity is required",
          });
        }

        const submissionId = nanoid(12);

        const idFileUrl = req.files.idFile
          ? `/mock-storage/${req.files.idFile[0].filename}`
          : null;
        const paymentProofUrl = req.files.paymentProof
          ? `/mock-storage/${req.files.paymentProof[0].filename}`
          : null;

        await dbQuery(
          `
          INSERT INTO submissions 
          (id, name, email, method, selected_network, amount, txid, id_file_url, payment_proof_url, status) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            submissionId,
            name.trim(),
            email.trim().toLowerCase(),
            method,
            selectedNetwork || null,
            numAmount,
            txid || null,
            idFileUrl,
            paymentProofUrl,
            "pending",
          ]
        );

        console.log("Submission saved successfully with ID:", submissionId);

        res.status(200).json({
          success: true,
          message: "Payment submission received successfully",
          submissionId: submissionId,
          data: {
            id: submissionId,
            status: "pending",
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error("Error processing submission:", error);

        if (
          error.message &&
          error.message.includes("Only images and PDF files are allowed!")
        ) {
          return res.status(400).json({
            error: "Invalid file type",
            message: "Only image files and PDFs are allowed",
          });
        }

        res.status(500).json({
          error: "Server error",
          message: "An error occurred while processing your submission",
        });
      }
    }
  );

  app.use("/mock-storage", express.static(UPLOAD_DIR));

  app.get("/_health", (req, res) => res.json({ ok: true }));

  app.listen(PORT, () => {
    console.log(`Backend (MySQL) listening on http://localhost:${PORT}`);
    console.log(`Using DB ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  });
})().catch((err) => {
  console.error("Fatal startup error", err);
  process.exit(1);
});
