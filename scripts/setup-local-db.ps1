# Start local Postgres (Docker) and wait until ready.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "Docker is not installed."
  Write-Host "Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
  Write-Host "Then run: docker compose up -d"
  exit 1
}

docker compose up -d
Write-Host "Waiting for PostgreSQL..."
$ok = $false
for ($i = 0; $i -lt 40; $i++) {
  $health = docker inspect --format='{{.State.Health.Status}}' aswp-postgres 2>$null
  if ($health -eq "healthy") { $ok = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ok) {
  Write-Host "Postgres container did not become healthy. Check: docker compose logs postgres"
  exit 1
}
Write-Host "PostgreSQL is ready on localhost:5432 (database: aswp, user: aswp)"
