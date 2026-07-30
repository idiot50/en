$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::DefaultConnectionLimit = 32
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = 'd:\en\toeicets-local\public'

# Scan all CSV files for asset URLs
Write-Host "Scanning CSVs for asset URLs..."
$urls = New-Object 'System.Collections.Generic.HashSet[string]'
Get-ChildItem -Path "$root\data" -Filter *.csv -Recurse | ForEach-Object {
  $text = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8
  foreach ($m in [regex]::Matches($text, 'https://data\.toeicets\.com/[^"''<>\s)]+')) {
    [void]$urls.Add($m.Value)
  }
}
Write-Host "Found $($urls.Count) unique URLs in CSV files"

# Filter to ones we don't already have locally
$missing = New-Object System.Collections.ArrayList
foreach ($u in $urls) {
  $rel = $u -replace '^https://data\.toeicets\.com/', ''
  $dest = "$root\data\" + ($rel -replace '/', '\')
  if (-not (Test-Path -LiteralPath $dest)) {
    [void]$missing.Add(@{ url = $u; dest = $dest })
  }
}
Write-Host "Missing locally: $($missing.Count) files"
if ($missing.Count -eq 0) { return }

# Pre-create dirs
$missing | ForEach-Object { Split-Path $_.dest -Parent } | Sort-Object -Unique | ForEach-Object {
  if (-not (Test-Path -LiteralPath $_)) { New-Item -ItemType Directory -Force -Path $_ | Out-Null }
}

# Parallel download (20 workers)
$pool = [runspacefactory]::CreateRunspacePool(1, 20)
$pool.Open()
$script = {
  param($url, $dest)
  try {
    $wc = New-Object System.Net.WebClient
    $wc.DownloadFile($url, $dest)
    $wc.Dispose()
    return 'OK'
  } catch { return "FAIL" }
}
$jobs = New-Object System.Collections.ArrayList
foreach ($m in $missing) {
  $ps = [powershell]::Create().AddScript($script).AddArgument($m.url).AddArgument($m.dest)
  $ps.RunspacePool = $pool
  [void]$jobs.Add(@{ ps = $ps; handle = $ps.BeginInvoke(); url = $m.url })
}
$ok = 0; $fail = 0; $i = 0
foreach ($j in $jobs) {
  $r = $j.ps.EndInvoke($j.handle); $j.ps.Dispose(); $i++
  if ($r -eq 'OK') { $ok++ } else { $fail++ }
  if ($i % 100 -eq 0) { Write-Host "Progress: $i / $($jobs.Count) (ok=$ok fail=$fail)" }
}
$pool.Close(); $pool.Dispose()
Write-Host "DONE: ok=$ok fail=$fail"
$size = (Get-ChildItem -LiteralPath "$root\data" -Recurse -File | Measure-Object Length -Sum).Sum
Write-Host ("Total /data: {0:N2} MB" -f ($size/1MB))
