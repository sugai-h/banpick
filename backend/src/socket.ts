import { Server, Socket } from 'socket.io'
import { query, getClient } from './db'
import { getNextBanTeam, reconcileHostAssignment, resolveJoinPlayerState } from './roomRules'

type CharState = { characterId: number; state: 'available'|'banned'|'picked'; pickedBy?: string; pickedTeam?: 'A'|'B' }
type Player = { id: string; name: string; socketId?: string; team?: 'A'|'B'; isHost?: boolean }
type RoomState = {
  id: string;
  players: Player[];
  charStates: CharState[];
  phase: string;
  turnTeam?: 'A'|'B';
  remainingSelections?: number;
  timer?: any;
  remainingTime?: number;
  phaseIndex?: number;
  stepIndex?: number;
  pendingBanVotes?: Record<string, number>;
}

const rooms = new Map<string, RoomState>()

async function initRoom(roomId: string) {
  if (rooms.has(roomId)) return rooms.get(roomId)!
  // load players and charStates from DB
  const st: RoomState = { id: roomId, players: [], charStates: [], phase: 'lobby', remainingTime: 30, pendingBanVotes: {} }
  // Only query by UUID if the provided roomId looks like a UUID to avoid casting errors
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  let roomRow: any = undefined
  if (typeof roomId === 'string' && uuidRegex.test(roomId)) {
    roomRow = (await query('SELECT id, status, phase_index, step_index, remaining_selections FROM rooms WHERE id=$1', [roomId])).rows[0]
  }
  // If not found by UUID, allow looking up by numeric PIN (short room code)
  if (!roomRow && typeof roomId === 'string' && roomId.length < 36) {
    const byPin = (await query('SELECT id, status, phase_index, step_index, remaining_selections FROM rooms WHERE pin=$1', [roomId])).rows[0]
    if (byPin) {
      roomRow = byPin
      // use the canonical UUID id for subsequent queries
      roomId = roomRow.id
    }
  }
  if (roomRow) {
    st.phase = roomRow.status || 'lobby'
    st.phaseIndex = roomRow.phase_index ?? 0
    st.stepIndex = roomRow.step_index ?? 0
    st.remainingSelections = roomRow.remaining_selections ?? 0
  }
  const ps = await query('SELECT id, name, team, is_host, socket_id FROM players WHERE room_id=$1', [roomId])
  st.players = ps.rows.map((r:any) => ({ id: r.id, name: r.name, team: r.team, isHost: r.is_host, socketId: r.socket_id }))
  // ensure room_char_states exist for this room; if not, seed from characters
  const csCount = (await query('SELECT COUNT(*) FROM room_char_states WHERE room_id=$1', [roomId])).rows[0].count
  if (parseInt(csCount) === 0) {
    const chars = (await query('SELECT id FROM characters')).rows
    for (const c of chars) {
      await query('INSERT INTO room_char_states (room_id, character_id, state) VALUES ($1, $2, $3) ON CONFLICT (room_id, character_id) DO NOTHING', [roomId, c.id, 'available'])
    }
  }
  const cs = await query('SELECT character_id, state, picked_by, picked_team FROM room_char_states WHERE room_id=$1', [roomId])
  st.charStates = cs.rows.map((r:any)=>({ characterId: r.character_id, state: r.state, pickedBy: r.picked_by, pickedTeam: r.picked_team }))
  rooms.set(roomId, st)
  return st
}

function broadcastState(io: Server, roomId: string) {
  const s = rooms.get(roomId)
  if (!s) return
  io.to(roomId).emit('room:state', {
    phase: s.phase,
    players: s.players,
    charStates: s.charStates,
    turnTeam: s.turnTeam,
    remainingTime: s.remainingTime,
    remainingSelections: s.remainingSelections,
    phaseIndex: s.phaseIndex,
    stepIndex: s.stepIndex
  })
}

function startTimer(io: Server, roomId: string) {
  const s = rooms.get(roomId)
  if (!s) return
  clearInterval(s.timer)
  s.remainingTime = 30
  s.timer = setInterval(() => {
    if (s.remainingTime! <= 0) {
      clearInterval(s.timer)
      io.to(roomId).emit('timer:update', { remainingTime: 0 })
      // handle timeout: BAN -> skip, PICK -> random pick
      void handleTimeout(io, roomId)
      return
    }
    s.remainingTime!--
    io.to(roomId).emit('timer:update', { remainingTime: s.remainingTime })
  }, 1000)
}

