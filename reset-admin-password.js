const bcrypt = require('bcryptjs');

async function resetPassword() {
  const password = 'password123';
  const hashed = await bcrypt.hash(password, 10);
  console.log('Hashed password for "password123":', hashed);
  
  // SQL update command
  console.log('\nRun this SQL in Supabase:');
  console.log(`UPDATE users SET password = '${hashed}' WHERE username = 'admin';`);
  console.log(`UPDATE users SET password = '${hashed}' WHERE username = 'accountant';`);
  console.log(`UPDATE users SET password = '${hashed}' WHERE username = 'ceo';`);
}

resetPassword();

