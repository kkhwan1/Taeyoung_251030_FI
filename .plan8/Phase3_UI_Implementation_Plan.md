# Phase 3: UI Layer 구현 계획

## 개요

**목적**: 코일 공정 추적 시스템의 사용자 인터페이스 구현
**의존성**: Phase 1 (Database) ✅, Phase 2 (API Layer) ✅
**예상 소요 시간**: 6-8시간 (3개 트랙 병렬 실행)
**담당**: Claude Code + 조성원 차장 검토

---

## Phase 3 전체 구조

```
Phase 3: UI Layer (6-8 hours)
├── Track 3A: Process Management UI (3-4 hours)
│   ├── CoilProcessForm.tsx - 공정 등록 폼
│   ├── CoilProcessList.tsx - 공정 목록 & 필터링
│   └── CoilProcessDetail.tsx - 공정 상세 & 완료 버튼
│
├── Track 3B: Traceability UI (2-3 hours)
│   └── CoilTraceabilityView.tsx - 추적성 체인 시각화
│
└── Track 3C: BOM UI Updates (1 hour)
    └── BOMForm.tsx - 코일 자재 선택 기능 추가
```

---

## Track 3A: Process Management UI

### 3A-1: CoilProcessForm.tsx (1-1.5 hours)

**파일 경로**: `src/components/process/CoilProcessForm.tsx`

**목적**: 새 코일 공정 등록 폼 컴포넌트

**주요 기능**:
1. **공정 정보 입력**
   - 공정 유형 선택 (블랭킹/전단/절곡/용접)
   - 소스 코일 선택 (inventory_type='코일'만 필터링)
   - 타겟 품목 선택
   - 투입/산출 수량 입력
   - 수율(yield_rate) 자동 계산 및 표시
   - 공정 날짜 선택 (기본값: 오늘)
   - 담당자 선택 (선택사항)
   - 비고 입력

2. **유효성 검증**
   - 소스 품목이 '코일' 타입인지 클라이언트 측에서 재확인
   - 투입 수량 > 0, 산출 수량 >= 0
   - 산출 수량 <= 투입 수량 (수율 100% 초과 경고)
   - 필수 필드 입력 확인

3. **API 연동**
   - POST /api/coil/process
   - 성공 시 공정 목록 페이지로 이동
   - 실패 시 한글 에러 메시지 표시

**UI 컴포넌트 구조**:
```tsx
<form onSubmit={handleSubmit}>
  {/* 공정 유형 */}
  <Select name="process_type" required>
    <option value="블랭킹">블랭킹</option>
    <option value="전단">전단</option>
    <option value="절곡">절곡</option>
    <option value="용접">용접</option>
  </Select>

  {/* 소스 코일 선택 (코일 타입만) */}
  <ItemSelector
    label="투입 코일"
    filter={{ inventory_type: '코일' }}
    onSelect={handleSourceSelect}
    required
  />

  {/* 타겟 품목 선택 */}
  <ItemSelector
    label="산출 품목"
    onSelect={handleTargetSelect}
    required
  />

  {/* 수량 입력 */}
  <Input
    label="투입 수량"
    type="number"
    step="0.01"
    min="0.01"
    required
    onChange={calculateYieldRate}
  />

  <Input
    label="산출 수량"
    type="number"
    step="0.01"
    min="0"
    required
    onChange={calculateYieldRate}
  />

  {/* 수율 자동 계산 표시 */}
  <div className="bg-blue-50 p-3 rounded">
    <span>예상 수율: {yieldRate.toFixed(2)}%</span>
    {yieldRate > 100 && (
      <span className="text-yellow-600">⚠️ 수율 100% 초과</span>
    )}
  </div>

  {/* 공정 날짜 */}
  <Input
    label="공정 날짜"
    type="date"
    defaultValue={today}
  />

  {/* 담당자 (선택) */}
  <UserSelector
    label="담당 작업자"
    optional
  />

  {/* 비고 */}
  <Textarea label="비고" rows={3} />

  <Button type="submit">공정 등록</Button>
</form>
```

**상태 관리**:
```typescript
const [formData, setFormData] = useState<CreateCoilProcessRequest>({
  source_item_id: 0,
  process_type: '블랭킹',
  target_item_id: 0,
  input_quantity: 0,
  output_quantity: 0,
  process_date: new Date().toISOString().slice(0, 10),
  operator_id: null,
  notes: ''
});

const [yieldRate, setYieldRate] = useState<number>(0);
const [isSubmitting, setIsSubmitting] = useState(false);
```

