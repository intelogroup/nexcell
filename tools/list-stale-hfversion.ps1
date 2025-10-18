param(
  [string]$Path = "./client/tmp/workbooks",
  [switch]$Recursive
)

Write-Output "Scanning directory: $Path (recursive: $Recursive)"

if (-not (Test-Path $Path)) {
  Write-Error "Path not found: $Path"
  exit 2
}

$files = Get-ChildItem -Path $Path -Filter '*.json' -File -ErrorAction SilentlyContinue
if ($Recursive) {
  $files = Get-ChildItem -Path $Path -Filter '*.json' -File -Recurse -ErrorAction SilentlyContinue
}

foreach ($f in $files) {
  try {
    $content = Get-Content $f.FullName -Raw
    $json = $content | ConvertFrom-Json

    if ($null -eq $json.computed) { continue }

    # We'll just show that the file has a computed cache. For detailed hfVersion
    # checks prefer the Node script which can load HyperFormula.
    $hasComputed = $json.sheets -and $json.sheets.Count -gt 0 -and $json | Get-Member -Name computed -ErrorAction SilentlyContinue
    Write-Output "Found workbook: $($f.FullName) - has computed: $([bool]$json.computed)"
  } catch {
    Write-Warning "Failed to parse $($f.FullName): $_"
  }
}

Write-Output "Note: This PowerShell script is a lightweight scanner. Run scripts/list-stale-hfversion.js for hfVersion-aware checks."
