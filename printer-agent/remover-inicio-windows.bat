@echo off
chcp 65001 >nul
setlocal
set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\3DXAP-Printer-Agent.lnk"
if exist "%LNK%" (
  del /f /q "%LNK%"
  echo Removido o inicio automatico.
) else (
  echo Nao havia atalho de inicio automatico.
)
echo.
pause