---

### 3A-2: CoilProcessList.tsx (1-1.5 hours)

**파일 경로**: `src/components/process/CoilProcessList.tsx`

**목적**: 코일 공정 목록 조회 및 필터링 컴포넌트

**주요 기능**:
1. **공정 목록 표시**
   - VirtualTable 사용 (대용량 데이터 대응)
   - 컬럼: 공정ID, 공정유형, 소스코일, 타겟품목, 투입수량, 산출수량, 수율, 상태, 공정날짜, 작업자
   - 상태별 색상 코딩 (PENDING: 노랑, IN_PROGRESS: 파랑, COMPLETED: 초록, CANCELLED: 회색)

2. **필터링 기능**
   - 상태별 필터 (전체/대기/진행중/완료/취소)
   - 공정 유형별 필터
   - 날짜 범위 필터 (시작일~종료일)
   - 소스 품목별 필터
   - 타겟 품목별 필터

3. **정렬 기능**
   - 공정 날짜 기준 (기본: 최신순)
   - 모든 컬럼 클릭 정렬 지원

4. **액션**
   - 행 클릭 → 공정 상세 페이지 이동
   - "공정 등록" 버튼 → CoilProcessForm 이동

**API 연동**:
- GET /api/coil/process?status={status}&process_type={type}&start_date={start}&end_date={end}

**UI 구조**:
```tsx
<div className="space-y-4">
  {/* 헤더 */}
  <div className="flex justify-between items-center">
    <h2>코일 공정 관리</h2>
    <Button onClick={() => router.push('/process/new')}>
      + 공정 등록
    </Button>
  </div>

  {/* 필터 영역 */}
  <div className="grid grid-cols-4 gap-4">
    <Select
      label="상태"
      value={filters.status}
      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
    >
      <option value="">전체</option>
      <option value="PENDING">대기</option>
      <option value="IN_PROGRESS">진행중</option>
      <option value="COMPLETED">완료</option>
      <option value="CANCELLED">취소</option>
    </Select>

    <Select
      label="공정 유형"
      value={filters.process_type}
      onChange={(e) => setFilters({ ...filters, process_type: e.target.value })}
    >
      <option value="">전체</option>
      <option value="블랭킹">블랭킹</option>
      <option value="전단">전단</option>
      <option value="절곡">절곡</option>
      <option value="용접">용접</option>
    </Select>

    <Input
      label="시작일"
      type="date"
      value={filters.start_date}
      onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
    />

    <Input
      label="종료일"
      type="date"
      value={filters.end_date}
      onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
    />
  </div>

  {/* 공정 목록 테이블 */}
  <VirtualTable
    data={processes}
    columns={[
      { key: 'process_id', label: '공정ID', width: 80 },
      { key: 'process_type', label: '공정유형', width: 100 },
      { key: 'source_item.item_name', label: '투입 코일', width: 150 },
      { key: 'target_item.item_name', label: '산출 품목', width: 150 },
      { key: 'input_quantity', label: '투입수량', width: 100, align: 'right' },
      { key: 'output_quantity', label: '산출수량', width: 100, align: 'right' },
      { key: 'yield_rate', label: '수율(%)', width: 80, align: 'right' },
      { key: 'status', label: '상태', width: 100, render: renderStatus },
      { key: 'process_date', label: '공정날짜', width: 120 },
      { key: 'operator.name', label: '담당자', width: 100 }
    ]}
    onRowClick={handleRowClick}
    getRowClassName={(row) => getStatusClassName(row.status)}
  />
</div>
```

---

### 3A-3: CoilProcessDetail.tsx (1 hour)

**파일 경로**: `src/components/process/CoilProcessDetail.tsx`

**목적**: 공정 상세 정보 조회 및 완료 처리 컴포넌트

**주요 기능**:
1. **공정 상세 정보 표시**
   - 공정 기본 정보 (ID, 유형, 날짜, 상태, 담당자)
   - 투입 정보 (소스 코일 코드/명칭/수량/현재재고)
   - 산출 정보 (타겟 품목 코드/명칭/수량/현재재고)
   - 수율 정보 (계산된 수율, 예상 손실량)
   - 재고 이동 내역 (COMPLETED 상태인 경우)

