-- Wave 3 Day 4 - Notification System Tables
-- Created: 2025-01-17

-- ============================================================================
-- 1. notifications 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('price_alert', 'price_change', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  item_id INTEGER REFERENCES items(item_id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_item_id ON notifications(item_id) WHERE item_id IS NOT NULL;

-- 복합 인덱스 (자주 사용되는 쿼리 조합)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_type ON notifications(user_id, type, created_at DESC);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();

-- 코멘트
COMMENT ON TABLE notifications IS 'Wave 3 Day 4 - 사용자 알림 테이블';
COMMENT ON COLUMN notifications.notification_id IS '알림 ID (Primary Key)';
COMMENT ON COLUMN notifications.user_id IS '사용자 ID';
COMMENT ON COLUMN notifications.type IS '알림 유형 (price_alert|price_change|system)';
COMMENT ON COLUMN notifications.title IS '알림 제목';
COMMENT ON COLUMN notifications.message IS '알림 내용';
COMMENT ON COLUMN notifications.item_id IS '관련 품목 ID (optional)';
COMMENT ON COLUMN notifications.is_read IS '읽음 상태';
COMMENT ON COLUMN notifications.created_at IS '생성 시각';
COMMENT ON COLUMN notifications.updated_at IS '수정 시각';


-- ============================================================================
-- 2. notification_preferences 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  preference_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  price_threshold NUMERIC(15,2),
  categories TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER trigger_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();

-- 코멘트
COMMENT ON TABLE notification_preferences IS 'Wave 3 Day 4 - 사용자 알림 설정 테이블';
COMMENT ON COLUMN notification_preferences.preference_id IS '설정 ID (Primary Key)';
COMMENT ON COLUMN notification_preferences.user_id IS '사용자 ID (Unique)';
COMMENT ON COLUMN notification_preferences.email_enabled IS '이메일 알림 활성화';
COMMENT ON COLUMN notification_preferences.push_enabled IS '푸시 알림 활성화';
COMMENT ON COLUMN notification_preferences.price_threshold IS '가격 알림 임계값 (원)';
COMMENT ON COLUMN notification_preferences.categories IS '알림 받을 카테고리 배열';
COMMENT ON COLUMN notification_preferences.created_at IS '생성 시각';
COMMENT ON COLUMN notification_preferences.updated_at IS '수정 시각';


-- ============================================================================
-- 3. 테스트 데이터 (개발/테스트 환경용)
-- ============================================================================

-- 샘플 알림 (item_id는 NULL로 설정하여 FK 제약 회피)
INSERT INTO notifications (user_id, type, title, message, item_id, is_read)
VALUES
  (1, 'price_alert', '가격 알림', '품목의 가격이 설정한 임계값을 초과했습니다.', NULL, FALSE),
  (1, 'price_change', '가격 변동', '품목의 가격이 10% 상승했습니다.', NULL, FALSE),
  (1, 'system', '시스템 알림', 'ERP 시스템이 업데이트되었습니다.', NULL, TRUE)
ON CONFLICT DO NOTHING;

-- 샘플 알림 설정 (user_id = 1)
INSERT INTO notification_preferences (user_id, email_enabled, push_enabled, price_threshold, categories)
VALUES
  (1, TRUE, FALSE, 100000, ARRAY['Parts', 'Materials'])
ON CONFLICT (user_id) DO NOTHING;


-- ============================================================================
-- 4. RLS (Row Level Security) - 추후 인증 구현 시 활성화
-- ============================================================================

-- RLS 활성화 (현재는 비활성화 상태로 유지)
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- 정책 예시 (인증 구현 후 활성화)
-- CREATE POLICY "Users can view their own notifications"
--   ON notifications FOR SELECT
--   USING (auth.uid()::INTEGER = user_id);

-- CREATE POLICY "Users can update their own notifications"
--   ON notifications FOR UPDATE
--   USING (auth.uid()::INTEGER = user_id);

-- CREATE POLICY "Users can view their own preferences"
--   ON notification_preferences FOR SELECT
--   USING (auth.uid()::INTEGER = user_id);

-- CREATE POLICY "Users can update their own preferences"
--   ON notification_preferences FOR ALL
--   USING (auth.uid()::INTEGER = user_id);
