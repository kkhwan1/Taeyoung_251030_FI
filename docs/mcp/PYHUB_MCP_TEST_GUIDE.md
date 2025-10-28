# PyHub MCP Tools 테스트 가이드

## ✅ 설치 확인 완료

- ✓ PyHub MCP Tools 설치됨
- ✓ Cursor 설정 완료
- ✓ 22개 도구 사용 가능

## 🧪 테스트 방법

### 방법 1: 대화형 테스트

Cursor에서 아래와 같이 질문하여 PyHub MCP 도구를 테스트하세요:

```
"Excel 파일 items_export.xlsx를 읽어서 첫 5개 행의 데이터를 보여줘"
```

### 방법 2: 도구 직접 사용

사용 가능한 Excel MCP 도구들:

1. **excel_get_opened_workbooks**
   - 현재 열려있는 모든 워크북과 시트 목록 가져오기

2. **excel_get_values**
   - Excel 범위에서 데이터 읽기
   - 예: "A1:C10" 범위의 값 읽기

3. **excel_set_values**
   - Excel 범위에 데이터 쓰기
   - CSV 또는 JSON 형식으로 데이터 입력

4. **excel_add_sheet**
   - 새로운 시트 추가

5. **excel_set_styles**
   - 셀 스타일 적용 (배경색, 글꼴 색, 굵게 등)

6. **excel_autofit**
   - 열 너비 자동 조정

7. **excel_get_charts**
   - 시트의 모든 차트 조회

8. **excel_add_chart**
   - 차트 추가

9. **excel_convert_to_table**
   - 범위를 테이블로 변환 (Windows만)

10. **excel_add_pivot_table**
    - 피벗 테이블 생성

## 📝 테스트 시나리오

### 시나리오 1: Excel 파일 읽기

**명령어**:
```
"프로젝트의 items_export.xlsx 파일을 읽어서 어떤 데이터가 있는지 분석해줘"
```

**예상 결과**:
- Excel 파일의 내용을 읽어서 표시
- 데이터 구조 설명

### 시나리오 2: Excel 데이터 편집

**명령어**:
```
"items_export.xlsx에 'Test'라는 이름의 새 시트를 추가해줘"
```

**예상 결과**:
- 새로운 시트가 추가됨
- 성공 메시지 표시

### 시나리오 3: Excel 스타일 적용

**명령어**:
```
"items_export.xlsx의 첫 번째 행에 헤더 스타일을 적용해줘 (배경색 노란색, 굵게)"
```

**예상 결과**:
- 첫 번째 행이 노란색 배경과 굵은 글씨로 변경됨

## 🔍 문제 해결

### MCP 도구가 보이지 않는 경우

1. **Cursor 완전 종료**
   ```powershell
   # 작업 관리자에서 모든 Cursor 프로세스 종료
   Stop-Process -Name "Cursor" -Force
   ```

2. **Cursor 재시작**

3. **MCP 연결 확인**
   - Help → Toggle Developer Tools
   - Console 탭에서 MCP 관련 오류 확인

### Excel 접근 권한 문제

1. **Excel을 실행 중인 상태로 유지**
   - PyHub MCP는 Excel COM을 사용합니다
   - Excel이 실행 중이어야 작동합니다

2. **관리자 권한 확인**
   - Cursor를 관리자 권한으로 실행할 수 있는지 확인

### 타임아웃 오류

1. **Windows Defender 임시 비활성화**
2. **Excel 재시작**
3. **Cursor 재시작**

## ✅ 성공 확인

다음 명령어로 테스트하면 정상 작동을 확인할 수 있습니다:

```
"현재 열려있는 Excel 파일 목록을 보여줘"
```

정상 작동하면:
- 열려있는 워크북 목록이 JSON 형식으로 표시됨
- 각 워크북의 시트 목록도 표시됨

## 📚 추가 리소스

- 상세 가이드: `PYHUB_MCP_README.md`
- 설정 가이드: `MCP_SETUP_GUIDE.md`
- 완료 안내: `PYHUB_MCP_SETUP_COMPLETE.md`

---

*PyHub MCP Tools 설치 및 설정이 완료되었습니다. Cursor에서 Excel 작업을 자유롭게 할 수 있습니다!*


