# Run perf test multiple times and summarize HEAVY_OP_MS metrics
param(
  [int]$Runs = 10
)

Set-StrictMode -Version Latest
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir\..

if (-not (Test-Path .\tmp)) { New-Item -ItemType Directory .\tmp | Out-Null }

$results = @()

for ($i=1; $i -le $Runs; $i++) {
  Write-Host "=== Run #$i ==="
  $logPath = ".\tmp\perf-run-$i.log"
  # Use shorter test title filter which matches the 'it' description directly
  npx vitest run src/lib/workbook/formula-dependencies.test.ts -t "should handle large dependency chain efficiently" --reporter verbose 2>&1 | Tee-Object -FilePath $logPath

  $out = Get-Content $logPath -Raw
  $computeMatch = [regex]::Match($out, 'HEAVY_OP_MS compute:(\d+)')
  $updateMatch = [regex]::Match($out, 'HEAVY_OP_MS update:(\d+)')
  $computeMs = if ($computeMatch.Success) { [int]$computeMatch.Groups[1].Value } else { $null }
  $updateMs = if ($updateMatch.Success) { [int]$updateMatch.Groups[1].Value } else { $null }

  $results += [PSCustomObject]@{
    Run = $i
    ComputeMs = $computeMs
    UpdateMs = $updateMs
    Log = $logPath
  }
}

function Median($arr) {
  if (-not $arr -or $arr.Count -eq 0) { return $null }
  $s = $arr | Sort-Object
  $n = $s.Count
  if ($n % 2 -eq 1) { return $s[([int]($n/2))] } else { return (($s[$n/2 -1] + $s[$n/2]) / 2) }
}

$computeVals = $results.ComputeMs | Where-Object { $_ -ne $null }
$updateVals = $results.UpdateMs | Where-Object { $_ -ne $null }

Write-Host "\nPer-run results:"; $results | Format-Table -AutoSize
Write-Host "\nCompute - min: $([string]($computeVals | Measure-Object -Minimum).Minimum) median: $(Median $computeVals) max: $([string]($computeVals | Measure-Object -Maximum).Maximum) mean: $([math]::Round((($computeVals | Measure-Object -Average).Average),2))"
Write-Host "Update  - min: $([string]($updateVals | Measure-Object -Minimum).Minimum) median: $(Median $updateVals) max: $([string]($updateVals | Measure-Object -Maximum).Maximum) mean: $([math]::Round((($updateVals | Measure-Object -Average).Average),2))"

Pop-Location
