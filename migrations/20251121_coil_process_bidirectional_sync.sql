-- =====================================================
-- 코일 공정 양방향 동기화 트리거 마이그레이션
--
-- 작성일: 2025-11-21
-- 목적: process_operations ↔ coil_process_history 상태 동기화
--
-- 기능:
--   1. process_operations 상태 변경 → coil_process_history 자동 동기화
--   2. coil_process_history 상태 변경 → process_operations 자동 동기화
-- =====================================================

-- =====================================================
-- 1. 동기화 함수 생성
-- =====================================================

-- 1-1. process_operations → coil_process_history 동기화 함수
CREATE OR REPLACE FUNCTION sync_operation_status_to_coil_history()
RETURNS TRIGGER AS $$
BEGIN
    -- process_operations의 상태가 변경되면 연결된 coil_process_history도 업데이트
    IF NEW.coil_process_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
        UPDATE coil_process_history
        SET
            status = NEW.status,
            updated_at = NOW()
        WHERE process_id = NEW.coil_process_id;

        RAISE NOTICE '[SYNC] process_operations(%) → coil_process_history(%): status = %',
            NEW.operation_id, NEW.coil_process_id, NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_operation_status_to_coil_history() IS
'process_operations 테이블의 상태 변경을 coil_process_history 테이블로 동기화합니다.
coil_process_id가 설정된 경우에만 동기화가 수행됩니다.';

-- 1-2. coil_process_history → process_operations 동기화 함수
CREATE OR REPLACE FUNCTION sync_coil_history_status_to_operation()
RETURNS TRIGGER AS $$
BEGIN
    -- coil_process_history의 상태가 변경되면 연결된 process_operations도 업데이트
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        UPDATE process_operations
        SET
            status = NEW.status,
            updated_at = NOW()
        WHERE coil_process_id = NEW.process_id;

        RAISE NOTICE '[SYNC] coil_process_history(%) → process_operations: status = %',
            NEW.process_id, NEW.status;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION sync_coil_history_status_to_operation() IS
'coil_process_history 테이블의 상태 변경을 process_operations 테이블로 동기화합니다.
해당 process_id를 coil_process_id로 참조하는 모든 레코드가 업데이트됩니다.';

-- =====================================================
-- 2. 트리거 생성
-- =====================================================

-- 2-1. process_operations 상태 변경 시 coil_process_history 동기화
DROP TRIGGER IF EXISTS sync_to_coil_history ON process_operations;
CREATE TRIGGER sync_to_coil_history
    AFTER UPDATE OF status ON process_operations
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.coil_process_id IS NOT NULL)
    EXECUTE FUNCTION sync_operation_status_to_coil_history();

COMMENT ON TRIGGER sync_to_coil_history ON process_operations IS
'process_operations 상태 변경 시 연결된 coil_process_history 레코드의 상태를 동기화합니다.';

-- 2-2. coil_process_history 상태 변경 시 process_operations 동기화
DROP TRIGGER IF EXISTS sync_to_process_operations ON coil_process_history;
CREATE TRIGGER sync_to_process_operations
    AFTER UPDATE OF status ON coil_process_history
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION sync_coil_history_status_to_operation();

COMMENT ON TRIGGER sync_to_process_operations ON coil_process_history IS
'coil_process_history 상태 변경 시 연결된 process_operations 레코드의 상태를 동기화합니다.';

-- =====================================================
-- 3. 검증 쿼리
-- =====================================================

-- 트리거 상태 확인
-- SELECT
--     tgname AS trigger_name,
--     CASE tgenabled
--         WHEN 'O' THEN '✅ 활성화'
--         WHEN 'D' THEN '❌ 비활성화'
--     END AS status
-- FROM pg_trigger
-- WHERE tgrelid IN ('coil_process_history'::regclass, 'process_operations'::regclass)
-- AND tgname LIKE 'sync_%'
-- ORDER BY tgname;

-- =====================================================
-- 4. 상태값 참조 (CHECK 제약조건)
-- =====================================================
-- coil_process_history_status_check:
--   status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
--
-- process_operations도 동일한 상태값 사용:
--   PENDING     - 대기
--   IN_PROGRESS - 진행 중
--   COMPLETED   - 완료
--   CANCELLED   - 취소
-- =====================================================
