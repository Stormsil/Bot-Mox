Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$envFile = Join-Path $repoRoot 'deploy/compose.prod-sim.env'
if (!(Test-Path $envFile)) {
  $envFile = Join-Path $repoRoot 'deploy/compose.prod-sim.env.example'
}

Push-Location $repoRoot
try {
  docker compose `
    -f deploy/compose.stack.yml `
    -f deploy/compose.dev.override.yml `
    --env-file $envFile `
    up -d --remove-orphans
} finally {
  Pop-Location
}
