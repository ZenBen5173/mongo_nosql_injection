const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");

const app = express();
app.use(bodyParser.json());

const url = "mongodb://localhost:27017";
const dbName = "dbms_injection_test";

let db;

MongoClient.connect(url)
  .then((client) => {
    db = client.db(dbName);
    console.log("Connected to MongoDB (SECURE APP)");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

/**
 * Strict input validation helpers
 */
function isPlainString(x) {
  return typeof x === "string";
}

function hasMongoOperatorKeys(obj) {
  // Reject keys that start with '$' anywhere in the object (basic operator injection defense)
  if (!obj || typeof obj !== "object") return false;
  for (const k of Object.keys(obj)) {
    if (k.startsWith("$")) return true;
    const v = obj[k];
    if (v && typeof v === "object" && hasMongoOperatorKeys(v)) return true;
  }
  return false;
}

/**
 * SECURE LOGIN
 * Only accept username/password as strings. Reject objects/operators.
 */
app.post("/login", async (req, res) => {
  try {
    const body = req.body;

    // Basic shape validation
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ success: false, rejected: true });
    }

    if (hasMongoOperatorKeys(body)) {
      return res.status(400).json({ success: false, rejected: true });
    }

    const { username, password } = body;

    // Type validation (critical for blocking object/operator injection)
    if (!isPlainString(username) || !isPlainString(password)) {
      return res.status(400).json({ success: false, rejected: true });
    }

    // Safe query construction: fixed keys, fixed value types
    const user = await db.collection("users").findOne({ username, password });
    return res.json({ success: !!user, rejected: false });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * SECURE SEARCH
 * Only allow searching by name string. Reject objects/operators.
 */
app.post("/search", async (req, res) => {
  try {
    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ count: 0, results: [], rejected: true });
    }

    if (hasMongoOperatorKeys(body)) {
      return res.status(400).json({ count: 0, results: [], rejected: true });
    }

    const { name } = body;

    if (!isPlainString(name)) {
      return res.status(400).json({ count: 0, results: [], rejected: true });
    }

    const results = await db.collection("products").find({ name }).toArray();
    return res.json({ count: results.length, results, rejected: false });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

app.listen(3001, () => {
  console.log("Secure app running at http://localhost:3001");
});
