import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/banpick'
const useSsl = process.env.DATABASE_SSL === 'true'
const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
})

export async function query(text: string, params?: any[]) {
  return pool.query(text, params)
}

export async function runSqlFile(filePath: string) {
  const sql = fs.readFileSync(filePath, 'utf8')
  return pool.query(sql)
}

export async function close() {
  await pool.end()
}

export async function getClient() {
  return pool.connect()
}
