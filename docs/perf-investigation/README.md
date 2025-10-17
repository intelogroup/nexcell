Performance investigation: `formula-dependencies.test.ts`

This note explains how to reproduce and collect timing data for the failing perf test:

Target test
- File: client/src/lib/workbook/formula-dependencies.test.ts
- Test title: "Performance and Stress Tests > should handle large dependency chain efficiently"

What we added
- The test now logs two concise metric lines when running:
  - HEAVY_OP_MS compute:<ms>
  - HEAVY_OP_MS update:<ms>

These are easy to parse from the Vitest stdout logs.

Reproduce (PowerShell)

Open PowerShell in the repo root and run:

```powershell
cd c:\Users\jayve\projects\nexcell\client

# Run the single test 10 times, saving logs per run
for ($i=1; $i -le 10; $i++) {
  Write-Host "Run #$i"
  pnpm test -- src/lib/workbook/formula-dependencies.test.ts -- -t "Performance and Stress Tests > should handle large dependency chain efficiently" --reporter verbose | Tee-Object -FilePath ".\tmp\perf-run-$i.log"
}

# Grep the HEAVY_OP_MS lines to produce a summary
Get-ChildItem .\tmp\perf-run-*.log | ForEach-Object {
  $content = Get-Content $_.FullName
  $compute = $content | Select-String -Pattern "HEAVY_OP_MS compute:([0-9]+)" | ForEach-Object { $_.Matches[0].Groups[1].Value }
  $update = $content | Select-String -Pattern "HEAVY_OP_MS update:([0-9]+)" | ForEach-Object { $_.Matches[0].Groups[1].Value }
  [PSCustomObject]@{
    File = $_.Name
    ComputeMs = ($compute -as [int])
    UpdateMs = ($update -as [int])
  }
} | Format-Table -AutoSize
```

Parsing notes
- If the compute/update lines don't appear, run the whole file without the -t filter (Vitest sometimes has matching quirks). The metric lines are printed by the test itself.
- Calculate median and variance across runs to see flakiness.

Next steps based on results
- If metric is stable and > threshold: profile with Node CPU profiler (see below) and open the profile in Chrome DevTools to find hot functions.
- If metric is flaky: adapt test to median-of-N inside the test or relax the threshold temporarily while we profile.

Quick profiling (if compute step looks slow)

```powershell
# Generate CPU profile via Node
$env:NODE_OPTIONS="--cpu-prof --cpu-prof-name=vitest-profile"
pnpm test -- src/lib/workbook/formula-dependencies.test.ts -- -t "Performance and Stress Tests > should handle large dependency chain efficiently"

# This produces a v8 CPU profile file in the working directory. Use node --prof-process or Chrome DevTools to inspect.
```

If you want me to run the 10× loop and collect the summary in this environment, say so and I'll execute it and report the median, min, max, and suggest the next action (profile vs test relaxation).
