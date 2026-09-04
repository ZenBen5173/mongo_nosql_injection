<h1 align="center">MongoDB NoSQL Injection: vulnerable vs. hardened</h1>

<p align="center">
  You'd think a database with no SQL can't have SQL injection. Then you send
  <code>{"$ne": ""}</code> as your password and log in as admin anyway.
</p>

<p align="center">
  <a href="#the-attack">The attack</a> ·
  <a href="#the-fix">The fix</a> ·
  <a href="#run-it">Run it</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/topic-NoSQL%20injection-red" alt="NoSQL injection" />
  <img src="https://img.shields.io/badge/stack-Express%20%2B%20MongoDB-13aa52" alt="Express + MongoDB" />
  <img src="https://img.shields.io/badge/pairs-vulnerable%20vs%20hardened-4f46e5" alt="vulnerable vs hardened" />
</p>

## Introduction

MongoDB queries are JSON objects, and a JSON request body can smuggle in query operators. An app
that hands the body straight to `findOne()` is not handing the attacker a string to escape, it is
handing them the query language itself. This repo shows the attack and its fix as two Express apps
with the same endpoints against the same database. Coursework for a Database Management System
module, with a companion Oracle version in
[oracle-sql-experiment](https://github.com/ZenBen5173/oracle-sql-experiment).

## The attack

The insecure login passes the request body straight into the query:

```js
const user = await db.collection("users").findOne(req.body);   // intentionally unsafe
```

A normal client sends `{ "username": "admin", "password": "admin123" }`. An attacker sends:

```json
{ "username": "admin", "password": { "$ne": "admin123" } }
```

`$ne` means *not equal*, so the query matches the admin whose password is anything other than
`admin123`, and the app reports a successful login without knowing the password. `{}` on the search
endpoint dumps the entire collection.

## The fix

The hardened app runs two checks before touching the database: **reject any key starting with `$`**
(recursively, since the operator hides in a field value), and **require the fields to be plain
strings** (a `$`-object is not a string, so it can't reach the query). The query is then rebuilt
from fixed keys and validated values:

```js
const user = await db.collection("users").findOne({ username, password });
```

Rejected requests return `400` with `{ "rejected": true }`, so the two apps are easy to compare:
same payload, one says `success: true`, the other says `rejected`.

## Run it

Needs Node.js and a MongoDB instance on `mongodb://localhost:27017`.

```bash
npm install
npm run seed        # create the users and products collections
npm run insecure    # http://localhost:3000
npm run secure      # http://localhost:3001  (in a second terminal)
```

The full set of test payloads for both apps is in [`TESTS.md`](TESTS.md). Passwords are stored in
plaintext on purpose, to keep the injection readable; `insecure_app.js` exists only to be attacked,
so run it locally against local data.
