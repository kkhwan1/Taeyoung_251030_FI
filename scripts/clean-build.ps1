# 안전한 빌드 캐시 삭제 스크립트
$PORT = 5000

Write-Host "빌드 캐시를 안전하게 삭제합니다..."

# 1. 서버 실행 여부 확인
$conn = netstat -ano | findstr ":$PORT"
if ($conn) {
    $pid = ($conn -split '\s+')[-1]
    Write-Host "⚠️ 경고: 서버가 실행 중입니다 (PID: $pid)"
    $response = Read-Host "서버를 종료하고 계속하시겠습니까? (y/n)"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "서버를 종료합니다..."
        taskkill /F /PID $pid 2>$null
        Start-Sleep -Seconds 3
    } else {
        Write-Host "작업을 취소했습니다."
        exit 0
    }
}

# 2. .next 폴더 삭제
if (Test-Path ".next") {
    Write-Host ".next 폴더를 삭제합니다..."
    Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Write-Host "✅ .next 폴더가 삭제되었습니다."
} else {
    Write-Host "ℹ️ .next 폴더가 존재하지 않습니다."
}

# 3. node_modules/.cache 삭제 (선택사항)
if (Test-Path "node_modules/.cache") {
    Write-Host "node_modules/.cache 폴더를 삭제합니다..."
    Remove-Item -Recurse -Force "node_modules/.cache" -ErrorAction SilentlyContinue
    Write-Host "✅ 캐시가 삭제되었습니다."
}

Write-Host ""
Write-Host "✅ 빌드 캐시가 안전하게 삭제되었습니다."
Write-Host "서버를 시작하려면 'npm run dev:safe'를 실행하세요."
