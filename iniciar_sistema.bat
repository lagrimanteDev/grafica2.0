@echo off
REM ============================================================
REM  Iniciador do Sistema de Controle de Producao - Grafica EPA
REM  Duplo-clique neste arquivo para abrir o sistema no navegador.
REM ============================================================
title Grafica EPA - Sistema de Producao
cd /d "%~dp0"

REM Localiza o Node.js (funciona mesmo fora do PATH)
set "NODE_EXE=node"
where node >nul 2>nul
if errorlevel 1 (
    if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
)

REM Instala as dependencias na primeira execucao, se necessario
if not exist "node_modules" (
    echo Instalando dependencias pela primeira vez...
    call npm install
)

echo.
echo =======================================================
echo   Iniciando o Sistema da Grafica EPA...
echo   Acesso: http://localhost:3300
echo =======================================================
echo.

REM Abre o navegador padrao apos uma pequena espera
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3300"

"%NODE_EXE%" server\index.js

pause
