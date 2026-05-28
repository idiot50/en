$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::DefaultConnectionLimit = 16
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = 'd:\en\toeicets-local\public'
New-Item -ItemType Directory -Force -Path "$root\audio" | Out-Null

# Full-test audio files (50 total)
$urls = @()
foreach ($y in @('2022','2023','2024','2025','2026')) {
  foreach ($n in 1..10) {
    $urls += "https://audio.toeicets.com/$y-test$n.mp3"
  }
}

# Missing UI assets (vector-icons and react-navigation)
$extraAssets = @(
  @{ url='https://app.toeicets.com/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.6148e7019854f3bde85b633cb88f3c25.ttf';
     dest="$root\assets\node_modules\@expo\vector-icons\build\vendor\react-native-vector-icons\Fonts\Ionicons.6148e7019854f3bde85b633cb88f3c25.ttf" }
  @{ url='https://app.toeicets.com/assets/node_modules/@react-navigation/elements/lib/module/assets/back-icon.35ba0eaec5a4f5ed12ca16fabeae451d.png';
     dest="$root\assets\node_modules\@react-navigation\elements\lib\module\assets\back-icon.35ba0eaec5a4f5ed12ca16fabeae451d.png" }
)
foreach ($a in $extraAssets) {
  $dir = Split-Path $a.dest -Parent
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  try {
    Invoke-WebRequest -Uri $a.url -UseBasicParsing -OutFile $a.dest -TimeoutSec 30
    Write-Host "OK extra: $($a.dest)"
  } catch { Write-Host "FAIL extra: $($a.url) - $($_.Exception.Message)" }
}

# Parallel download of full-test audio (10 concurrent)
$pool = [runspacefactory]::CreateRunspacePool(1, 10)
$pool.Open()
$script = {
  param($url, $dest)
  try {
    if ((Test-Path -LiteralPath $dest) -and ((Get-Item -LiteralPath $dest).Length -gt 0)) { return 'SKIP' }
    $wc = New-Object System.Net.WebClient
    $wc.DownloadFile($url, $dest)
    $wc.Dispose()
    return 'OK'
  } catch { return "FAIL: $($_.Exception.Message)" }
}
$jobs = New-Object System.Collections.ArrayList
foreach ($u in $urls) {
  $name = ($u -split '/')[-1]
  $dest = "$root\audio\$name"
  $ps = [powershell]::Create().AddScript($script).AddArgument($u).AddArgument($dest)
  $ps.RunspacePool = $pool
  [void]$jobs.Add(@{ ps = $ps; handle = $ps.BeginInvoke(); url = $u })
}
Write-Host "Queued $($jobs.Count) full-test audio files. Downloading..."
$ok = 0; $skip = 0; $fail = 0; $i = 0
foreach ($j in $jobs) {
  $r = $j.ps.EndInvoke($j.handle); $j.ps.Dispose(); $i++
  switch -Wildcard ($r) {
    'OK'    { $ok++; Write-Host "  [$i/$($jobs.Count)] OK   $($j.url)" }
    'SKIP'  { $skip++ }
    'FAIL*' { $fail++; Write-Host "  [$i/$($jobs.Count)] FAIL $($j.url): $r" }
  }
}
$pool.Close(); $pool.Dispose()
Write-Host "DONE audio: ok=$ok skip=$skip fail=$fail"

$size = (Get-ChildItem -LiteralPath "$root\audio" -File | Measure-Object Length -Sum).Sum
Write-Host ("Total /audio size: {0:N2} MB" -f ($size/1MB))
