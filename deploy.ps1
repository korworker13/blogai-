# BlogAI 자동 배포 스크립트
# 사용법: 터미널에서 .\deploy.ps1 입력

$date = Get-Date -Format "yyyy-MM-dd HH:mm"
$msg = "update $date"

Write-Host ""
Write-Host "🚀 BlogAI 배포 시작..." -ForegroundColor Cyan

# Git 업로드
git add .
git commit -m $msg
git push

Write-Host ""
Write-Host "✅ GitHub 업로드 완료!" -ForegroundColor Green
Write-Host "⏳ Vercel이 자동으로 배포 중... (약 1분 소요)" -ForegroundColor Yellow
Write-Host "🌐 배포 확인: https://vercel.com/dashboard" -ForegroundColor Cyan
Write-Host ""