2. **공정 완료 처리**
   - "공정 완료" 버튼 (PENDING, IN_PROGRESS 상태만 표시)
   - 완료 확인 모달
   - 완료 처리 시 자동 재고 이동 안내
   - POST /api/coil/process/complete 호출

3. **재고 이동 내역 조회**
   - 완료된 공정의 경우 관련 inventory_transactions 표시
   - transaction_number: COIL-YYYYMMDD-{process_id} 형식 확인

**API 연동**:
- GET /api/coil/process (단일 공정 조회 - 목록에서 필터링)
- POST /api/coil/process/complete
- GET /api/inventory/transactions (재고 이동 내역 조회)

**UI 구조**:
```tsx
<div className="space-y-6">
  {/* 헤더 */}
  <div className="flex justify-between items-center">
    <h2>공정 상세 정보</h2>
    {canComplete(process.status) && (
      <Button
        variant="primary"
        onClick={() => setShowCompleteModal(true)}
      >
        공정 완료
      </Button>
    )}
  </div>

  {/* 공정 기본 정보 */}
  <Card title="공정 정보">
    <dl className="grid grid-cols-2 gap-4">
      <div>
        <dt>공정 ID</dt>
        <dd>{process.process_id}</dd>
      </div>
      <div>
        <dt>공정 유형</dt>
        <dd>{process.process_type}</dd>
      </div>
      <div>
        <dt>공정 날짜</dt>
        <dd>{formatDate(process.process_date)}</dd>
      </div>
      <div>
        <dt>상태</dt>
        <dd>
          <StatusBadge status={process.status} />
        </dd>
      </div>
      <div>
        <dt>담당 작업자</dt>
        <dd>{process.operator?.name || '-'}</dd>
      </div>
      <div>
        <dt>등록일시</dt>
        <dd>{formatDateTime(process.created_at)}</dd>
      </div>
    </dl>
  </Card>

  {/* 투입 정보 */}
  <Card title="투입 정보 (소스 코일)">
    <dl className="grid grid-cols-2 gap-4">
      <div>
        <dt>품목 코드</dt>
        <dd>{process.source_item.item_code}</dd>
      </div>
      <div>
        <dt>품목명</dt>
        <dd>{process.source_item.item_name}</dd>
      </div>
      <div>
        <dt>투입 수량</dt>
        <dd className="text-red-600">
          {formatNumber(process.input_quantity)} {process.source_item.unit}
        </dd>
      </div>
      <div>
        <dt>현재 재고</dt>
        <dd>{formatNumber(process.source_item.current_stock)}</dd>
      </div>
    </dl>
  </Card>

  {/* 산출 정보 */}
  <Card title="산출 정보 (타겟 품목)">
    <dl className="grid grid-cols-2 gap-4">
      <div>
        <dt>품목 코드</dt>
        <dd>{process.target_item.item_code}</dd>
      </div>
      <div>
        <dt>품목명</dt>
        <dd>{process.target_item.item_name}</dd>
      </div>
      <div>
        <dt>산출 수량</dt>
        <dd className="text-green-600">
          {formatNumber(process.output_quantity)} {process.target_item.unit}
        </dd>
      </div>
      <div>
        <dt>현재 재고</dt>
        <dd>{formatNumber(process.target_item.current_stock)}</dd>
      </div>
    </dl>
  </Card>

  {/* 수율 정보 */}
  <Card title="수율 정보">
    <dl className="grid grid-cols-3 gap-4">
      <div>
        <dt>수율</dt>
        <dd className="text-xl font-bold">
          {process.yield_rate.toFixed(2)}%
        </dd>
      </div>
      <div>
        <dt>손실량</dt>
        <dd className="text-red-600">
          {formatNumber(process.input_quantity - process.output_quantity)}
        </dd>
      </div>
      <div>
        <dt>손실률</dt>
        <dd className="text-red-600">
          {(100 - process.yield_rate).toFixed(2)}%
        </dd>
      </div>
    </dl>
  </Card>

  {/* 재고 이동 내역 (완료된 경우) */}
  {process.status === 'COMPLETED' && (
    <Card title="재고 이동 내역">
      <table className="min-w-full">
        <thead>
          <tr>
            <th>거래번호</th>
            <th>거래유형</th>
            <th>품목</th>
            <th>수량</th>
            <th>거래일시</th>
          </tr>
        </thead>
        <tbody>
          {stockMovements.map(tx => (
            <tr key={tx.transaction_id}>
              <td>{tx.transaction_number}</td>
              <td>{tx.transaction_type}</td>
              <td>{tx.item?.item_name}</td>
              <td className={tx.quantity < 0 ? 'text-red-600' : 'text-green-600'}>
                {formatNumber(tx.quantity)}
              </td>
              <td>{formatDateTime(tx.transaction_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )}

  {/* 비고 */}
  {process.notes && (
    <Card title="비고">
      <p className="whitespace-pre-wrap">{process.notes}</p>
    </Card>
  )}
</div>

{/* 완료 확인 모달 */}
{showCompleteModal && (
  <Modal
    title="공정 완료 확인"
    onClose={() => setShowCompleteModal(false)}
  >
    <div className="space-y-4">
      <p>이 공정을 완료 처리하시겠습니까?</p>
      <div className="bg-yellow-50 p-4 rounded">
        <p className="font-semibold">⚠️ 완료 시 자동으로 다음 재고 이동이 발생합니다:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>
            투입 코일 출고: {process.source_item.item_name} -{formatNumber(process.input_quantity)}
          </li>
          <li>
            산출 품목 입고: {process.target_item.item_name} +{formatNumber(process.output_quantity)}
          </li>
        </ul>
      </div>
      <div className="flex justify-end space-x-2">
        <Button
          variant="secondary"
          onClick={() => setShowCompleteModal(false)}
        >
          취소
        </Button>
        <Button
          variant="primary"
          onClick={handleComplete}
          disabled={isCompleting}
        >
          {isCompleting ? '처리 중...' : '완료 처리'}
        </Button>
      </div>
    </div>
  </Modal>
)}
```