async function handleTimeout(io: Server, roomId: string) {
  const s = rooms.get(roomId)
  if (!s) return
  try {
    if (s.phase && s.phase.startsWith('BAN')) {
      // skip: just advance turn
      io.to(roomId).emit('action:skipped', { reason: 'timeout', phase: s.phase })
      await advanceTurn(io, roomId)
      return
    }
    // for PICK phases, perform a random pick for the current turnTeam
    if (s.phase && s.phase.startsWith('PICK')) {
      const team = s.turnTeam
      if (!team) { await advanceTurn(io, roomId); return }
      const client = await getClient()
      try {
        await client.query('BEGIN')
        // pick a random available character (FOR UPDATE to lock)
        const rs = await client.query(`SELECT character_id FROM room_char_states WHERE room_id=$1 AND state='available' ORDER BY RANDOM() LIMIT 1 FOR UPDATE`, [roomId])
        if (!rs.rows.length) {
          await client.query('ROLLBACK')
          client.release()
          await advanceTurn(io, roomId)
          return
        }
        const characterId = rs.rows[0].character_id
        // ensure team not full
        const pickedCountRes = await client.query('SELECT COUNT(*) FROM room_char_states WHERE room_id=$1 AND state=$2 AND picked_team=$3', [roomId, 'picked', team])
        const pickedCount = parseInt(pickedCountRes.rows[0].count)
        if (pickedCount >= 3) {
          await client.query('ROLLBACK')
          client.release()
          await advanceTurn(io, roomId)
          return
        }
        await client.query('UPDATE room_char_states SET state=$1, picked_by=$2, picked_team=$3 WHERE room_id=$4 AND character_id=$5', ['picked', null, team, roomId, characterId])
        await client.query('UPDATE rooms SET remaining_selections = GREATEST(0, remaining_selections - 1) WHERE id=$1', [roomId])
        await client.query('COMMIT')
        client.release()
        // update in-memory
        const cs = s.charStates.find(c=>c.characterId===characterId)
        if (cs) { cs.state = 'picked'; cs.pickedBy = undefined; cs.pickedTeam = team }
        io.to(roomId).emit('action:confirmed', { playerId: null, actionType: 'pick', characterId })
        const roomRow = (await query('SELECT remaining_selections FROM rooms WHERE id=$1', [roomId])).rows[0]
        if (roomRow) s.remainingSelections = roomRow.remaining_selections
        broadcastState(io, roomId)
        await advanceTurn(io, roomId)
        return
      } catch (e) {
        await client.query('ROLLBACK')
        client.release()
        console.error(e)
        io.to(roomId).emit('error', { message: 'server_error' })
        return
      }
    }
    // default: advance
    await advanceTurn(io, roomId)
  } catch (e) { console.error(e); io.to(roomId).emit('error', { message: 'server_error' }) }
}

const PHASE_SEQUENCE = [
  // Phase1 BAN: A 2, B 2
  { name: 'BAN', steps: [{team: 'A', count:2}, {team:'B', count:2}] },
  // Phase2 PICK: A1 B2
  { name: 'PICK1', steps: [{team:'A', count:1}, {team:'B', count:2}] },
  // Phase3 PICK: A2 B1
  { name: 'PICK2', steps: [{team:'A', count:2}, {team:'B', count:1}] },
  // Phase4 PICK: remaining (fill to 3 per team)
  { name: 'PICK3', steps: [{team:'A', count:2}, {team:'B', count:2}] }
]

async function setCurrentStep(io: Server, s: RoomState, phaseIndex: number, stepIndex: number) {
  s.phaseIndex = phaseIndex
  s.stepIndex = stepIndex
  s.phase = PHASE_SEQUENCE[phaseIndex].name
  s.turnTeam = PHASE_SEQUENCE[phaseIndex].steps[stepIndex].team as 'A'|'B'
  s.remainingSelections = PHASE_SEQUENCE[phaseIndex].steps[stepIndex].count
  s.pendingBanVotes = {}
  // persist
  await query('UPDATE rooms SET phase_index=$1, step_index=$2, status=$3, remaining_selections=$4 WHERE id=$5', [phaseIndex, stepIndex, s.phase, s.remainingSelections, s.id])
}

