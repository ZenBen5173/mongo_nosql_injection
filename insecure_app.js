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
    console.log("Connected to MongoDB (INSECURE APP)");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

app.post("/login", async (req, res) => {
  const userInput = req.body; // intentionally unsafe
  const user = await db.collection("users").findOne(userInput);
  res.json({ success: !!user });
});

app.post("/search", async (req, res) => {
  const searchInput = req.body; // intentionally unsafe
  const results = await db.collection("products").find(searchInput).toArray();
  res.json({ count: results.length, results });
});

app.listen(3000, () => {
  console.log("Insecure app running at http://localhost:3000");
});
