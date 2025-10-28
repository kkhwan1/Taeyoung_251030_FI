# PyHub MCP Tools 설치 스크립트
# 실행 방법: PowerShell을 관리자 권한으로 열고 스크립트 실행

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PyHub MCP Tools 설치 시작" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 설치 디렉토리 확인
$installPath = "C:\mcptools\pyhub.mcptools"
Write-Host "[1/4] 설치 디렉토리 확인: $installPath" -ForegroundColor Yellow

if (Test-Path $installPath) {
    Write-Host "이미 설치된 디렉토리가 있습니다. 덮어쓰시겠습니까? (Y/N)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -ne "Y" -and $response -ne "y") {
        Write-Host "설치를 취소했습니다." -ForegroundColor Red
        exit
    }
}

# 2. 설치 디렉토리 생성
Write-Host "[2/4] 설치 디렉토리 생성 중..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $installPath | Out-Null

# 3. 다운로드
Write-Host "[3/4] PyHub MCP Tools 다운로드 중..." -ForegroundColor Yellow
Write-Host "    설치 방법 선택:" -ForegroundColor Cyan
Write-Host "    1. 자동 설치 (PowerShell 스크립트 실행)" -ForegroundColor White
Write-Host "    2. 수동 설치 (GitHub 릴리즈 다운로드)" -ForegroundColor White
Write-Host ""
$choice = Read-Host "선택 (1 또는 2)"

if ($choice -eq "1") {
    Write-Host "자동 설치 실행 중..." -ForegroundColor Green
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/pyhub-kr/pyhub-mcptools/refs/heads/main/scripts/install.ps1" -OutFile "$installPath\install-automatic.ps1"
        Push-Location $installPath
        powershell -ExecutionPolicy Bypass -File "install-automatic.ps1"
        Pop-Location
    } catch {
        Write-Host "자동 설치 실패: $_" -ForegroundColor Red
        Write-Host "수동 설치로 전환합니다..." -ForegroundColor Yellow
        $choice = "2"
    }
}

if ($choice -eq "2") {
    Write-Host "수동 설치 정보:" -ForegroundColor Yellow
    Write-Host "1. GitHub 릴리즈 페이지에서 다운로드:" -ForegroundColor White
    Write-Host "   https://github.com/pyhub-kr/pyhub-mcptools/releases" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. 다운로드한 압축 파일을 다음 경로에 풀기:" -ForegroundColor White
    Write-Host "   $installPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "압축 해제 완료 후 Enter 키를 누르세요..." -ForegroundColor Yellow
    Read-Host
}

# 4. 설치 확인
Write-Host "[4/4] 설치 확인 중..." -ForegroundColor Yellow
$exePath = Join-Path $installPath "pyhub.mcptools.exe"

if (Test-Path $exePath) {
    Write-Host "✓ 설치 완료!" -ForegroundColor Green
    Write-Host ""
    Write-Host "설치된 경로: $exePath" -ForegroundColor Cyan
    Write-Host ""
    
    # 설치 확인 테스트
    Write-Host "도구 목록 확인 중..." -ForegroundColor Yellow
    & $exePath tools-list
} else {
    Write-Host "✗ 설치 파일을 찾을 수 없습니다." -ForegroundColor Red
    Write-Host "경로: $exePath" -ForegroundColor Red
    Write-Host ""
    Write-Host "수동으로 다운로드하여 설치해주세요." -ForegroundColor Yellow
    Write-Host "https://github.com/pyhub-kr/pyhub-mcptools/releases" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "설치 완료! 다음 단계:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Cursor 설정 파일에 MCP 서버 추가" -ForegroundColor White
Write-Host "   파일: %APPDATA%\Cursor\User\settings.json" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 추가할 설정 내용:" -ForegroundColor White
Write-Host '   "mcpServers": {' -ForegroundColor Cyan
Write-Host '     "pyhub": {' -ForegroundColor Cyan
Write-Host '       "command": "C:\\mcptools\\pyhub.mcptools\\pyhub.mcptools.exe",' -ForegroundColor Cyan
Write-Host '       "args": []' -ForegroundColor Cyan
Write-Host '     }' -ForegroundColor Cyan
Write-Host '   }' -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Cursor 완전히 재시작" -ForegroundColor White
Write-Host ""