async function advanceTurn(io: Server, roomId: string) {
  const s = rooms.get(roomId)
  if (!s) return
  s.pendingBanVotes = {}

  if (s.phase && s.phase.startsWith('BAN')) {
    const nextTeam = getNextBanTeam(s.turnTeam)
    if (nextTeam) {
      s.turnTeam = nextTeam
      s.remainingSelections = 0
      s.remainingTime = 30
      io.to(roomId).emit('turn:next', { turnTeam: s.turnTeam, remainingTime: s.remainingTime, remainingSelections: s.remainingSelections })
      startTimer(io, roomId)
      return
    }
    await setCurrentStep(io, s, 1, 0)
    s.remainingTime = 30
    io.to(roomId).emit('turn:next', { turnTeam: s.turnTeam, remainingTime: s.remainingTime, remainingSelections: s.remainingSelections })
    startTimer(io, roomId)
    return
  }

  // decrease remainingSelections if present
  if (s.remainingSelections && s.remainingSelections > 0) {
    s.remainingSelections!--
    // persist remainingSelections
    await query('UPDATE rooms SET remaining_selections=$1 WHERE id=$2', [s.remainingSelections, s.id])
  }
  // if still selections left for this step, keep same team
  if (s.remainingSelections && s.remainingSelections > 0) {
    s.remainingTime = 30
    io.to(roomId).emit('turn:next', { turnTeam: s.turnTeam, remainingTime: s.remainingTime, remainingSelections: s.remainingSelections })
    startTimer(io, roomId)
    return
  }
  // move to next step
  let nextPhase = (s.phaseIndex ?? 0)
  let nextStep = (s.stepIndex ?? 0) + 1
  if (nextStep >= PHASE_SEQUENCE[nextPhase].steps.length) {
    nextPhase++
    nextStep = 0
  }
  if (nextPhase >= PHASE_SEQUENCE.length) {
    // finished
    s.phase = 'finished'
    s.turnTeam = undefined
    s.remainingSelections = 0
    clearInterval(s.timer)
    io.to(roomId).emit('phase:finished', { })
    broadcastState(io, roomId)
    return
  }
  await setCurrentStep(io, s, nextPhase, nextStep)
  s.remainingTime = 30
  io.to(roomId).emit('turn:next', { turnTeam: s.turnTeam, remainingTime: s.remainingTime, remainingSelections: s.remainingSelections })
  startTimer(io, roomId)
}

