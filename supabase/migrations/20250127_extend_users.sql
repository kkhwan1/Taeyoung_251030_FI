-- Phase 1: 사용자 역할 관리 시스템
-- users 테이블 확장

-- department 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- role 컬럼의 CHECK 제약 조건 업데이트
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'manager', 'user', 'viewer', 'operator'));

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- 자동 업데이트 트리거 함수 (이미 있으면 재생성)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- users 테이블에 트리거 적용
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 코멘트 추가
COMMENT ON COLUMN users.department IS '부서명 (예: 영업팀, 회계팀, 관리팀)';
COMMENT ON COLUMN users.role IS '사용자 역할: admin(관리자), manager(매니저), user(사용자), viewer(열람자), operator(운영자)';

