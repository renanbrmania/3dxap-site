@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title 3DXAP — Configurar impressao Windows

echo.
echo  ========================================
echo   3DXAP — Setup Printer Agent (Windows)
echo  ========================================
echo.
echo  Pasta: %CD%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  [ERRO] Node.js nao esta instalado.
  echo.
  echo  1^) Abra https://nodejs.org
  echo  2^) Baixe a versao LTS e instale ^(Next/Next^)
  echo  3^) Feche e abra este arquivo de novo: setup-windows.bat
  echo.
  start "" "https://nodejs.org"
  pause
  exit /b 1
)

for /f "delims=" %%i in ('node -v 2^>nul') do set NODEVER=%%i
echo  [OK] Node.js encontrado: %NODEVER%
echo.

REM Atalho na pasta Inicializar do Windows (liga com o PC)
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS=%CD%\iniciar-agent-silent.vbs"
set "LNK=%STARTUP%\3DXAP-Printer-Agent.lnk"

if not exist "%VBS%" (
  echo  [ERRO] Falta o arquivo iniciar-agent-silent.vbs nesta pasta.
  pause
  exit /b 1
)

echo  Criando atalho para iniciar com o Windows...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = New-Object -ComObject WScript.Shell; $l = $s.CreateShortcut('%LNK:\=\\%'); $l.TargetPath = 'wscript.exe'; $l.Arguments = '\"%VBS:\=\\%\"'; $l.WorkingDirectory = '%CD:\=\\%'; $l.WindowStyle = 7; $l.Description = '3DXAP Printer Agent - Elgin'; $l.Save()"

if errorlevel 1 (
  echo  [AVISO] Nao consegui criar o atalho automatico.
  echo  Voce ainda pode usar iniciar-agent.bat manualmente.
) else (
  echo  [OK] Vai iniciar sozinho quando o Windows ligar.
  echo       Atalho: %LNK%
)

echo.
echo  Iniciando o agent agora...
start "" wscript.exe "%VBS%"
timeout /t 2 /nobreak >nul

powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:9109/health' -UseBasicParsing -TimeoutSec 3).Content; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo  [AVISO] Agent pode estar subindo ainda. Espere 5s e teste no admin.
) else (
  echo  [OK] Agent respondendo em http://127.0.0.1:9109
)

echo.
echo  ========================================
echo   Pronto!
echo  ========================================
echo.
echo  No site: admin -^> Impressao -^> Testar / imprimir
echo  Mesma rede Wi-Fi da Elgin.
echo.
echo  Para parar o agent: Gerenciador de Tarefas -^> finalizar "Node.js"
echo  Para desligar o inicio automatico: rode remover-inicio-windows.bat
echo.
pause
