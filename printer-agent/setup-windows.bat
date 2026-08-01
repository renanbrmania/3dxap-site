@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title 3DXAP - Setup Printer Agent

echo.
echo  ========================================
echo   3DXAP - Setup Printer Agent (Windows)
echo  ========================================
echo.
echo  Pasta: %CD%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  [ERRO] Node.js nao esta instalado.
  echo.
  echo  1^) Abra https://nodejs.org
  echo  2^) Baixe a versao LTS e instale
  echo  3^) Rode de novo: setup-windows.bat
  echo.
  start "" "https://nodejs.org"
  pause
  exit /b 1
)

for /f "delims=" %%i in ('node -v 2^>nul') do set NODEVER=%%i
echo  [OK] Node.js encontrado: %NODEVER%
echo.

if not exist "%CD%\iniciar-agent-silent.vbs" (
  echo  [ERRO] Falta o arquivo iniciar-agent-silent.vbs nesta pasta.
  pause
  exit /b 1
)

set "PS1=%TEMP%\3dxap-create-shortcut.ps1"

echo  Criando atalho para iniciar com o Windows...

> "%PS1%" echo $shell = New-Object -ComObject WScript.Shell
>> "%PS1%" echo $lnkPath = $env:APPDATA + '\Microsoft\Windows\Start Menu\Programs\Startup\3DXAP-Printer-Agent.lnk'
>> "%PS1%" echo $folder = '%CD%'
>> "%PS1%" echo $vbs = Join-Path $folder 'iniciar-agent-silent.vbs'
>> "%PS1%" echo $s = $shell.CreateShortcut($lnkPath)
>> "%PS1%" echo $s.TargetPath = 'wscript.exe'
>> "%PS1%" echo $s.Arguments = '"' + $vbs + '"'
>> "%PS1%" echo $s.WorkingDirectory = $folder
>> "%PS1%" echo $s.WindowStyle = 7
>> "%PS1%" echo $s.Description = '3DXAP Printer Agent - Elgin'
>> "%PS1%" echo $s.Save()
>> "%PS1%" echo Write-Host 'OK'

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
if errorlevel 1 (
  echo  [AVISO] Nao consegui criar o atalho automatico.
  echo  Voce ainda pode usar iniciar-agent.bat manualmente.
) else (
  echo  [OK] Vai iniciar sozinho quando o Windows ligar.
)

echo.
echo  Iniciando o agent agora...
start "" wscript.exe "%CD%\iniciar-agent-silent.vbs"
timeout /t 3 /nobreak >nul

powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:9109/health' -UseBasicParsing -TimeoutSec 4).StatusCode; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo  [AVISO] Agent pode estar subindo ainda. Espere alguns segundos.
  echo  Teste no Chrome: http://127.0.0.1:9109/health
) else (
  echo  [OK] Agent respondendo em http://127.0.0.1:9109
)

echo.
echo  ========================================
echo   Pronto!
echo  ========================================
echo.
echo  No site: admin ^> Impressao ^> imprimir
echo  Mesma rede Wi-Fi da Elgin.
echo.
echo  Se a porta ja estiver em uso, o agent JA esta ligado - isso e bom.
echo  Teste: http://127.0.0.1:9109/health
echo.
pause
