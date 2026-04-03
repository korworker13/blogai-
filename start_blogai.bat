@echo off
chcp 65001 > nul
title BlogAI v10 - 로컬 서버
color 0A

cd /d "C:\Users\GKL\Downloads\blogai-final"

if not exist "server.js" (
    color 0C
    echo.
    echo  오류: server.js 파일을 찾을 수 없습니다.
    echo  경로: C:\Users\GKL\Downloads\blogai-final
    pause
    exit /b 1
)

:: 포트 3000 이미 사용 중인지 확인
netstat -ano | findstr ":3000" | findstr "LISTENING" > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo.
    echo  서버가 이미 실행 중입니다. 브라우저를 엽니다...
    start "" "http://localhost:3000"
    exit /b 0
)

echo.
echo  ====================================
echo   BlogAI v10 - 로컬 서버
echo  ====================================
echo.
echo   브라우저: http://localhost:3000
echo   저장위치: C:\Users\GKL\Desktop\블로그
echo.
echo   이 창을 닫으면 서버가 종료됩니다.
echo  ====================================
echo.

:: 브라우저 열기 (2초 후)
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME86=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if exist "%EDGE%" (
    start "" /b cmd /c "timeout /t 2 /nobreak > nul && \"%EDGE%\" http://localhost:3000"
) else if exist "%CHROME%" (
    start "" /b cmd /c "timeout /t 2 /nobreak > nul && \"%CHROME%\" http://localhost:3000"
) else if exist "%CHROME86%" (
    start "" /b cmd /c "timeout /t 2 /nobreak > nul && \"%CHROME86%\" http://localhost:3000"
) else (
    start "" /b cmd /c "timeout /t 2 /nobreak > nul && start http://localhost:3000"
)

node server.js

pause
