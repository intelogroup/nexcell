# Run the modified perf test and capture output to tmp/single-perf-run.log
# Usage: Run this file from the repository root or from the client folder.

$client = Join-Path $PSScriptRoot ".." | Resolve-Path
$clientPath = "$($client)\client"
if (-not (Test-Path $clientPath)) { $clientPath = "$PSScriptRoot" }

Push-Location $clientPath
Write-Host "Running perf test in: $PWD"

# Run vitest and capture output
$npx = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npx) { Write-Error "npx not found in PATH"; Pop-Location; exit 1 }

$log = Join-Path $PSScriptRoot "single-perf-run.log"
Write-Host "Writing log to: $log"

# Run the test and redirect stdout+stderr to log
npx vitest run src/lib/workbook/formula-dependencies.test.ts -t "should handle large dependency chain efficiently" --reporter verbose *> $log

# Show HEAVY_OP_MS lines
Write-Host "---- HEAVY_OP_MS lines ----"
Select-String -Path $log -Pattern 'HEAVY_OP_MS' | ForEach-Object { $_.Line }

# Parse compute samples and compute median
$samples = Select-String -Path $log -Pattern 'HEAVY_OP_MS compute:' |
  ForEach-Object { ($_ -replace '.*compute:','') -as [double] }
if ($samples.Count -eq 0) { Write-Warning "No compute samples found in log." } else {
  $sorted = $samples | Sort-Object
  $median = $sorted[ [math]::Floor($sorted.Count/2) ]
  Write-Host "Compute samples: $($samples -join ', ')"
  Write-Host "Median compute (ms): $median"
}

# Parse update sample
$updates = Select-String -Path $log -Pattern 'HEAVY_OP_MS update:' |
  ForEach-Object { ($_ -replace '.*update:','') -as [double] }
if ($updates.Count -gt 0) { Write-Host "Update time (ms): $($updates[0])" }

Pop-Location

Write-Host "Done. Log file: $log"