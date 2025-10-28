-- 스크랩 관련 컬럼 추가
ALTER TABLE items
ADD COLUMN IF NOT EXISTS scrap_rate DECIMAL(5,2) DEFAULT 0,  -- 스크랩율 (%)
ADD COLUMN IF NOT EXISTS scrap_unit_price DECIMAL(15,2) DEFAULT 0,  -- 스크랩 단가 (원/kg)
ADD COLUMN IF NOT EXISTS yield_rate DECIMAL(5,2) DEFAULT 100,  -- 수율 (%)
ADD COLUMN IF NOT EXISTS overhead_rate DECIMAL(5,2) DEFAULT 0;  -- 간접비율 (%)

COMMENT ON COLUMN items.scrap_rate IS '스크랩율 (%) - 가공 중 발생하는 스크랩 비율';
COMMENT ON COLUMN items.scrap_unit_price IS '스크랩 단가 (원/kg) - 스크랩 판매 시 단가';
COMMENT ON COLUMN items.yield_rate IS '수율 (%) - 실제 사용 가능한 재료 비율';
COMMENT ON COLUMN items.overhead_rate IS '간접비율 (%) - 간접비/관리비 배부율';

-- BOM 테이블에 공정 관련 컬럼 추가
ALTER TABLE bom
ADD COLUMN IF NOT EXISTS labor_cost DECIMAL(15,2) DEFAULT 0,  -- 가공비/공임비
ADD COLUMN IF NOT EXISTS machine_time DECIMAL(10,2) DEFAULT 0,  -- 기계 시간 (분)
ADD COLUMN IF NOT EXISTS setup_time DECIMAL(10,2) DEFAULT 0,  -- 준비 시간 (분)
ADD COLUMN IF NOT EXISTS notes TEXT;  -- 비고

COMMENT ON COLUMN bom.labor_cost IS '가공비/공임비 (원) - 해당 BOM 레벨의 가공 원가';
COMMENT ON COLUMN bom.machine_time IS '기계 시간 (분) - 가공에 필요한 기계 가동 시간';
COMMENT ON COLUMN bom.setup_time IS '준비 시간 (분) - 작업 준비 시간';
