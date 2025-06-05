import { db } from './configs/db.js';

async function testDb() {
  try {
    console.log('Testing database connection...');
    const result = await db.query('SELECT NOW()');
    console.log('✅ Database connected successfully:', result.rows[0]);
    
    // Test pipelines table
    const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('📋 Available tables:', tables.rows.map(r => r.table_name));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testDb();
