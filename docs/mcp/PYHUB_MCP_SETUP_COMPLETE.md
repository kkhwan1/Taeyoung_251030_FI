# PyHub MCP Tools 설치 완료 안내

## ✅ 완료된 작업

1. ✓ 설치 디렉토리 생성: `C:\mcptools\pyhub.mcptools\`
2. ✓ Cursor 설정 파일에 MCP 서버 설정 추가됨
3. ✓ package.json에 설치/테스트 명령어 추가됨

## 📋 다음 단계 (필수)

### 1. PyHub MCP Tools 다운로드 및 설치

PyHub MCP Tools는 수동 다운로드가 필요합니다:

1. **공식 사이트 방문**
   - URL: https://mcp.pyhub.kr/
   - 또는 GitHub: https://github.com/pyhub-kr/pyhub-mcptools/releases

2. **최신 릴리즈 다운로드**
   - 실행 파일 (.exe) 버전 다운로드 (권장)
   - 또는 소스 코드 버전

3. **압축 해제**
   - 다운로드한 ZIP 파일을 다음 경로에 압축 해제:
   ```
   C:\mcptools\pyhub.mcptools\
   ```

4. **설치 확인**
   ```powershell
   cd C:\mcptools\pyhub.mcptools
   .\pyhub.mcptools.exe tools-list
   ```
   
   또는 npm 스크립트 사용:
   ```bash
   npm run mcp:test
   ```

### 2. Cursor 재시작

MCP 설정을 적용하려면:

1. **Cursor 완전히 종료**
   - 모든 Cursor 창 닫기
   - 작업 관리자에서 Cursor 프로세스 확인 및 종료

2. **Cursor 재시작**
   - Cursor를 다시 실행하면 MCP 서버가 자동 로드됨

### 3. 동작 확인

Cursor 재시작 후:

1. MCP 도구가 사용 가능한지 확인
2. PyHub MCP 서버가 실행 중인지 확인

---

## 🛠️ 유용한 명령어

### 설치 확인
```bash
npm run mcp:test
```

### 도구 목록 확인
```powershell
C:\mcptools\pyhub.mcptools\pyhub.mcptools.exe tools-list
```

### 설정 파일 위치
```
%APPDATA%\Cursor\User\settings.json
```

---

## ⚙️ 현재 Cursor 설정

PyHub MCP 서버 설정이 Cursor 설정 파일에 추가되었습니다:

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

---

## 📚 추가 문서

- 상세 가이드: `PYHUB_MCP_README.md`
- 설치 가이드: `MCP_SETUP_GUIDE.md`

---

## ⚠️ 주의사항

1. **Excel 버전**: Excel 2016 이상 버전이 필요합니다
2. **관리자 권한**: 설치 시 관리자 권한이 필요할 수 있습니다
3. **보안 프로그램**: Windows Defender 등 보안 프로그램이 접근을 차단할 수 있습니다
4. **재시작 필수**: 설정 변경 후 Cursor 완전히 재시작 필요

---

## 🆘 문제 해결

### MCP 서버가 시작되지 않는 경우

1. **실행 파일 존재 확인**
   ```powershell
   Test-Path C:\mcptools\pyhub.mcptools\pyhub.mcptools.exe
   ```

2. **설정 파일 확인**
   ```powershell
   Get-Content "$env:APPDATA\Cursor\User\settings.json"
   ```

3. **Cursor 로그 확인**
   - Help → Toggle Developer Tools
   - Console 탭에서 MCP 오류 확인

---

## ✅ 체크리스트

설치 완료를 확인하려면:

- [ ] PyHub MCP Tools 다운로드 완료
- [ ] 압축 해제 완료 (`C:\mcptools\pyhub.mcptools\`에 설치됨)
- [ ] 실행 파일 확인 (`pyhub.mcptools.exe` 존재)
- [ ] 설치 확인 테스트 성공 (`npm run mcp:test`)
- [ ] Cursor 재시작 완료
- [ ] MCP 도구 사용 가능 확인

---

*설치 관련 문의: 공식 문서 https://mcp.pyhub.kr/*



