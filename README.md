# MongoDB NoSQL Injection: vulnerable vs. hardened

**You would think a database with no SQL can't have SQL injection.** Then you send
`{"$ne": ""}` as your password and log in as admin anyway.

MongoDB queries are JSON objects, and a JSON request body can smuggle in **query operators**.
An app that hands the body straight to `findOne()` is not handing the attacker a string to
escape, it is handing them the query language itself. This repo shows that attack and its fix,
side by side.

It is two Express apps exposing the same login and search endpoints against the same database.
One passes your input straight into the query. The other refuses to. Same payloads, very
different results.

Coursework for a Database Management System module. There is a companion Oracle/SQL version of
the same experiment in
[oracle-sql-experiment](https://github.com/ZenBen5173/oracle-sql-experiment).

## The attack, in one line

The insecure login does this:

```js
app.post("/login", async (req, res) => {
  const userInput = req.body;                                  // intentionally unsafe
  const user = await db.collection("users").findOne(userInput);
  res.json({ success: !!user });
});
```

A normal client sends `{ "username": "admin", "password": "admin123" }`, meaning "find the
user with this name and this password." An attacker sends this instead:

```json
{ "username": "admin", "password": { "$ne": "admin123" } }
```

`$ne` means *not equal*, so the query now means "find the user named admin whose password is
anything other than `admin123`," which matches. The app reports a successful login and the
attacker is in, without ever knowing the password. `{ "$exists": true }` does the same job,
and `{}` on the search endpoint dumps the entire product collection.

## The fix

The hardened app exposes identical endpoints and runs two checks before touching the database:

1. **Reject operator keys.** A recursive walk rejects any object containing a key that starts
   with `$`. The recursion matters, because the operator hides inside a field value, not at
   the top level.
2. **Enforce types.** `username`, `password`, and `name` must be plain strings. This is the
   check that actually closes the hole: a `$`-object is not a string, so even an operator the
   first check missed cannot reach the query.

The query is then rebuilt from fixed keys and validated values, so its shape is decided by the
code and never by the request:

```js
const user = await db.collection("users").findOne({ username, password });
```

Rejected requests come back as `400` with `{ "rejected": true }`, which is what makes the two
apps easy to compare: same payload, one says `success: true`, the other says `rejected: true`.

---

## Under the hood

### Running it

Needs Node.js and a MongoDB instance on `mongodb://localhost:27017`.

```bash
npm install
npm run seed        # creates the users and products collections
```

Then start whichever app you want to test, each in its own terminal:

```bash
npm run insecure    # http://localhost:3000
npm run secure      # http://localhost:3001
```

### Test payloads

[`TESTS.md`](TESTS.md) has the full set of PowerShell `Invoke-RestMethod` commands for both
apps and both endpoints. The short version:

| Payload | `/login` insecure (3000) | `/login` secure (3001) |
|---|---|---|
| `{"username":"admin","password":"admin123"}` | `success: true` | `success: true` |
| `{"username":"admin","password":{"$ne":"admin123"}}` | **`success: true`**, bypassed | `400 rejected` |
| `{"username":"admin","password":{"$exists":true}}` | **`success: true`**, bypassed | `400 rejected` |
| `{"username":{"$ne":"admin"},"password":"wrongpass"}` | **`success: true`**, bypassed | `400 rejected` |

| Payload | `/search` insecure (3000) | `/search` secure (3001) |
|---|---|---|
| `{"name":"Laptop"}` | 1 result | 1 result |
| `{"name":{"$ne":"Laptop"}}` | **all other products** | `400 rejected` |
| `{"price":{"$gt":0}}` | **entire collection** | `400 rejected` |
| `{}` | **entire collection** | `400 rejected` |

### A note on the code

The credentials in `seed.js` are stored and compared in plaintext. That is deliberate: it
keeps the injection readable, which is what the experiment is about. Do not copy this auth
pattern; a real app hashes passwords with bcrypt or argon2 and compares the hash. `insecure_app.js`
exists only to be attacked, so run it locally, against local data.