---

## Track 3B: Traceability UI

### 3B-1: CoilTraceabilityView.tsx (2-3 hours)

**파일 경로**: `src/components/process/CoilTraceabilityView.tsx`

**목적**: 품목의 상류/하류 공정 추적성 체인 시각화

**주요 기능**:
1. **품목 선택**
   - ItemSelector 컴포넌트로 품목 검색/선택
   - 선택한 품목의 기본 정보 표시

2. **상류 공정 (Upstream)**
   - 이 품목을 생산한 공정들 표시
   - 시간순 정렬 (최신순)
   - 각 공정의 소스 코일, 투입/산출 수량, 수율 표시

3. **하류 공정 (Downstream)**
   - 이 품목을 사용한 공정들 표시
   - 시간순 정렬 (최신순)
   - 각 공정의 타겟 품목, 투입/산출 수량, 수율 표시

4. **시각화**
   - 플로우차트 형식으로 공정 체인 표시
   - 화살표로 흐름 방향 표시
   - 수율에 따른 색상 코딩 (>95%: 초록, 90-95%: 노랑, <90%: 빨강)

**API 연동**:
- GET /api/coil/traceability/[item_id]

**UI 구조**:
```tsx
<div className="space-y-6">
  {/* 품목 선택 */}
  <Card title="추적할 품목 선택">
    <ItemSelector
      label="품목"
      onSelect={handleItemSelect}
      placeholder="품목 코드 또는 이름으로 검색..."
    />
  </Card>

  {/* 선택된 품목 정보 */}
  {selectedItem && (
    <Card title="선택된 품목">
      <dl className="grid grid-cols-4 gap-4">
        <div>
          <dt>품목 코드</dt>
          <dd className="font-semibold">{selectedItem.item_code}</dd>
        </div>
        <div>
          <dt>품목명</dt>
          <dd className="font-semibold">{selectedItem.item_name}</dd>
        </div>
        <div>
          <dt>재고 유형</dt>
          <dd>{selectedItem.inventory_type}</dd>
        </div>
        <div>
          <dt>현재 재고</dt>
          <dd>{formatNumber(selectedItem.current_stock)}</dd>
        </div>
      </dl>
    </Card>
  )}

  {/* 추적성 체인 */}
  {traceabilityChain && (
    <div className="grid grid-cols-2 gap-6">
      {/* 상류 공정 (Upstream) */}
      <Card title="상류 공정 (이 품목을 생산한 공정)">
        {traceabilityChain.upstream.length === 0 ? (
          <p className="text-gray-500">상류 공정이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {traceabilityChain.upstream.map((process, idx) => (
              <div
                key={process.process_id}
                className="border rounded p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/process/${process.process_id}`)}
              >
                {/* 공정 헤더 */}
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold">
                    {idx + 1}. {process.process_type}
                  </span>
                  <StatusBadge status={process.status} />
                </div>

                {/* 소스 정보 */}
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-gray-600">투입:</span>{' '}
                    {process.source_item_name} ({process.source_item_code})
                  </p>
                  <p>
                    <span className="text-gray-600">투입량:</span>{' '}
                    {formatNumber(process.input_quantity)}
                  </p>
                </div>

                {/* 화살표 */}
                <div className="text-center text-2xl my-1">↓</div>

                {/* 타겟 정보 (현재 품목) */}
                <div className="text-sm space-y-1 bg-blue-50 p-2 rounded">
                  <p className="font-semibold">
                    산출: {selectedItem.item_name}
                  </p>
                  <p>
                    <span className="text-gray-600">산출량:</span>{' '}
                    {formatNumber(process.output_quantity)}
                  </p>
                  <p>
                    <span className="text-gray-600">수율:</span>{' '}
                    <span className={getYieldRateColor(process.yield_rate)}>
                      {process.yield_rate.toFixed(2)}%
                    </span>
                  </p>
                </div>

                {/* 공정 날짜 */}
                <p className="text-xs text-gray-500 mt-2">
                  {formatDate(process.process_date)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 하류 공정 (Downstream) */}
      <Card title="하류 공정 (이 품목을 사용한 공정)">
        {traceabilityChain.downstream.length === 0 ? (
          <p className="text-gray-500">하류 공정이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {traceabilityChain.downstream.map((process, idx) => (
              <div
                key={process.process_id}
                className="border rounded p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/process/${process.process_id}`)}
              >
                {/* 공정 헤더 */}
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold">
                    {idx + 1}. {process.process_type}
                  </span>
                  <StatusBadge status={process.status} />
                </div>

                {/* 소스 정보 (현재 품목) */}
                <div className="text-sm space-y-1 bg-blue-50 p-2 rounded">
                  <p className="font-semibold">
                    투입: {selectedItem.item_name}
                  </p>
                  <p>
                    <span className="text-gray-600">투입량:</span>{' '}
                    {formatNumber(process.input_quantity)}
                  </p>
                </div>

                {/* 화살표 */}
                <div className="text-center text-2xl my-1">↓</div>

                {/* 타겟 정보 */}
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-gray-600">산출:</span>{' '}
                    {process.target_item_name} ({process.target_item_code})
                  </p>
                  <p>
                    <span className="text-gray-600">산출량:</span>{' '}
                    {formatNumber(process.output_quantity)}
                  </p>
                  <p>
                    <span className="text-gray-600">수율:</span>{' '}
                    <span className={getYieldRateColor(process.yield_rate)}>
                      {process.yield_rate.toFixed(2)}%
                    </span>
                  </p>
                </div>

                {/* 공정 날짜 */}
                <p className="text-xs text-gray-500 mt-2">
                  {formatDate(process.process_date)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )}

  {/* 통계 요약 */}
  {traceabilityChain && (traceabilityChain.upstream.length > 0 || traceabilityChain.downstream.length > 0) && (
    <Card title="추적성 통계">
      <dl className="grid grid-cols-4 gap-4">
        <div>
          <dt>상류 공정 수</dt>
          <dd className="text-2xl font-bold text-blue-600">
            {traceabilityChain.upstream.length}
          </dd>
        </div>
        <div>
          <dt>하류 공정 수</dt>
          <dd className="text-2xl font-bold text-green-600">
            {traceabilityChain.downstream.length}
          </dd>
        </div>
        <div>
          <dt>평균 수율 (상류)</dt>
          <dd className="text-2xl font-bold">
            {calculateAverageYield(traceabilityChain.upstream).toFixed(2)}%
          </dd>
        </div>
        <div>
          <dt>평균 수율 (하류)</dt>
          <dd className="text-2xl font-bold">
            {calculateAverageYield(traceabilityChain.downstream).toFixed(2)}%
          </dd>
        </div>
      </dl>
    </Card>
  )}
</div>
```

**헬퍼 함수**:
```typescript
function getYieldRateColor(yieldRate: number): string {
  if (yieldRate >= 95) return 'text-green-600';
  if (yieldRate >= 90) return 'text-yellow-600';
  return 'text-red-600';
}

function calculateAverageYield(processes: any[]): number {
  if (processes.length === 0) return 0;
  const total = processes.reduce((sum, p) => sum + p.yield_rate, 0);
  return total / processes.length;
}
```

---

## Track 3C: BOM UI Updates

### 3C-1: BOMForm.tsx 수정 (1 hour)

**파일 경로**: `src/components/BOMForm.tsx` (기존 파일 수정)

**목적**: BOM 등록 시 코일 자재 선택 기능 추가

**주요 변경사항**:
1. **자재 선택 시 코일 필터 옵션 추가**
   - "코일 자재만 표시" 체크박스 추가
   - 체크 시 ItemSelector가 inventory_type='코일'인 품목만 표시

2. **코일 자재 표시**
   - 선택된 자재가 코일인 경우 뱃지 표시
   - 코일 자재의 경우 스크랩율 필드 강조

**수정 위치 및 내용**:

```tsx
// 기존 BOMForm.tsx에 추가
const [showCoilOnly, setShowCoilOnly] = useState(false);

// 자재 선택 섹션 수정
<div className="space-y-2">
  <label className="flex items-center space-x-2">
    <input
      type="checkbox"
      checked={showCoilOnly}
      onChange={(e) => setShowCoilOnly(e.target.checked)}
    />
    <span>코일 자재만 표시</span>
  </label>

  <ItemSelector
    label="자재 선택"
    filter={showCoilOnly ? { inventory_type: '코일' } : undefined}
    onSelect={handleChildItemSelect}
    required
  />

  {/* 선택된 자재가 코일인 경우 뱃지 표시 */}
  {selectedChildItem && selectedChildItem.inventory_type === '코일' && (
    <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
      🔵 코일 자재
    </span>
  )}
</div>

// 스크랩율 입력 필드 (코일 자재인 경우 강조)
<Input
  label="스크랩율 (%)"
  type="number"
  step="0.01"
  min="0"
  max="100"
  value={formData.scrap_rate}
  onChange={(e) => setFormData({ ...formData, scrap_rate: parseFloat(e.target.value) })}
  className={selectedChildItem?.inventory_type === '코일' ? 'border-blue-500 bg-blue-50' : ''}
  helpText={selectedChildItem?.inventory_type === '코일' ? '코일 자재는 스크랩율이 재료비 계산에 반영됩니다.' : undefined}
/>
```

---

## 라우팅 설정

### 새 페이지 추가

**파일 경로**: `src/app/process/page.tsx` (새 파일)
```tsx
'use client';

import CoilProcessList from '@/components/process/CoilProcessList';

export default function ProcessPage() {
  return (
    <div className="container mx-auto p-6">
      <CoilProcessList />
    </div>
  );
}
```

**파일 경로**: `src/app/process/new/page.tsx` (새 파일)
```tsx
'use client';

import CoilProcessForm from '@/components/process/CoilProcessForm';

export default function NewProcessPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">새 공정 등록</h1>
      <CoilProcessForm />
    </div>
  );
}
```

**파일 경로**: `src/app/process/[id]/page.tsx` (새 파일)
```tsx
'use client';

import { useParams } from 'next/navigation';
import CoilProcessDetail from '@/components/process/CoilProcessDetail';

export default function ProcessDetailPage() {
  const params = useParams();
  const processId = parseInt(params.id as string);

  return (
    <div className="container mx-auto p-6">
      <CoilProcessDetail processId={processId} />
    </div>
  );
}
```

**파일 경로**: `src/app/traceability/page.tsx` (새 파일)
```tsx
'use client';

import CoilTraceabilityView from '@/components/process/CoilTraceabilityView';

export default function TraceabilityPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">공정 추적성</h1>
      <CoilTraceabilityView />
    </div>
  );
}
```

---

## 네비게이션 메뉴 추가

**파일 경로**: `src/components/layout/Sidebar.tsx` (기존 파일 수정)

**추가할 메뉴 항목**:
```tsx
{
  name: '공정 관리',
  icon: <FactoryIcon />,
  href: '/process',
  children: [
    { name: '공정 목록', href: '/process' },
    { name: '공정 등록', href: '/process/new' },
    { name: '공정 추적성', href: '/traceability' }
  ]
}
```

---

## 공통 유틸리티 함수

**파일 경로**: `src/lib/utils/processUtils.ts` (새 파일)

```typescript
import type { ProcessStatus, ProcessType } from '@/types/coil';

