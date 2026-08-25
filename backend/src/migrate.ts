import path from 'path'
import fs from 'fs'
import { runSqlFile, query, close } from './db'

const migrationsDir = path.join(__dirname, '..', 'migrations')

async function migrate() {
  console.log('Running migrations...')
  const files = fs.readdirSync(migrationsDir).filter(f=>f.endsWith('.sql')).sort()
  for (const f of files) {
    console.log('Applying', f)
    await runSqlFile(path.join(migrationsDir, f))
  }
  console.log('Migrations applied.')
}

async function seed() {
  console.log('Seeding characters...')
  const chars = [
    { name: 'Warrior', icon_url: '/icons/warrior.png', role: 'Fighter' },
    { name: 'Mage', icon_url: '/icons/mage.png', role: 'Mage' },
    { name: 'Assassin', icon_url: '/icons/assassin.png', role: 'Assassin' },
    { name: 'Support', icon_url: '/icons/support.png', role: 'Support' },
    { name: 'Tank', icon_url: '/icons/tank.png', role: 'Tank' },
    { name: 'Marksman', icon_url: '/icons/marksman.png', role: 'Marksman' }
  ]
  for (const c of chars) {
    await query('INSERT INTO characters (name, icon_url, role) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [c.name, c.icon_url, c.role])
  }
  console.log('Seed complete.')
}

async function main() {
  const arg = process.argv[2]
  try {
    await migrate()
    if (arg === '--seed') await seed()
  } catch (err) {
    console.error(err)
  } finally {
    await close()
  }
}

main()
