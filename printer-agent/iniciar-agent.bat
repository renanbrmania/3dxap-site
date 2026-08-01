@echo off
cd /d "%~dp0"
title 3DXAP Printer Agent
echo.
echo  3DXAP - Printer Agent (Elgin)
echo  Nao feche esta janela enquanto for imprimir.
echo  ----------------------------------------------
echo.
where node >nul 2>&1
if errorlevel 1 (
  echo  ERRO: Node.js nao encontrado.
  echo  Instale em https://nodejs.org e rode de novo.
  echo.
  pause
  exit /b 1
)
node server.mjs
echo.
echo  Agent encerrado.
pause
