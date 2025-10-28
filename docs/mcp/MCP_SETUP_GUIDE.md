# PyHub MCP Tools 설치 및 설정 가이드

## 개요
PyHub MCP Tools는 엑셀과의 실시간 협업을 지원하는 MCP (Model Context Protocol) 도구입니다. 이를 통해 Claude AI가 엑셀 파일을 직접 읽고 수정할 수 있습니다.

## 시스템 요구사항
- Windows 10 이상
- Excel 2016 버전 이상
- PowerShell (관리자 권한)

## 설치 방법

### 방법 1: 자동 설치 (권장)

PowerShell을 **관리자 권한**으로 열고 다음 명령어를 실행합니다:

```powershell
powershell -ExecutionPolicy Bypass -NoProfile -Command "iex (iwr -UseBasicParsing 'https://raw.githubusercontent.com/pyhub-kr/pyhub-mcptools/refs/heads/main/scripts/install.ps1')"
```

이 명령어는:
1. 최신 PyHub MCP Tools를 다운로드합니다
2. `C:\mcptools\pyhub.mcptools\` 경로에 설치합니다
3. Claude 설정을 자동으로 구성합니다

**보안 경고 처리:**
설치 중 보안 경고가 나타나면:
1. '추가 정보' 클릭
2. '실행' 버튼 선택

### 방법 2: 수동 설치

1. **다운로드**
   - GitHub 릴리즈 페이지에서 최신 버전 다운로드
   - 또는 pip를 사용하여 설치: `pip install pyhub-mcptools`

2. **설치 확인**
   ```cmd
   cd C:\mcptools\pyhub.mcptools
   pyhub.mcptools.exe tools-list
   ```

3. **Cursor 설정**
   Cursor의 MCP 설정 파일에 다음을 추가해야 합니다.

## Cursor MCP 설정

Cursor에서 MCP 서버를 사용하려면 설정 파일을 편집해야 합니다:

1. **설정 파일 위치 확인**
   ```
   %APPDATA%\Cursor\User\settings.json
   ```

2. **MCP 서버 설정 추가**
   
   Cursor의 `settings.json`에 다음 MCP 설정을 추가합니다:
   
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

3. **Cursor 재시작**
   - Cursor를 완전히 종료하고 재시작합니다
   - MCP 서버가 정상적으로 시작되는지 확인합니다

## 설치 확인

설치가 성공했는지 확인하는 방법:

1. **PowerShell에서 확인**
   ```powershell
   cd C:\mcptools\pyhub.mcptools
   .\pyhub.mcptools.exe tools-list
   ```

2. **Cursor에서 확인**
   - Cursor 재시작 후
   - MCP 도구가 정상적으로 사용 가능한지 확인

## 문제 해결

### 문제: 보안 프로그램이 설치를 방해함
**해결책:** 
- Windows Defender 일시적으로 비활성화
- 또는 보안 예외 추가: `C:\mcptools\`

### 문제: MCP 서버가 시작되지 않음
**해결책:**
1. Cursor 설정 파일의 경로 확인
2. 실행 파일 존재 여부 확인: `Test-Path C:\mcptools\pyhub.mcptools\pyhub.mcptools.exe`
3. Cursor 완전히 재시작

### 문제: Excel 통신 타임아웃
**해결책:**
- Windows Defender "실시간 감시" 기능이 엑셀 접근을 방해할 수 있음
- 보안 프로그램 예외 목록에 추가

### 문제: Excel 버전 문제
**해결책:**
- Excel 2016 이상 버전 필요
- Office 버전 확인: Excel 실행 → 파일 → 계정 → 제품 정보

## 주요 기능

PyHub MCP Tools가 제공하는 기능:

1. **엑셀 파일 읽기**: 엑셀 파일의 내용을 읽어옵니다
2. **실시간 편집**: 엑셀 파일을 직접 수정합니다
3. **데이터 분석**: 엑셀 데이터를 분석하고 처리합니다
4. **리포트 생성**: 데이터를 기반으로 리포트를 생성합니다

## 참고 자료

- 공식 문서: https://mcp.pyhub.kr/
- GitHub: https://github.com/pyhub-kr/pyhub-mcptools
- PyPI: https://pypi.org/project/pyhub-mcptools/

## 주의사항

1. **보안**: 모든 소스코드가 공개되어 있어 안전합니다
2. **데이터**: 사용자의 정보를 수집하거나 전송하지 않습니다
3. **실시간 감시**: 바이러스 백신의 실시간 감시가 타임아웃을 유발할 수 있습니다



