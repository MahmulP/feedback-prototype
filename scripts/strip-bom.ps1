# Strip UTF-8 BOM from any text file in the workspace. PowerShell 5.1's
# Set-Content -Encoding UTF8 prepends a BOM, which breaks tools like PostCSS
# that read package.json with a JSON parser.

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
  "node_modules", ".git", ".next", ".svelte-kit", "dist", "drizzle"
)

$bom = [byte[]]@(0xEF, 0xBB, 0xBF)
$changed = 0

Get-ChildItem -Path $root -Recurse -File |
  Where-Object {
    $rel = $_.FullName.Substring($root.Length).TrimStart("\","/")
    foreach ($d in $excludeDirs) {
      if ($rel -like "$d*" -or $rel -like "*\$d\*" -or $rel -like "*/$d/*") { return $false }
    }
    $ext = $_.Extension.ToLowerInvariant()
    if ($_.Name -eq ".env.example") { return $true }
    return $includeExtensions -contains $ext
  } |
  ForEach-Object {
    $path = $_.FullName
    $bytes = [System.IO.File]::ReadAllBytes($path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq $bom[0] -and $bytes[1] -eq $bom[1] -and $bytes[2] -eq $bom[2]) {
      $stripped = New-Object byte[] ($bytes.Length - 3)
      [Array]::Copy($bytes, 3, $stripped, 0, $stripped.Length)
      [System.IO.File]::WriteAllBytes($path, $stripped)
      $rel = $path.Substring($root.Length).TrimStart("\","/")
      Write-Host "stripped $rel"
      $changed++
    }
  }

Write-Host ""
Write-Host "$changed file(s) stripped of BOM."
