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
    --env-file $envFile `
    down --remove-orphans
} finally {
  Pop-Location
}
