-- ============================================================================
-- Portal System Migration
-- ============================================================================
-- Creates tables and RLS policies for supplier/customer portal
-- Date: 2025-01-23
--
-- Features:
-- - portal_users: User accounts for external companies
-- - portal_sessions: Session management with iron-session
-- - portal_access_logs: Audit trail for security
-- - RLS policies: Data isolation by company_id
-- ============================================================================

-- Enable Row Level Security extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Create portal_users table
-- ============================================================================
CREATE TABLE IF NOT EXISTS portal_users (
  portal_user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('CUSTOMER', 'SUPPLIER', 'ADMIN')),
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE portal_users IS 'Portal user accounts for external companies (customers/suppliers)';
COMMENT ON COLUMN portal_users.role IS 'User role: CUSTOMER (view sales), SUPPLIER (view purchases), ADMIN (full access)';
COMMENT ON COLUMN portal_users.password_hash IS 'bcrypt hash with 10 rounds';

-- ============================================================================
-- Create portal_sessions table
-- ============================================================================
CREATE TABLE IF NOT EXISTS portal_sessions (
  session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portal_user_id UUID NOT NULL REFERENCES portal_users(portal_user_id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE portal_sessions IS 'Active portal sessions (24-hour duration)';
COMMENT ON COLUMN portal_sessions.session_token IS 'Unique session token (crypto.randomUUID)';
COMMENT ON COLUMN portal_sessions.expires_at IS 'Session expiration time (24 hours from creation)';

-- ============================================================================
-- Create portal_access_logs table
-- ============================================================================
CREATE TABLE IF NOT EXISTS portal_access_logs (
  log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portal_user_id UUID REFERENCES portal_users(portal_user_id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE portal_access_logs IS 'Audit trail for portal access (login, logout, data access)';
COMMENT ON COLUMN portal_access_logs.action IS 'Action type: LOGIN_SUCCESS, LOGIN_FAILED, DATA_ACCESS, etc.';

-- ============================================================================
-- Create indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_portal_users_company_id ON portal_users(company_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_username ON portal_users(username) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_portal_users_role ON portal_users(role) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON portal_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_user_id ON portal_sessions(portal_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires ON portal_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_portal_access_logs_user_id ON portal_access_logs(portal_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_access_logs_created_at ON portal_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_access_logs_action ON portal_access_logs(action);

-- ============================================================================
-- Create function to set portal user context for RLS
-- ============================================================================
CREATE OR REPLACE FUNCTION set_portal_user_context(user_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.portal_user_id', user_id::TEXT, TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_portal_user_context IS 'Sets portal user context for RLS filtering';

-- ============================================================================
-- Enable RLS on sales_transactions and purchases
-- ============================================================================
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Create RLS policies for portal users
-- ============================================================================

-- Policy: Customers can only view their own sales transactions
DROP POLICY IF EXISTS portal_customer_sales_access ON sales_transactions;
CREATE POLICY portal_customer_sales_access ON sales_transactions
  FOR SELECT
  TO authenticated, anon
  USING (
    customer_id IN (
      SELECT company_id
      FROM portal_users
      WHERE portal_user_id::TEXT = current_setting('app.portal_user_id', TRUE)
        AND role = 'CUSTOMER'
        AND is_active = TRUE
    )
  );

COMMENT ON POLICY portal_customer_sales_access ON sales_transactions IS 'Customers can only view sales where they are the customer';

-- Policy: Suppliers can only view their own purchases
DROP POLICY IF EXISTS portal_supplier_purchase_access ON purchases;
CREATE POLICY portal_supplier_purchase_access ON purchases
  FOR SELECT
  TO authenticated, anon
  USING (
    supplier_id IN (
      SELECT company_id
      FROM portal_users
      WHERE portal_user_id::TEXT = current_setting('app.portal_user_id', TRUE)
        AND role = 'SUPPLIER'
        AND is_active = TRUE
    )
  );

COMMENT ON POLICY portal_supplier_purchase_access ON purchases IS 'Suppliers can only view purchases where they are the supplier';

-- Policy: Admin can view all transactions (no restrictions)
DROP POLICY IF EXISTS portal_admin_sales_access ON sales_transactions;
CREATE POLICY portal_admin_sales_access ON sales_transactions
  FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1
      FROM portal_users
      WHERE portal_user_id::TEXT = current_setting('app.portal_user_id', TRUE)
        AND role = 'ADMIN'
        AND is_active = TRUE
    )
  );

DROP POLICY IF EXISTS portal_admin_purchase_access ON purchases;
CREATE POLICY portal_admin_purchase_access ON purchases
  FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1
      FROM portal_users
      WHERE portal_user_id::TEXT = current_setting('app.portal_user_id', TRUE)
        AND role = 'ADMIN'
        AND is_active = TRUE
    )
  );

-- ============================================================================
-- Create trigger to update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_portal_user_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS portal_users_updated_at ON portal_users;
CREATE TRIGGER portal_users_updated_at
  BEFORE UPDATE ON portal_users
  FOR EACH ROW
  EXECUTE FUNCTION update_portal_user_updated_at();

-- ============================================================================
-- Create view for active portal sessions
-- ============================================================================
CREATE OR REPLACE VIEW v_active_portal_sessions AS
SELECT
  s.session_id,
  s.portal_user_id,
  s.session_token,
  s.expires_at,
  s.ip_address,
  s.user_agent,
  s.created_at,
  u.username,
  u.role,
  u.company_id,
  c.company_name,
  c.company_type
FROM portal_sessions s
INNER JOIN portal_users u ON s.portal_user_id = u.portal_user_id
INNER JOIN companies c ON u.company_id = c.company_id
WHERE s.expires_at > NOW()
  AND u.is_active = TRUE;

COMMENT ON VIEW v_active_portal_sessions IS 'Active portal sessions with user and company details';

-- ============================================================================
-- Create function to cleanup expired sessions
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_portal_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM portal_sessions
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_portal_sessions IS 'Deletes expired portal sessions and returns count deleted';

-- ============================================================================
-- Sample data for testing (optional, run manually)
-- ============================================================================
-- Note: Do not run in production, these are test users only
--
-- -- Create test customer user
-- INSERT INTO portal_users (company_id, username, password_hash, email, role)
-- SELECT
--   company_id,
--   '김철수_고객사',
--   '$2a$10$YourBcryptHashHere', -- Generated with bcrypt.hash('test123!', 10)
--   'customer@example.com',
--   'CUSTOMER'
-- FROM companies
-- WHERE company_name = 'Test Customer Company A'
-- LIMIT 1;
--
-- -- Create test supplier user
-- INSERT INTO portal_users (company_id, username, password_hash, email, role)
-- SELECT
--   company_id,
--   '이영희_공급사',
--   '$2a$10$YourBcryptHashHere', -- Generated with bcrypt.hash('test123!', 10)
--   'supplier@example.com',
--   'SUPPLIER'
-- FROM companies
-- WHERE company_name = 'Test Supplier Company B'
-- LIMIT 1;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- To verify:
-- 1. Check tables: SELECT * FROM portal_users;
-- 2. Check RLS policies: SELECT * FROM pg_policies WHERE tablename IN ('sales_transactions', 'purchases');
-- 3. Check indexes: SELECT * FROM pg_indexes WHERE tablename LIKE 'portal_%';
-- ============================================================================
