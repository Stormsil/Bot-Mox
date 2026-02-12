Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$envFile = Join-Path $repoRoot 'deploy/compose.prod-sim.env.example'

Push-Location $repoRoot
try {
  docker build -t bot-mox/frontend:prod-sim ./bot-mox
  docker build -t bot-mox/backend:prod-sim ./proxy-server

  docker compose `
    -f deploy/compose.stack.yml `
    --env-file $envFile `
    up -d --remove-orphans
} finally {
  Pop-Location
}