export function createSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    socket.on('joinRoom', async ({ roomId, playerId, playerName }: any) => {
      console.log('[joinRoom] request', { roomId, playerId, playerName, socketId: socket.id })
      // Initialize room and get canonical room id (UUID). Use that for socket.join and DB ops.
      const st = await initRoom(roomId)
      // ensure room exists
      if (!st) {
        console.error('[joinRoom] room not found', { roomId, playerId, socketId: socket.id })
        return socket.emit('error', { message: 'room_not_found' })
      }
      const canonicalId = st.id
      socket.join(canonicalId)

      const resolved = resolveJoinPlayerState(st.players, playerId || socket.id, playerName || 'Player')
      let p: Player | undefined = st.players.find((player) => player.id === resolved.id)
      if (!p) {
        p = {
          id: resolved.id,
          name: resolved.name,
          socketId: socket.id,
          isHost: resolved.isHost,
          team: resolved.team
        }
        st.players.push(p)
      } else {
        p.name = resolved.name
        p.isHost = resolved.isHost
        p.team = resolved.team ?? p.team
        p.socketId = socket.id
      }

      reconcileHostAssignment(st.players)
      const normalized = st.players.find((player) => player.id === resolved.id)
      if (normalized) {
        normalized.socketId = socket.id
      }

      await query(
        `INSERT INTO players (id, room_id, name, socket_id, is_host, team)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           socket_id = EXCLUDED.socket_id,
           room_id = EXCLUDED.room_id,
           name = EXCLUDED.name,
           is_host = EXCLUDED.is_host,
           team = EXCLUDED.team`,
        [
          normalized?.id ?? resolved.id,
          canonicalId,
          normalized?.name ?? resolved.name,
          socket.id,
          normalized?.isHost ?? resolved.isHost,
          normalized?.team ?? resolved.team ?? null
        ]
      )

      // cap players to 6
      if (st.players.length > 6) {
        console.warn('[joinRoom] room full', { roomId: canonicalId, playerId, socketId: socket.id, players: st.players.length })
        socket.emit('error', { message: 'room_full' })
        return
      }
      console.log('[joinRoom] success', { roomId: canonicalId, playerId: normalized?.id ?? resolved.id, socketId: socket.id, players: st.players.length })
      io.to(canonicalId).emit('room:players', { players: st.players })
      broadcastState(io, canonicalId)
    })

    socket.on('startBanPick', async ({ roomId, playerId }: any) => {
      const s = await initRoom(roomId)
      if (!s) return socket.emit('error', { message: 'no_room' })
      // only host can start
      const p = s.players.find(p => p.id === playerId)
      if (!p || !p.isHost) return socket.emit('error', { message: 'not_host' })
      if (s.phase !== 'lobby') return socket.emit('error', { message: 'invalid_phase' })
      // initialize sequence
      await setCurrentStep(io, s, 0, 0)
      // persist status
      await query('UPDATE rooms SET status=$1 WHERE id=$2', [s.phase, s.id])
      startTimer(io, s.id)
      broadcastState(io, s.id)
    })

    socket.on('stopBanPick', async ({ roomId, playerId }: any) => {
      const s = await initRoom(roomId)
      if (!s) return socket.emit('error', { message: 'no_room' })
      const p = s.players.find(p => p.id === playerId)
      if (!p || !p.isHost) return socket.emit('error', { message: 'not_host' })
      // stop sequence and reset to lobby
      s.phase = 'lobby'
      s.phaseIndex = 0
      s.stepIndex = 0
      s.turnTeam = undefined
      s.remainingSelections = 0
      clearInterval(s.timer)
      await query('UPDATE rooms SET status=$1, phase_index=$2, step_index=$3, remaining_selections=$4 WHERE id=$5', ['lobby', 0, 0, 0, s.id])
      io.to(s.id).emit('action:stopped', { by: playerId })
      broadcastState(io, s.id)
    })

    socket.on('requestAction', async ({ roomId, playerId, actionType, characterId }: any) => {
      try {
        // ensure we have canonical room state (supports PIN or UUID inputs)
        const s = await initRoom(roomId)
        if (!s) return socket.emit('error', { message: 'no_room' })
        const canonicalId = s.id
        console.debug('[requestAction] canonicalId=', canonicalId, 'incomingRoomId=', roomId, 'characterId=', characterId, 'playerId=', playerId, 'action=', actionType)
        const player = s.players.find(p => p.id === playerId)
        if (!player) return socket.emit('error', { message: 'not_your_turn' })

        if (actionType === 'ban') {
          if (s.phase !== 'BAN') return socket.emit('error', { message: 'invalid_phase_for_action' })
          if (player.team !== s.turnTeam) return socket.emit('error', { message: 'not_your_turn' })
        }

        if (actionType === 'pick') {
          if (s.phase === 'BAN') return socket.emit('error', { message: 'invalid_phase_for_action' })
          if (s.turnTeam && player.team !== s.turnTeam) return socket.emit('error', { message: 'not_your_turn' })
          if (!player.team) return socket.emit('error', { message: 'no_team_assigned' })
        }
        // verify turn
        if (s.turnTeam && !s.players.find(p => p.id === playerId && p.team === s.turnTeam)) {
          return socket.emit('error', { message: 'not_your_turn' })
        }
        const client = await getClient()
        try {
          await client.query('BEGIN')

          if (actionType === 'ban' && s.phase === 'BAN' && s.turnTeam) {
            const teamPlayers = s.players.filter((player) => player.team === s.turnTeam)
            if (!teamPlayers.length) {
              await client.query('ROLLBACK')
              client.release()
              return socket.emit('error', { message: 'not_your_turn' })
            }

            s.pendingBanVotes ??= {}
            s.pendingBanVotes[playerId] = characterId

            const teamVoteIds = teamPlayers.map((player) => player.id)
            const votedAll = teamVoteIds.every((id) => Object.prototype.hasOwnProperty.call(s.pendingBanVotes, id))

            if (!votedAll) {
              await client.query('ROLLBACK')
              client.release()
              broadcastState(io, s.id)
              return
            }

            const selectedCharacters = Array.from(new Set(Object.values(s.pendingBanVotes)))
            for (const selectedCharacterId of selectedCharacters) {
              const rs = await client.query('SELECT state FROM room_char_states WHERE room_id=$1 AND character_id=$2 FOR UPDATE', [canonicalId, selectedCharacterId])
              if (!rs.rows.length) {
                await client.query('ROLLBACK')
                client.release()
                return socket.emit('error', { message: 'invalid_character' })
              }
              if (rs.rows[0].state !== 'available') {
                await client.query('ROLLBACK')
                client.release()
                return socket.emit('error', { message: 'invalid_character' })
              }
              await client.query('UPDATE room_char_states SET state=$1 WHERE room_id=$2 AND character_id=$3', ['banned', canonicalId, selectedCharacterId])
            }

            s.pendingBanVotes = {}
            s.remainingSelections = 0
            await client.query('UPDATE rooms SET remaining_selections = 0 WHERE id=$1', [canonicalId])
            await client.query('COMMIT')
            client.release()
            for (const selectedCharacterId of selectedCharacters) {
              const cs = s.charStates.find(c => c.characterId === selectedCharacterId)
              if (cs) {
                cs.state = 'banned'
                cs.pickedBy = undefined
                cs.pickedTeam = undefined
              }
            }
            io.to(s.id).emit('action:confirmed', { playerId, actionType, characterId: selectedCharacters })
            const roomRow = (await query('SELECT remaining_selections FROM rooms WHERE id=$1', [s.id])).rows[0]
            if (roomRow) s.remainingSelections = roomRow.remaining_selections
            broadcastState(io, s.id)
            await advanceTurn(io, s.id)
            return
          }

          const rs = await client.query('SELECT state FROM room_char_states WHERE room_id=$1 AND character_id=$2 FOR UPDATE', [canonicalId, characterId])
          if (!rs.rows.length) {
            console.error('[requestAction] no room_char_states row', { room_id: canonicalId, character_id: characterId })
            await client.query('ROLLBACK')
            client.release()
            return socket.emit('error', { message: 'invalid_character' })
          }
          const cur = rs.rows[0].state
          if (cur !== 'available') {
            await client.query('ROLLBACK')
            client.release()
            return socket.emit('error', { message: 'invalid_character' })
          }
          if (actionType === 'ban') {
            await client.query('UPDATE room_char_states SET state=$1 WHERE room_id=$2 AND character_id=$3', ['banned', canonicalId, characterId])
          } else if (actionType === 'pick') {
            const pickedCountRes = await client.query('SELECT COUNT(*) FROM room_char_states WHERE room_id=$1 AND state=$2 AND picked_team=$3', [canonicalId, 'picked', s.turnTeam])
            const pickedCount = parseInt(pickedCountRes.rows[0].count)
            if (pickedCount >= 3) {
              await client.query('ROLLBACK')
              client.release()
              return socket.emit('error', { message: 'team_full' })
            }
            await client.query('UPDATE room_char_states SET state=$1, picked_by=$2, picked_team=$3 WHERE room_id=$4 AND character_id=$5', ['picked', playerId, s.turnTeam, canonicalId, characterId])
          }
          // decrement remaining_selections
          await client.query('UPDATE rooms SET remaining_selections = GREATEST(0, remaining_selections - 1) WHERE id=$1', [canonicalId])
          await client.query('COMMIT')
        } catch (e) {
          await client.query('ROLLBACK')
          client.release()
          console.error(e)
          return socket.emit('error', { message: 'server_error' })
        }
        client.release()
        // update in-memory
        const cs = s.charStates.find(c=>c.characterId===characterId)
        if (cs) {
          cs.state = actionType === 'ban' ? 'banned' : 'picked'
          if (actionType === 'pick') { cs.pickedBy = playerId; cs.pickedTeam = s.turnTeam }
        }
        io.to(s.id).emit('action:confirmed', { playerId, actionType, characterId })
        // refresh remainingSelections from DB
        const roomRow = (await query('SELECT remaining_selections FROM rooms WHERE id=$1', [s.id])).rows[0]
        if (roomRow) s.remainingSelections = roomRow.remaining_selections
        broadcastState(io, s.id)
        await advanceTurn(io, s.id)
      } catch(e) { console.error(e); socket.emit('error', { message: 'server_error' }) }
    })

    socket.on('assignTeam', async ({ roomId, playerId, team }: any) => {
      try {
        const s = await initRoom(roomId)
        const p = s.players.find(p => p.id === playerId)
        if (!p) return
        p.team = team
        await query('UPDATE players SET team=$1 WHERE id=$2', [team, playerId])
        io.to(s.id).emit('room:players', { players: s.players })
        broadcastState(io, s.id)
      } catch(e) { console.error(e) }
    })

    socket.on('disconnect', () => {
      // clean up socketId
      for (const s of rooms.values()) {
        const p = s.players.find(p => p.socketId === socket.id)
        if (p) p.socketId = undefined
      }
    })
  })
}
