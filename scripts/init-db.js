require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set in .env.local');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const sql = postgres(connectionString);

  try {
    const schemaPath = path.join(__dirname, '../.agents/skills/location-memory-management/references/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running schema.sql...');
    
    // postgres package can handle multiple statements if we pass it as a simple query
    await sql.unsafe(schemaSql);
    
    console.log('Database initialized successfully!');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    await sql.end();
  }
}

main();
