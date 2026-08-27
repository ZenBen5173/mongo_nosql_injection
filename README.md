# MongoDB NoSQL Injection — vulnerable vs. hardened

A side-by-side demonstration of **NoSQL operator injection**: two Express apps that
expose the same two endpoints against the same MongoDB database, where one passes
user input straight into the query and the other refuses to.

The point of the pairing is that no string is ever concatenated here. This is not
classic SQL injection — nothing is being escaped wrong. The vulnerability is that a
JSON request body can contain **MongoDB query operators**, and an app that hands the
body to `findOne()` unchanged is handing the attacker the query language itself.

Coursework for a Database Management System module. The companion Oracle/SQL version
of this experiment lives in
[oracle-sql-experiment](https://github.com/ZenBen5173/oracle-sql-experiment).

## The vulnerability

`insecure_app.js` (port 3000) does this:

```js
app.post("/login", async (req, res) => {
  const userInput = req.body;                                  // intentionally unsafe
  const user = await db.collection("users").findOne(userInput);
  res.json({ success: !!user });
});
```

A normal client sends `{ "username": "admin", "password": "admin123" }` and the query
means *"find the user with this name and this password."*

An attacker sends this instead:

```json
{ "username": "admin", "password": { "$ne": "admin123" } }
```

`$ne` means *not equal*. The query now means *"find the user named admin whose password
is anything other than `admin123`"* — which matches, so the app reports a successful
login. **The attacker is authenticated without ever knowing the password.**

`{ "$exists": true }` works the same way on either field, and `{}` on `/search` dumps
the entire products collection.

## The fix

`secure_app.js` (port 3001) exposes identical endpoints and applies two checks before
touching the database:

1. **Reject operator keys.** `hasMongoOperatorKeys()` walks the body recursively and
   rejects any object containing a key beginning with `$`. The recursion matters —
   the operator is nested inside a field value, not at the top level.
2. **Enforce types.** `username`, `password` and `name` must be plain strings. This
   is the check that actually closes the hole: a `$`-object is not a string, so even
   an operator the first check missed cannot reach the query.

The query is then rebuilt from fixed keys and validated values, so the shape of the
query is decided by the code and never by the request:

```js
const user = await db.collection("users").findOne({ username, password });
```

Rejected requests return `400` with `{ "rejected": true }`, which is what makes the
two apps easy to compare — same payload, one says `success: true`, the other says
`rejected: true`.

## Running it

Requires Node.js and a MongoDB instance on `mongodb://localhost:27017`.

```bash
npm install
npm run seed        # creates the users and products collections
```

Then start whichever app you want to test, in its own terminal:

```bash
npm run insecure    # http://localhost:3000
npm run secure      # http://localhost:3001
```

Both apps read the database `dbms_injection_test`, seeded with two users and four
products — the same fixtures as the Oracle version of the experiment.

## Test payloads

[`TESTS.md`](TESTS.md) has the full set of PowerShell `Invoke-RestMethod` commands used
to produce the results, for both apps and both endpoints. The short version:

| Payload | `/login` insecure (3000) | `/login` secure (3001) |
|---|---|---|
| `{"username":"admin","password":"admin123"}` | `success: true` | `success: true` |
| `{"username":"admin","password":{"$ne":"admin123"}}` | **`success: true`** — bypassed | `400 rejected` |
| `{"username":"admin","password":{"$exists":true}}` | **`success: true`** — bypassed | `400 rejected` |
| `{"username":{"$ne":"admin"},"password":"wrongpass"}` | **`success: true`** — bypassed | `400 rejected` |

| Payload | `/search` insecure (3000) | `/search` secure (3001) |
|---|---|---|
| `{"name":"Laptop"}` | 1 result | 1 result |
| `{"name":{"$ne":"Laptop"}}` | **all other products** | `400 rejected` |
| `{"price":{"$gt":0}}` | **entire collection** | `400 rejected` |
| `{}` | **entire collection** | `400 rejected` |

## A note on the code

The credentials in `seed.js` are stored and compared in plaintext. That is deliberate —
it keeps the injection itself readable, which is what the experiment is about. Do not
copy this authentication pattern; a real application hashes passwords with bcrypt or
argon2 and compares the hash.

`insecure_app.js` is intentionally vulnerable and exists only to be attacked. Run it
locally, against local data.
