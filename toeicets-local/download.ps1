$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::DefaultConnectionLimit = 64
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = 'd:\en\toeicets-local\public'
$urls = Get-Content -LiteralPath 'd:\en\toeicets-local\urls.txt' | Where-Object { $_ -match 'https' }
$total = $urls.Count
Write-Host "Total to download: $total"

# Pre-create all needed directories
$dirs = $urls | ForEach-Object {
  $rel = $_ -replace '^https://data\.toeicets\.com/', ''
  Split-Path ("$root\data\" + ($rel -replace '/', '\')) -Parent
} | Sort-Object -Unique
foreach ($d in $dirs) { if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null } }
Write-Host "Created $($dirs.Count) directories"

# Runspace pool with 20 concurrent workers
$pool = [runspacefactory]::CreateRunspacePool(1, 20)
$pool.Open()

$script = {
  param($url, $dest)
  try {
    if (Test-Path -LiteralPath $dest) {
      if ((Get-Item -LiteralPath $dest).Length -gt 0) { return 'SKIP' }
    }
    $wc = New-Object System.Net.WebClient
    $wc.DownloadFile($url, $dest)
    $wc.Dispose()
    return 'OK'
  } catch {
    return "FAIL: $($_.Exception.Message)"
  }
}

$jobs = New-Object System.Collections.ArrayList
$i = 0
foreach ($u in $urls) {
  $rel = $u -replace '^https://data\.toeicets\.com/', ''
  $dest = "$root\data\" + ($rel -replace '/', '\')
  $ps = [powershell]::Create().AddScript($script).AddArgument($u).AddArgument($dest)
  $ps.RunspacePool = $pool
  [void]$jobs.Add(@{ ps = $ps; handle = $ps.BeginInvoke(); url = $u })
  $i++
  if ($i % 500 -eq 0) { Write-Host "Queued $i / $total" }
}

Write-Host "All queued. Waiting for completion..."
$done = 0; $ok = 0; $skip = 0; $fail = 0
foreach ($j in $jobs) {
  $r = $j.ps.EndInvoke($j.handle)
  $j.ps.Dispose()
  $done++
  switch -Wildcard ($r) {
    'OK'    { $ok++ }
    'SKIP'  { $skip++ }
    'FAIL*' { $fail++; if ($fail -le 10) { Write-Host "FAIL $($j.url): $r" } }
  }
  if ($done % 200 -eq 0) { Write-Host "Progress: $done / $total (ok=$ok skip=$skip fail=$fail)" }
}

$pool.Close()
$pool.Dispose()
Write-Host "DONE: ok=$ok skip=$skip fail=$fail total=$done"

# Size summary
$size = (Get-ChildItem -LiteralPath "$root\data" -Recurse -File | Measure-Object Length -Sum).Sum
Write-Host ("Total /data size: {0:N2} MB" -f ($size/1MB))
