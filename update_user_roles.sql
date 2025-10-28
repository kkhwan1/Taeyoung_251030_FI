UPDATE users SET role = 'accountant' WHERE username = 'accountant';
UPDATE users SET role = 'ceo' WHERE username = 'ceo';
SELECT user_id, username, name, role, is_active FROM users WHERE username IN ('accountant', 'ceo', 'admin');
