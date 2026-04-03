# BlogAI 바탕화면 바로가기 생성기
$ErrorActionPreference = "Stop"

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = "$desktop\BlogAI 실행.lnk"
$targetBat = "C:\Users\GKL\Downloads\blogai-final\start_blogai.bat"
$iconSource = "C:\Users\GKL\Downloads\blogai-final\blogai.ico"
$workingDir = "C:\Users\GKL\Downloads\blogai-final"

# 아이콘 다운로드 또는 기본 아이콘 사용
$iconPath = if (Test-Path $iconSource) { $iconSource } else { "C:\Windows\System32\shell32.dll,13" }

# 바로가기 생성
$wshell = New-Object -ComObject WScript.Shell
$shortcut = $wshell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetBat
$shortcut.WorkingDirectory = $workingDir
$shortcut.WindowStyle = 1
$shortcut.Description = "BlogAI 자동화 시스템 실행"

if (Test-Path $iconSource) {
    $shortcut.IconLocation = $iconSource
} else {
    $shortcut.IconLocation = "C:\Windows\System32\shell32.dll,13"
}

$shortcut.Save()

Write-Host ""
Write-Host "  ✅ 바탕화면에 'BlogAI 실행' 바로가기가 생성되었습니다!" -ForegroundColor Green
Write-Host "     위치: $shortcutPath" -ForegroundColor Cyan
Write-Host ""
