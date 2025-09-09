$IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $IsAdmin) { Write-Host "Please run as Administrator."; Read-Host "Enter to exit"; exit 1 }
$ErrorActionPreference = "Stop"

$TaskName   = "BeyproBridge"
$Port       = 7777
$InstallDir = Join-Path $env:ProgramFiles "BeyproBridge"

try { Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue } catch {}
try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue } catch {}
try { $rule = Get-NetFirewallRule -DisplayName "Beypro Bridge $Port" -ErrorAction SilentlyContinue; if ($rule) { Remove-NetFirewallRule -DisplayName "Beypro Bridge $Port" | Out-Null } } catch {}
try { Remove-Item -Recurse -Force "$InstallDir" } catch {}

Write-Host "✅ Uninstalled." -ForegroundColor Green
Read-Host "Press Enter to close"
