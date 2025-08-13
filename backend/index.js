// backend/index.js (relevant portions)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const { nanoid } = require("nanoid");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);

const DATA_FILE = "./mock-data.json";
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      {
        details: {
          bank: {
            bankName: "Demo Bank",
            accountName: "Demo Account",
            accountNumber: "0123456789",
            swift: "",
            notes: "",
          },
          crypto: {
            btc: "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
            eth: "0x0000000000000000000000000000000000000000",
            usdt: "TETHER-DEMO-ADDRESS",
          },
        },
        submissions: [],
      },
      null,
      2
    )
  );
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());

const uploadDir = "./mock-storage";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

// accept two files: idFile and paymentProof
const upload = multer({ storage });

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE));
}
function writeData(d) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
}

// --- submissions: now accept two files using upload.fields ---
app.post(
  "/submissions",
  upload.fields([
    { name: "idFile", maxCount: 1 },
    { name: "paymentProof", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const d = readData();
      const id = nanoid(8);

      // if files were provided, get their filenames
      let idFileUrl = null;
      let paymentProofUrl = null;
      if (req.files && req.files["idFile"] && req.files["idFile"][0]) {
        idFileUrl = "/mock-storage/" + req.files["idFile"][0].filename;
      }
      if (
        req.files &&
        req.files["paymentProof"] &&
        req.files["paymentProof"][0]
      ) {
        paymentProofUrl =
          "/mock-storage/" + req.files["paymentProof"][0].filename;
      }

      const item = {
        id,
        name: req.body.name,
        email: req.body.email,
        method: req.body.method,
        selectedNetwork: req.body.selectedNetwork || null,
        amount: req.body.amount,
        txid: req.body.txid || null,
        idFileUrl,
        paymentProofUrl,
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      d.submissions.unshift(item);
      writeData(d);

      console.log("New submission:", item);
      res.json({ id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// serve uploaded files
app.use("/mock-storage", express.static("mock-storage"));

// account-details endpoints (GET public, PUT protected in your existing code)
// ... keep your existing auth and account endpoints, they should work with the new nested structure ...

// EXAMPLE: keep a simple GET for /account-details:
app.get("/account-details", (req, res) => {
  const d = readData();
  res.json(d.details);
});

// For PUT /account-details you already had a route; ensure it accepts nested bank & crypto objects
// e.g. (keep your existing requireAuth middleware for PUT)
app.put("/account-details", (req, res) => {
  try {
    const d = readData();
    d.details = req.body;
    writeData(d);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: "Failed to save" });
  }
});