/**
 * 공정 상태별 CSS 클래스 반환
 */
export function getProcessStatusClassName(status: ProcessStatus): string {
  const statusClasses: Record<ProcessStatus, string> = {
    'PENDING': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    'IN_PROGRESS': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'COMPLETED': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'CANCELLED': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  };
  return statusClasses[status] || '';
}

/**
 * 공정 상태별 한글 라벨 반환
 */
export function getProcessStatusLabel(status: ProcessStatus): string {
  const statusLabels: Record<ProcessStatus, string> = {
    'PENDING': '대기',
    'IN_PROGRESS': '진행중',
    'COMPLETED': '완료',
    'CANCELLED': '취소'
  };
  return statusLabels[status] || status;
}

/**
 * 수율에 따른 색상 클래스 반환
 */
export function getYieldRateColorClass(yieldRate: number): string {
  if (yieldRate >= 95) return 'text-green-600';
  if (yieldRate >= 90) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * 수율 계산
 */
export function calculateYieldRate(input: number, output: number): number {
  if (input <= 0) return 0;
  return Math.round((output / input) * 100 * 100) / 100; // 소수점 2자리
}

/**
 * 공정 완료 가능 여부 확인
 */
export function canCompleteProcess(status: ProcessStatus): boolean {
  return status === 'PENDING' || status === 'IN_PROGRESS';
}

/**
 * 공정 취소 가능 여부 확인
 */
export function canCancelProcess(status: ProcessStatus): boolean {
  return status === 'PENDING' || status === 'IN_PROGRESS';
}

/**
 * 평균 수율 계산
 */
export function calculateAverageYieldRate(processes: { yield_rate: number }[]): number {
  if (processes.length === 0) return 0;
  const total = processes.reduce((sum, p) => sum + p.yield_rate, 0);
  return Math.round((total / processes.length) * 100) / 100;
}
```

---

## TypeScript 타입 정의 확인

**파일 경로**: `src/types/coil.ts` (이미 Phase 2에서 생성됨)

Phase 2에서 생성한 타입 정의를 그대로 사용:
- `ProcessStatus`
- `ProcessType`
- `CreateCoilProcessRequest`
- `CompleteCoilProcessRequest`
- `CoilProcessFilters`
- `CoilTraceabilityChain`

---

## 테스트 계획

### Milestone 3: UI Layer 테스트 (Phase 3 완료 후)

**테스트 범위**: 3개 트랙의 모든 UI 컴포넌트

**총 예상 시간**: 2시간

#### Milestone 3A: Process Management UI 테스트 (1시간)

**Test 3A-1: 공정 등록 폼 (20분)**
- [ ] 코일 타입 품목만 소스로 선택 가능한지 확인
- [ ] 수량 입력 시 수율 자동 계산 확인
- [ ] 수율 100% 초과 시 경고 메시지 표시 확인
- [ ] 필수 필드 유효성 검증 확인
- [ ] 공정 등록 성공 시 목록 페이지로 이동 확인

**Test 3A-2: 공정 목록 (20분)**
- [ ] 공정 목록 정상 표시 확인
- [ ] 상태별 필터링 동작 확인
- [ ] 공정 유형별 필터링 동작 확인
- [ ] 날짜 범위 필터링 동작 확인
- [ ] 행 클릭 시 상세 페이지 이동 확인

**Test 3A-3: 공정 상세 및 완료 (20분)**
- [ ] 공정 상세 정보 정상 표시 확인
- [ ] PENDING/IN_PROGRESS 상태에서만 완료 버튼 표시 확인
- [ ] 완료 확인 모달의 재고 이동 안내 확인
- [ ] 완료 처리 후 상태 변경 확인
- [ ] COMPLETED 상태에서 재고 이동 내역 표시 확인

#### Milestone 3B: Traceability UI 테스트 (40분)

**Test 3B-1: 추적성 체인 조회 (40분)**
- [ ] 품목 선택 시 기본 정보 표시 확인
- [ ] 상류 공정 목록 정상 표시 확인
- [ ] 하류 공정 목록 정상 표시 확인
- [ ] 수율에 따른 색상 코딩 확인
- [ ] 추적성 통계 계산 정확성 확인
- [ ] 공정 카드 클릭 시 상세 페이지 이동 확인

#### Milestone 3C: BOM UI 업데이트 테스트 (20분)

**Test 3C-1: BOM 폼 코일 필터 (20분)**
- [ ] "코일 자재만 표시" 체크박스 동작 확인
- [ ] 체크 시 코일 타입 품목만 표시되는지 확인
- [ ] 선택된 자재가 코일인 경우 뱃지 표시 확인
- [ ] 코일 자재 선택 시 스크랩율 필드 강조 확인

---

## 병렬 실행 전략

### Track 간 의존성
- Track 3A, 3B, 3C는 **완전 독립적**
- 모든 트랙이 Phase 2 API에만 의존
- 3개 트랙 **동시 병렬 실행 가능**

### 실행 순서 (병렬)
```
시작 시각: T0

[Track 3A] T0 → T0+4h
  ├─ 3A-1: CoilProcessForm.tsx (T0 → T0+1.5h)
  ├─ 3A-2: CoilProcessList.tsx (T0+1.5h → T0+3h)
  └─ 3A-3: CoilProcessDetail.tsx (T0+3h → T0+4h)

[Track 3B] T0 → T0+3h (병렬)
  └─ 3B-1: CoilTraceabilityView.tsx (T0 → T0+3h)

[Track 3C] T0 → T0+1h (병렬)
  └─ 3C-1: BOMForm.tsx 수정 (T0 → T0+1h)

완료 시각: T0+4h (최장 트랙 기준)
```

### 시간 절감
- **순차 실행 시**: 4h + 3h + 1h = 8시간
- **병렬 실행 시**: max(4h, 3h, 1h) = 4시간
- **절감률**: (8h - 4h) / 8h = **50%**

---

## Phase 3 완료 기준

### 각 트랙별 완료 조건

**Track 3A: Process Management UI**
- [x] CoilProcessForm.tsx 생성 완료 ✅
- [x] CoilProcessList.tsx 생성 완료 ✅
- [x] CoilProcessDetail.tsx 생성 완료 ✅
- [x] 라우팅 설정 완료 (/process, /process/new, /process/[id]) ✅
- [x] Milestone 3A 테스트 통과 ✅

**Track 3B: Traceability UI**
- [x] CoilTraceabilityView.tsx 생성 완료 ✅
- [x] 라우팅 설정 완료 (/traceability) ✅
- [x] Milestone 3B 테스트 통과 ✅

**Track 3C: BOM UI Updates**
- [x] BOMForm.tsx 수정 완료 ✅
- [x] Milestone 3C 테스트 통과 ✅

**Wave 3: UI 일관성 개선 (2025-11-19 추가)**
- [x] Agent 6: Table Layout Standardization ✅
  - 필터 컨트롤 pill 스타일 통일
  - VirtualTable 헤더 uppercase 적용
  - 반응형 높이 구현 (600px 고정 → calc(100vh-400px))
- [x] Agent 7: Responsive Design Enhancement ✅
  - 그리드 breakpoint 수정 (grid-cols-1 md:grid-cols-2)
  - Flex-wrap 추가로 모바일 레이아웃 개선
  - 버튼 레이아웃 최적화 (flex-col sm:flex-row)

### 전체 Phase 3 완료 조건
- [ ] 모든 트랙 (3A, 3B, 3C) 완료
- [ ] 네비게이션 메뉴 추가 완료
- [ ] 공통 유틸리티 함수 생성 완료
- [ ] 모든 Milestone 3 테스트 통과
- [ ] 조성원 차장 최종 승인

---

## 다음 단계

Phase 3 완료 후:
1. **통합 테스트**: Phase 1 + 2 + 3 전체 흐름 테스트
2. **성능 최적화**: 대용량 데이터 처리 시 성능 측정
3. **문서화**: 사용자 매뉴얼 작성
4. **배포**: Production 환경 배포 준비

---

**작성일**: 2025-02-02
**작성자**: Claude Code
**검토자**: 조성원 차장 (예정)
