# One-off rename: @iwkapps -> @mahmulp across source, manifests, and docs.
# Build artifacts (.next, .svelte-kit, dist, node_modules) are regenerated;
# we exclude them so generated maps / lockfile chunks don't get rewritten.

$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot/..").Path

$includeExtensions = @(
  ".ts", ".tsx", ".js", ".mjs", ".cjs",
  ".svelte", ".css", ".html",
  ".json", ".md",
  ".yml", ".yaml",
  ".env", ".env.example"
)

$excludeDirs = @(
  "node_modules",
  ".git",
  ".next",
  ".svelte-kit",
  "dist",
  "drizzle"
)

$pairs = @(
  @{ from = "@iwkapps/"; to = "@mahmulp/" },
  @{ from = "iwkapps";    to = "mahmulp"  }
)

$changed = 0

Get-ChildItem -Path $root -Recurse -File |
  Where-Object {
    $rel = $_.FullName.Substring($root.Length).TrimStart("\","/")
    foreach ($d in $excludeDirs) {
      if ($rel -like "$d*" -or $rel -like "*\$d\*" -or $rel -like "*/$d/*") { return $false }
    }
    if ($rel -eq "scripts/rename-scope.ps1") { return $false }
    if ($rel -like "bun.lock") { return $false }
    $ext = $_.Extension.ToLowerInvariant()
    if ($_.Name -eq ".env.example") { return $true }
    return $includeExtensions -contains $ext
  } |
  ForEach-Object {
    $path = $_.FullName
    $original = Get-Content -LiteralPath $path -Raw
    $next = $original
    foreach ($p in $pairs) {
      $next = $next.Replace($p.from, $p.to)
    }
    if ($next -ne $original) {
      Set-Content -LiteralPath $path -Value $next -NoNewline -Encoding UTF8
      $rel = $path.Substring($root.Length).TrimStart("\","/")
      Write-Host "rewrote $rel"
      $changed++
    }
  }

Write-Host ""
Write-Host "$changed file(s) updated."
