# Test payloads

Every command used to produce the results in the README. The insecure app runs on
port 3000, the secure app on 3001 — the payloads are identical, only the port changes.

## Setup

```bash
npm install
npm run seed
node insecure_app.js   # port 3000
node secure_app.js     # port 3001
```

## Helper (secure app returns 400s, so errors need catching)

```powershell
function Post-Json2 {
  param([string]$url, [string]$json)

  $err = $null
  $res = Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body $json `
    -ErrorAction SilentlyContinue -ErrorVariable err

  if ($res) {
    $res | ConvertTo-Json -Compress
  } else {
    ($err | Out-String)
  }
}
```

## Insecure app — login bypass (port 3000)

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/login" `
  -ContentType "application/json" `
  -Body '{ "username": "admin", "password": { "$ne": "admin123" } }'

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/login" `
  -ContentType "application/json" `
  -Body '{ "username": "admin", "password": { "$exists": true } }'

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/login" `
  -ContentType "application/json" `
  -Body '{ "username": { "$ne": "admin" }, "password": "wrongpass" }'

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/login" `
  -ContentType "application/json" `
  -Body '{ "username": { "$exists": true }, "password": { "$exists": true } }'
```

## Insecure app — search dump (port 3000)

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/search" `
  -ContentType "application/json" `
  -Body '{ "name": { "$ne": "Laptop" } }'

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/search" `
  -ContentType "application/json" `
  -Body '{ "name": { "$exists": true } }'

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/search" `
  -ContentType "application/json" `
  -Body '{ "price": { "$gt": 0 } }'

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/search" `
  -ContentType "application/json" `
  -Body '{}'
```

## Secure app — login, same payloads all rejected (port 3001)

```powershell
$body = @{ username="admin"; password=@{ '$ne'="admin123" } } | ConvertTo-Json -Compress
Post-Json2 "http://localhost:3001/login" $body

$body = @{ username="admin"; password=@{ '$exists'=$true } } | ConvertTo-Json -Compress
Post-Json2 "http://localhost:3001/login" $body

$body = @{ username=@{ '$ne'="admin" }; password="wrongpass" } | ConvertTo-Json -Compress
Post-Json2 "http://localhost:3001/login" $body

$body = @{ username=@{ '$exists'=$true }; password=@{ '$exists'=$true } } | ConvertTo-Json -Compress
Post-Json2 "http://localhost:3001/login" $body
```

## Secure app — search, same payloads all rejected (port 3001)

```powershell
$body = @{ name=@{ '$ne'="Laptop" } } | ConvertTo-Json -Compress
Post-Json2 "http://localhost:3001/search" $body

$body = @{ name=@{ '$exists'=$true } } | ConvertTo-Json -Compress
Post-Json2 "http://localhost:3001/search" $body

$body = @{ price=@{ '$gt'=0 } } | ConvertTo-Json -Compress
Post-Json2 "http://localhost:3001/search" $body

$body = @{} | ConvertTo-Json -Compress
Post-Json2 "http://localhost:3001/search" $body
```
