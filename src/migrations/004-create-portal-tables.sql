-- Portal Authentication System
-- Migration: 004-create-portal-tables
-- Purpose: Create portal_users, portal_sessions, and portal_access_logs tables

-- ============================================================================
-- 1. Portal Users Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS portal_users (
  portal_user_id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'SUPPLIER', 'ADMIN')),
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for portal_users
CREATE INDEX IF NOT EXISTS idx_portal_users_company_id ON portal_users(company_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_username ON portal_users(username);
CREATE INDEX IF NOT EXISTS idx_portal_users_email ON portal_users(email);
CREATE INDEX IF NOT EXISTS idx_portal_users_is_active ON portal_users(is_active);

-- Comments
COMMENT ON TABLE portal_users IS '포털 사용자 정보 (외부 고객사/공급사)';
COMMENT ON COLUMN portal_users.portal_user_id IS '포털 사용자 ID (기본키)';
COMMENT ON COLUMN portal_users.company_id IS '연결된 거래처 ID';
COMMENT ON COLUMN portal_users.username IS '로그인 사용자명 (고유)';
COMMENT ON COLUMN portal_users.password_hash IS 'bcrypt 해시된 비밀번호';
COMMENT ON COLUMN portal_users.email IS '이메일 주소';
COMMENT ON COLUMN portal_users.role IS '사용자 역할 (CUSTOMER/SUPPLIER/ADMIN)';
COMMENT ON COLUMN portal_users.is_active IS '활성화 상태';
COMMENT ON COLUMN portal_users.last_login_at IS '마지막 로그인 시간';

-- ============================================================================
-- 2. Portal Sessions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS portal_sessions (
  session_id SERIAL PRIMARY KEY,
  portal_user_id INTEGER NOT NULL REFERENCES portal_users(portal_user_id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for portal_sessions
CREATE INDEX IF NOT EXISTS idx_portal_sessions_user_id ON portal_sessions(portal_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON portal_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires_at ON portal_sessions(expires_at);

-- Comments
COMMENT ON TABLE portal_sessions IS '포털 세션 정보 (iron-session 기반)';
COMMENT ON COLUMN portal_sessions.session_id IS '세션 ID (기본키)';
COMMENT ON COLUMN portal_sessions.portal_user_id IS '사용자 ID';
COMMENT ON COLUMN portal_sessions.session_token IS '세션 토큰 (UUID)';
COMMENT ON COLUMN portal_sessions.expires_at IS '세션 만료 시간 (24시간)';
COMMENT ON COLUMN portal_sessions.ip_address IS 'IP 주소';
COMMENT ON COLUMN portal_sessions.user_agent IS 'User Agent 문자열';

-- ============================================================================
-- 3. Portal Access Logs Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS portal_access_logs (
  log_id SERIAL PRIMARY KEY,
  portal_user_id INTEGER REFERENCES portal_users(portal_user_id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for portal_access_logs
CREATE INDEX IF NOT EXISTS idx_portal_access_logs_user_id ON portal_access_logs(portal_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_access_logs_action ON portal_access_logs(action);
CREATE INDEX IF NOT EXISTS idx_portal_access_logs_timestamp ON portal_access_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_portal_access_logs_success ON portal_access_logs(success);

-- Comments
COMMENT ON TABLE portal_access_logs IS '포털 접근 감사 로그';
COMMENT ON COLUMN portal_access_logs.log_id IS '로그 ID (기본키)';
COMMENT ON COLUMN portal_access_logs.portal_user_id IS '사용자 ID (NULL 가능)';
COMMENT ON COLUMN portal_access_logs.action IS '수행 동작 (LOGIN_SUCCESS, LOGIN_FAILED 등)';
COMMENT ON COLUMN portal_access_logs.resource IS '접근한 리소스 (API 경로 등)';
COMMENT ON COLUMN portal_access_logs.ip_address IS 'IP 주소';
COMMENT ON COLUMN portal_access_logs.user_agent IS 'User Agent 문자열';
COMMENT ON COLUMN portal_access_logs.success IS '성공 여부';
COMMENT ON COLUMN portal_access_logs.error_message IS '에러 메시지 (실패 시)';

-- ============================================================================
-- 4. Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on portal_users
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;

-- Portal users can only read their own data
CREATE POLICY portal_users_select_own ON portal_users
FOR SELECT
USING (portal_user_id = current_setting('app.portal_user_id', TRUE)::INTEGER);

-- Admin users can read all portal users
CREATE POLICY portal_users_select_admin ON portal_users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM portal_users pu
    WHERE pu.portal_user_id = current_setting('app.portal_user_id', TRUE)::INTEGER
    AND pu.role = 'ADMIN'
  )
);

-- Service role can bypass RLS (for authentication operations)
CREATE POLICY portal_users_service_role ON portal_users
FOR ALL
USING (current_user = 'service_role');

-- Enable RLS on portal_sessions
ALTER TABLE portal_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own sessions
CREATE POLICY portal_sessions_select_own ON portal_sessions
FOR SELECT
USING (portal_user_id = current_setting('app.portal_user_id', TRUE)::INTEGER);

-- Service role can bypass RLS
CREATE POLICY portal_sessions_service_role ON portal_sessions
FOR ALL
USING (current_user = 'service_role');

-- Enable RLS on portal_access_logs
ALTER TABLE portal_access_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own access logs
CREATE POLICY portal_access_logs_select_own ON portal_access_logs
FOR SELECT
USING (portal_user_id = current_setting('app.portal_user_id', TRUE)::INTEGER);

-- Admin users can read all access logs
CREATE POLICY portal_access_logs_select_admin ON portal_access_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM portal_users pu
    WHERE pu.portal_user_id = current_setting('app.portal_user_id', TRUE)::INTEGER
    AND pu.role = 'ADMIN'
  )
);

-- Service role can bypass RLS
CREATE POLICY portal_access_logs_service_role ON portal_access_logs
FOR ALL
USING (current_user = 'service_role');

-- ============================================================================
-- 5. Helper Functions
-- ============================================================================

-- Function to set portal user context for RLS
CREATE OR REPLACE FUNCTION set_portal_user_context(user_id INTEGER)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.portal_user_id', user_id::TEXT, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_portal_user_context IS 'RLS를 위한 포털 사용자 컨텍스트 설정';

-- Function to clear portal user context
CREATE OR REPLACE FUNCTION clear_portal_user_context()
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.portal_user_id', '', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION clear_portal_user_context IS '포털 사용자 컨텍스트 초기화';

-- ============================================================================
-- 6. Triggers
-- ============================================================================

-- Auto-update updated_at on portal_users
CREATE OR REPLACE FUNCTION update_portal_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_portal_users_updated_at
BEFORE UPDATE ON portal_users
FOR EACH ROW
EXECUTE FUNCTION update_portal_users_updated_at();

-- ============================================================================
-- 7. Sample Data for Testing (Optional)
-- ============================================================================

-- Note: In production, use the setup script to create test users
-- This is here for reference only

/*
-- Example: Create test customer user
INSERT INTO portal_users (company_id, username, password_hash, email, role, is_active)
VALUES (
  (SELECT company_id FROM companies WHERE company_type = '고객사' LIMIT 1),
  'test_customer',
  '$2a$10$YourHashedPasswordHere', -- Use bcrypt to hash 'password123'
  'customer@test.com',
  'CUSTOMER',
  TRUE
);

-- Example: Create test supplier user
INSERT INTO portal_users (company_id, username, password_hash, email, role, is_active)
VALUES (
  (SELECT company_id FROM companies WHERE company_type = '공급사' LIMIT 1),
  'test_supplier',
  '$2a$10$YourHashedPasswordHere', -- Use bcrypt to hash 'password123'
  'supplier@test.com',
  'SUPPLIER',
  TRUE
);
*/
