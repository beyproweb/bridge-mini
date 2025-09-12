$IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $IsAdmin) { Write-Host "Please run as Administrator." -ForegroundColor Yellow; Read-Host "Press Enter to exit"; exit 1 }
$ErrorActionPreference = "Stop"

$TaskName   = "BeyproBridge"
$Port       = 7777
$ExeName    = "beypro-bridge-win-x64.exe"
$InstallDir = Join-Path $env:ProgramFiles "BeyproBridge"
$Here       = Split-Path -Parent $MyInvocation.MyCommand.Path

New-Item -Force -ItemType Directory -Path $InstallDir | Out-Null
Copy-Item "$Here\*" "$InstallDir\" -Recurse -Force

try {
  $rule = Get-NetFirewallRule -DisplayName "Beypro Bridge $Port" -ErrorAction SilentlyContinue
  if (-not $rule) { New-NetFirewallRule -DisplayName "Beypro Bridge $Port" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow | Out-Null }
} catch {}

try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue } catch {}
$Action    = New-ScheduledTaskAction -Execute (Join-Path $InstallDir $ExeName) -Argument "--verbose --port $Port" -WorkingDirectory $InstallDir
$TrigStart = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $TrigStart -Principal $Principal -Settings $Settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host "`n✅ Installed. Bridge is starting now." -ForegroundColor Green
try { $resp = (Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/ping" -TimeoutSec 3).Content; Write-Host "Ping: $resp" } catch {}
Read-Host "Press Enter to close"
