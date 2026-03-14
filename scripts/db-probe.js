require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

async function probe() {
  const client = new Client({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: 'postgres',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
  })

  try {
    await client.connect()
    console.log('CONNECTED_TO_POSTGRES_DB')
    
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'hackbase'")
    if (res.rowCount === 0) {
      console.log('CREATING_DATABASE_HACKBASE')
      await client.query('CREATE DATABASE hackbase')
      console.log('DATABASE_HACKBASE_CREATED')
    } else {
      console.log('DATABASE_HACKBASE_EXISTS')
    }
  } catch (err) {
    console.error('PROBE_FAILED:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

probe()
