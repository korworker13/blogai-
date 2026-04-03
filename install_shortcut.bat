@echo off
chcp 65001 > nul
title BlogAI - 바탕화면 바로가기 설치

echo.
echo  BlogAI 바탕화면 바로가기를 설치합니다...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0create_shortcut.ps1"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo  설치 완료! 바탕화면의 'BlogAI 실행' 아이콘을 더블클릭하세요.
    echo.
) else (
    echo.
    echo  [오류] 바로가기 생성에 실패했습니다.
    echo  start_blogai.bat 파일을 직접 실행해 주세요.
    echo.
)

pause
