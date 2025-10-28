# PyHub MCP Tools 설치 및 사용 가이드

## 🎯 빠른 시작

### 1. 설치

PowerShell을 **관리자 권한**으로 열고 다음 명령어 중 하나를 선택하세요:

#### 방법 1: npm 스크립트 사용 (권장)
```bash
npm run mcp:install
```

#### 방법 2: 직접 설치
```powershell
powershell -ExecutionPolicy Bypass -NoProfile -Command "iex (iwr -UseBasicParsing 'https://raw.githubusercontent.com/pyhub-kr/pyhub-mcptools/refs/heads/main/scripts/install.ps1')"
```

#### 방법 3: 수동 설치
1. [GitHub 릴리즈](https://github.com/pyhub-kr/pyhub-mcptools/releases)에서 다운로드
2. `C:\mcptools\pyhub.mcptools\` 경로에 압축 해제

### 2. 설치 확인

```bash
npm run mcp:test
```

### 3. Cursor 설정

Cursor 설정 파일에 MCP 서버를 추가합니다:

**파일 위치**: `%APPDATA%\Cursor\User\settings.json`

**추가할 내용**:
```json
{
  "mcpServers": {
    "pyhub": {
      "command": "C:\\mcptools\\pyhub.mcptools\\pyhub.mcptools.exe",
      "args": []
    }
  }
}
```

### 4. Cursor 재시작

Cursor를 완전히 종료하고 재시작합니다.

---

## 📚 상세 가이드

### PyHub MCP Tools란?

PyHub MCP Tools는 Claude AI가 Excel 파일과 직접 상호작용할 수 있게 해주는 Model Context Protocol (MCP) 서버입니다.

**주요 기능**:
- ✅ Excel 파일 읽기
- ✅ 엑셀 데이터 편집
- ✅ 실시간 협업 지원
- ✅ 데이터 분석 및 처리
- ✅ 리포트 자동 생성

### 시스템 요구사항

- **운영체제**: Windows 10 이상
- **Excel**: 2016 버전 이상 필수
- **PowerShell**: 관리자 권한 필요
- **관리자 권한**: 설치 시 필요

### 설치 과정 상세 설명

#### 1단계: 자동 설치 스크립트 실행

```powershell
# 관리자 권한으로 PowerShell 실행
powershell -ExecutionPolicy Bypass -NoProfile -Command "iex (iwr -UseBasicParsing 'https://raw.githubusercontent.com/pyhub-kr/pyhub-mcptools/refs/heads/main/scripts/install.ps1')"
```

이 명령어는:
1. 최신 PyHub MCP Tools를 자동 다운로드
2. `C:\mcptools\pyhub.mcptools\`에 설치
3. Claude 설정 자동 구성 (가능한 경우)

**보안 경고 처리**:
```
추가 정보 → 실행
```

#### 2단계: 설치 확인

```powershell
cd C:\mcptools\pyhub.mcptools
.\pyhub.mcptools.exe tools-list
```

출력 예시:
```
Available tools:
- read_excel_file
- write_excel_file
- analyze_data
- generate_report
...
```

#### 3단계: Cursor MCP 설정

**설정 파일 위치**:
```
%APPDATA%\Cursor\User\settings.json
```

**현재 설정 확인**:
```powershell
Get-Content "$env:APPDATA\Cursor\User\settings.json"
```

**MCP 설정 추가**:
```json
{
  "python.analysis.diagnosticSeverityOverrides": {},
  "mcpServers": {
    "pyhub": {
      "command": "C:\\mcptools\\pyhub.mcptools\\pyhub.mcptools.exe",
      "args": []
    }
  }
}
```

**수정 방법**:
```powershell
# 기존 설정 읽기
$settings = Get-Content "$env:APPDATA\Cursor\User\settings.json" | ConvertFrom-Json

# MCP 설정 추가
$settings | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue @{
  pyhub = @{
    command = "C:\mcptools\pyhub.mcptools\pyhub.mcptools.exe"
    args = @()
  }
}

# 저장
$settings | ConvertTo-Json -Depth 10 | Set-Content "$env:APPDATA\Cursor\User\settings.json"
```

#### 4단계: Cursor 재시작

1. Cursor 완전히 종료
2. 재시작
3. MCP 서버 상태 확인

---

## 🔧 문제 해결

### 문제 1: 보안 프로그램이 설치를 방해함

**증상**: 설치 중 경고 또는 차단

**해결책**:
1. Windows Defender 일시적으로 비활성화
2. 또는 예외 목록에 추가:
   - 설정 → 바이러스 및 위협 방지
   - 바이러스 및 위협 방지 설정 관리
   - 제외 사항 추가: `C:\mcptools\`

### 문제 2: MCP 서버가 시작되지 않음

**증상**: Cursor에서 MCP 도구가 보이지 않음

**해결책**:
1. **경로 확인**
   ```powershell
   Test-Path C:\mcptools\pyhub.mcptools\pyhub.mcptools.exe
   # True여야 함
   ```

2. **실행 파일 테스트**
   ```powershell
   C:\mcptools\pyhub.mcptools\pyhub.mcptools.exe tools-list
   ```

3. **설정 파일 확인**
   ```powershell
   Get-Content "$env:APPDATA\Cursor\User\settings.json"
   ```

4. **Cursor 로그 확인**
   - Help → Toggle Developer Tools
   - Console 탭에서 MCP 오류 확인

### 문제 3: Excel 통신 타임아웃

**증상**: "Excel communication timeout" 오류

**해결책**:
- **Windows Defender 실시간 감시 임시 비활성화**
- 또는 Windows Defender 예외 추가
- Excel을 관리자 권한으로 실행

### 문제 4: Excel 버전 문제

**증상**: "Excel version not supported" 오류

**해결책**:
- Excel 2016 이상 버전 필요
- Excel 버전 확인: 파일 → 계정 → 제품 정보
- Office 업데이트 실행

### 문제 5: PowerShell 실행 정책

**증상**: "Execution policy" 오류

**해결책**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📖 사용 예시

PyHub MCP Tools 설치 후 Cursor에서 Excel 파일을 직접 다룰 수 있습니다.

### 예시 1: 엑셀 파일 읽기
```
Claude: 엑셀 파일 sales.xlsx를 읽어주세요
```

### 예시 2: 데이터 편집
```
Claude: sales.xlsx에서 1월 데이터를 찾아서 총계를 계산해주세요
```

### 예시 3: 리포트 생성
```
Claude: inventory.xlsx의 데이터를 분석해서 재고 리포트를 생성해주세요
```

---

## 🛠️ 명령어 참고

### 설치
```bash
npm run mcp:install
```

### 설치 확인
```bash
npm run mcp:test
```

### 직접 실행 (PowerShell)
```powershell
# 관리자 권한으로 실행
cd C:\mcptools\pyhub.mcptools
.\pyhub.mcptools.exe tools-list
```

### 설정 수정
```powershell
# Cursor 설정 파일 열기
notepad "$env:APPDATA\Cursor\User\settings.json"
```

---

## 📝 추가 리소스

- **공식 문서**: https://mcp.pyhub.kr/
- **GitHub**: https://github.com/pyhub-kr/pyhub-mcptools
- **PyPI**: https://pypi.org/project/pyhub-mcptools/
- **설치 가이드**: https://developer-child.tistory.com/82

---

## ⚠️ 주의사항

1. **보안**: 모든 소스코드가 공개되어 있어 안전합니다
2. **데이터**: 사용자 정보를 수집하거나 전송하지 않습니다
3. **Excel 버전**: Excel 2016 이상 필요
4. **권한**: 설치 시 관리자 권한 필요
5. **백신**: 실시간 감시가 타임아웃을 유발할 수 있음

---

## 📞 지원

- **이슈 리포팅**: https://github.com/pyhub-kr/pyhub-mcptools/issues
- **질문**: GitHub Discussions
- **문서**: 공식 웹사이트 참조

---

## ✅ 체크리스트

설치 완료를 확인하려면 다음 항목을 체크하세요:

- [ ] PyHub MCP Tools 설치됨 (`C:\mcptools\pyhub.mcptools\` 존재)
- [ ] 실행 파일 테스트 성공 (`pyhub.mcptools.exe tools-list` 작동)
- [ ] Cursor 설정 파일에 MCP 서버 추가됨
- [ ] Cursor 재시작 완료
- [ ] MCP 도구가 Cursor에서 사용 가능

---

*이 문서는 PyHub MCP Tools 설치를 위한 가이드입니다. 최신 정보는 공식 문서를 참조하세요.*



