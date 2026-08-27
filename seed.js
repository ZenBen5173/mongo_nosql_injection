/**
 * Seeds the database both demo apps read from.
 * Run once before starting either app:  node seed.js
 */
const { MongoClient } = require("mongodb");

const url = "mongodb://localhost:27017";
const dbName = "dbms_injection_test";

const users = [
  { username: "admin", password: "admin123", role: "ADMIN" },
  { username: "user1", password: "password1", role: "USER" },
];

const products = [
  { name: "Laptop", category: "Electronics", price: 3500 },
  { name: "Mouse", category: "Electronics", price: 50 },
  { name: "Keyboard", category: "Electronics", price: 120 },
  { name: "Chair", category: "Furniture", price: 300 },
];

(async () => {
  const client = await MongoClient.connect(url);
  const db = client.db(dbName);

  await db.collection("users").deleteMany({});
  await db.collection("products").deleteMany({});
  await db.collection("users").insertMany(users);
  await db.collection("products").insertMany(products);

  console.log(`Seeded ${users.length} users and ${products.length} products into "${dbName}".`);
  await client.close();
})().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
