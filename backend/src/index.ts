import express from 'express'
import http from 'http'
import { Server as IOServer } from 'socket.io'
import cors from 'cors'
import bodyParser from 'body-parser'
import { createSockets } from './socket'
import { v4 as uuidv4 } from 'uuid'
import { query } from './db'

const app = express()
app.use(cors())
app.use(bodyParser.json())

// Note: characters are persisted via migrations/seed

// Simple REST endpoints
app.get('/api/characters', async (req, res) => {
  try {
    const { rows } = await query('SELECT id, name, icon_url, role FROM characters ORDER BY id')
    res.json({ characters: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'db_error' })
  }
})

// create room
app.post('/api/rooms', async (req, res) => {
  const { pin, hostName } = req.body
  const roomId = uuidv4()
  try {
    await query('INSERT INTO rooms (id, pin, status) VALUES ($1, $2, $3)', [roomId, pin || '', 'lobby'])
    // seed room_char_states from characters
    // ensure characters table has entries; if empty, seed default 1..102
    const charCountRes = await query('SELECT COUNT(*) FROM characters')
    const charCount = parseInt(charCountRes.rows[0].count)
    if (charCount === 0) {
      const vals = [] as any[]
      for (let i = 1; i <= 102; i++) {
        vals.push(i)
      }
      for (const i of vals) {
        await query('INSERT INTO characters (name, icon_url, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [`Character ${i}`, null, `Role ${((i-1)%4)+1}`])
      }
    }
    const { rows } = await query('SELECT id FROM characters')
    for (const r of rows) {
      await query('INSERT INTO room_char_states (room_id, character_id, state) VALUES ($1, $2, $3) ON CONFLICT (room_id, character_id) DO NOTHING', [roomId, r.id, 'available'])
    }
    // create host player record so creator is host and assigned to team A
    const playerId = uuidv4()
    await query('INSERT INTO players (id, room_id, name, is_host, team) VALUES ($1, $2, $3, $4, $5)', [playerId, roomId, hostName || 'Host', true, 'A'])
    res.status(201).json({ roomId, playerId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'db_error' })
  }
})

app.post('/api/rooms/join', async (req, res) => {
  const { roomId, pin, playerName, playerId: providedPlayerId } = req.body
  try {
    // verify room and pin (accept either UUID id or short PIN)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    let roomRow: any = undefined
    if (roomId && uuidRegex.test(roomId)) {
      roomRow = (await query('SELECT id, pin FROM rooms WHERE id=$1', [roomId])).rows[0]
    }
    // try lookup by provided pin
    if (!roomRow && pin) {
      roomRow = (await query('SELECT id, pin FROM rooms WHERE pin=$1', [pin])).rows[0]
    }
    // allow frontend that sends short roomId as PIN
    if (!roomRow && roomId && roomId.length < 36) {
      const byPin = (await query('SELECT id, pin FROM rooms WHERE pin=$1', [roomId])).rows[0]
      if (byPin) roomRow = byPin
    }
    if (!roomRow) return res.status(404).json({ error: 'room_not_found' })
    if (roomRow.pin && pin && roomRow.pin !== pin) return res.status(403).json({ error: 'invalid_pin' })
    const playerId = providedPlayerId || uuidv4()
    await query('INSERT INTO players (id, room_id, name, is_host) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET room_id = $2, name = $3', [playerId, roomRow.id, playerName || 'Player', false])
    res.json({ playerId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'db_error' })
  }
})

app.get('/api/rooms/:id/state', async (req, res) => {
  const roomId = req.params.id
  try {
    // accept UUID or short PIN in the path
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    let lookupId: string | undefined = undefined
    if (uuidRegex.test(roomId)) {
      lookupId = roomId
    } else {
      const byPin = (await query('SELECT id FROM rooms WHERE pin=$1', [roomId])).rows[0]
      if (byPin) lookupId = byPin.id
    }
    if (!lookupId) return res.status(404).json({ error: 'room_not_found' })
    const players = (await query('SELECT id, name, team FROM players WHERE room_id=$1', [lookupId])).rows
    const chars = (await query('SELECT character_id, state, picked_by, picked_team FROM room_char_states WHERE room_id=$1', [lookupId])).rows
    const room = (await query('SELECT id, status FROM rooms WHERE id=$1', [lookupId])).rows[0]
    res.json({ room, players, chars })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'db_error' })
  }
})

const server = http.createServer(app)
const allowedOrigin = process.env.FRONTEND_ORIGIN || '*'
const io = new IOServer(server, { cors: { origin: allowedOrigin } })

createSockets(io)

const PORT = process.env.PORT || 4000
server.listen(PORT, () => console.log(`Backend listening ${PORT}`))
