import { Server, Socket } from 'socket.io'
import { query, getClient } from './db'
import { reconcileHostAssignment, resolveJoinPlayerState } from './roomRules'

// ─── フェーズ定義型 ───────────────────────────────────────────────────────────
// type: 'BAN' = 全員投票BAN, 'PICK_A' = 蒼チームPICK, 'PICK_B' = 紅チームPICK
export type PhaseStep = { type: 'BAN' | 'PICK_A' | 'PICK_B'; count: number }

// デフォルトフェーズ構成（変更可能）
const DEFAULT_PHASE_SEQUENCE: PhaseStep[] = [
  { type: 'BAN',    count: 0 },
  { type: 'PICK_A', count: 1 },
  { type: 'PICK_B', count: 2 },
  { type: 'PICK_A', count: 2 },
  { type: 'PICK_B', count: 1 },
]

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
  phaseIndex?: number;      // customPhases の現在インデックス
  pendingBanVotes?: Record<string, number>;
  customPhases: PhaseStep[]; // ホストが設定したフェーズ列
}

const rooms = new Map<string, RoomState>()

async function initRoom(rawRoomId: string) {
  // ── Step 1: resolve canonical UUID ──────────────────────────────────────
  // If the caller already passed a cached UUID-keyed state, return it fast.
  if (rooms.has(rawRoomId)) return rooms.get(rawRoomId)!

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  let roomRow: any = undefined

  if (uuidRegex.test(rawRoomId)) {
    // Looks like a UUID — query directly
    roomRow = (await query(
      'SELECT id, status, phase_index, remaining_selections, custom_phases FROM rooms WHERE id=$1',
      [rawRoomId]
    )).rows[0]
  }

  if (!roomRow) {
    // Treat rawRoomId as a PIN and resolve to the UUID row
    const byPin = (await query(
      'SELECT id, status, phase_index, remaining_selections, custom_phases FROM rooms WHERE pin=$1',
      [rawRoomId]
    )).rows[0]
    if (byPin) roomRow = byPin
  }

  if (!roomRow) {
    // Room not found — return a minimal stub so callers can emit room_not_found
    return null as unknown as RoomState
  }

  // ── Step 2: canonicalId is ALWAYS the UUID from the DB row ──────────────
  const canonicalId: string = roomRow.id

  // If we previously cached under the PIN key, return that same object
  // (avoids duplicate state; also handles the re-connect path)
  if (rooms.has(canonicalId)) {
    // Also cache under the rawRoomId alias so next call hits the fast path
    if (rawRoomId !== canonicalId) rooms.set(rawRoomId, rooms.get(canonicalId)!)
    return rooms.get(canonicalId)!
  }

  // ── Step 3: build RoomState with st.id = canonicalId ────────────────────
  const st: RoomState = {
    id: canonicalId,          // ← always UUID, never PIN
    players: [],
    charStates: [],
    phase: roomRow.status || 'lobby',
    phaseIndex: roomRow.phase_index ?? 0,
    remainingSelections: roomRow.remaining_selections ?? 0,
    remainingTime: 30,
    pendingBanVotes: {},
    customPhases: roomRow.custom_phases
      ? JSON.parse(roomRow.custom_phases)
      : [...DEFAULT_PHASE_SEQUENCE],
  }

  // ── Step 4: load players (use canonicalId for all DB queries) ────────────
  const ps = await query(
    'SELECT id, name, team, is_host, socket_id FROM players WHERE room_id=$1',
    [canonicalId]
  )
  st.players = ps.rows.map((r: any) => ({
    id: r.id, name: r.name, team: r.team, isHost: r.is_host, socketId: r.socket_id
  }))

  // ── Step 5: seed room_char_states if missing ─────────────────────────────
  const csCount = (await query(
    'SELECT COUNT(*) FROM room_char_states WHERE room_id=$1',
    [canonicalId]
  )).rows[0].count
  if (parseInt(csCount) === 0) {
    const chars = (await query('SELECT id FROM characters')).rows
    for (const c of chars) {
      await query(
        'INSERT INTO room_char_states (room_id, character_id, state) VALUES ($1, $2, $3) ON CONFLICT (room_id, character_id) DO NOTHING',
        [canonicalId, c.id, 'available']
      )
    }
  }
  const cs = await query(
    'SELECT character_id, state, picked_by, picked_team FROM room_char_states WHERE room_id=$1',
    [canonicalId]
  )
  st.charStates = cs.rows.map((r: any) => ({
    characterId: r.character_id, state: r.state, pickedBy: r.picked_by, pickedTeam: r.picked_team
  }))

  // ── Step 6: store under canonicalId (and optionally alias under PIN) ─────
  rooms.set(canonicalId, st)
  if (rawRoomId !== canonicalId) rooms.set(rawRoomId, st)

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
    customPhases: s.customPhases,
  })
}

function startTimer(io: Server, roomId: string) {
  // roomId must be canonical UUID (s.id)
  const s = rooms.get(roomId)
  if (!s) return
  clearInterval(s.timer)
  s.remainingTime = 30
  const canonicalId = s.id
  s.timer = setInterval(() => {
    if (s.remainingTime! <= 0) {
      clearInterval(s.timer)
      io.to(canonicalId).emit('timer:update', { remainingTime: 0 })
      void handleTimeout(io, canonicalId)
      return
    }
    s.remainingTime!--
    io.to(canonicalId).emit('timer:update', { remainingTime: s.remainingTime })
  }, 1000)
}

async function handleTimeout(io: Server, roomId: string) {
  const s = rooms.get(roomId)
  if (!s) return
  const canonicalId = s.id   // always UUID
  try {
    if (s.phase === 'BAN') {
      // タイムアウト時はBAN票をそのまま確定して次へ進む
      io.to(canonicalId).emit('action:skipped', { reason: 'timeout', phase: s.phase })
      await advanceTurn(io, canonicalId)
      return
    }
    // PICK フェーズ: ランダムにPICK
    if (s.phase === 'PICK_A' || s.phase === 'PICK_B') {
      const team = s.turnTeam
      if (!team) { await advanceTurn(io, canonicalId); return }
      const client = await getClient()
      try {
        await client.query('BEGIN')
        // pick a random available character (FOR UPDATE to lock)
        const rs = await client.query(`SELECT character_id FROM room_char_states WHERE room_id=$1 AND state='available' ORDER BY RANDOM() LIMIT 1 FOR UPDATE`, [canonicalId])
        if (!rs.rows.length) {
          await client.query('ROLLBACK')
          client.release()
          await advanceTurn(io, canonicalId)
          return
        }
        const characterId = rs.rows[0].character_id
        // チームフル制限なし（フェーズ設定で枚数を管理するため上限チェック不要）
        await client.query('UPDATE room_char_states SET state=$1, picked_by=$2, picked_team=$3 WHERE room_id=$4 AND character_id=$5', ['picked', null, team, canonicalId, characterId])
        await client.query('UPDATE rooms SET remaining_selections = GREATEST(0, remaining_selections - 1) WHERE id=$1', [canonicalId])
        await client.query('COMMIT')
        client.release()
        // update in-memory
        const cs = s.charStates.find(c=>c.characterId===characterId)
        if (cs) { cs.state = 'picked'; cs.pickedBy = undefined; cs.pickedTeam = team }
        io.to(canonicalId).emit('action:confirmed', { playerId: null, actionType: 'pick', characterId })
        const roomRow = (await query('SELECT remaining_selections FROM rooms WHERE id=$1', [canonicalId])).rows[0]
        if (roomRow) s.remainingSelections = roomRow.remaining_selections
        broadcastState(io, canonicalId)
        await advanceTurn(io, canonicalId)
        return
      } catch (e) {
        await client.query('ROLLBACK')
        client.release()
        console.error(e)
        io.to(canonicalId).emit('error', { message: 'server_error' })
        return
      }
    }
    // default: advance
    await advanceTurn(io, canonicalId)
  } catch (e) { console.error(e); io.to(canonicalId).emit('error', { message: 'server_error' }) }
}

const PHASE_SEQUENCE = [
  // Phase1 BAN: 全員が1回ずつ投票 → 1フェーズで完了
  { name: 'BAN', steps: [{ team: undefined as 'A'|'B'|undefined, count: 0 }] },
  // Phase2 PICK: A1 B2
  { name: 'PICK1', steps: [{ team: 'A' as 'A'|'B', count: 1 }, { team: 'B' as 'A'|'B', count: 2 }] },
  // Phase3 PICK: A2 B1
  { name: 'PICK2', steps: [{ team: 'A' as 'A'|'B', count: 2 }, { team: 'B' as 'A'|'B', count: 1 }] },
  // Phase4 PICK: A2 B2
  { name: 'PICK3', steps: [{ team: 'A' as 'A'|'B', count: 2 }, { team: 'B' as 'A'|'B', count: 2 }] }
]

// フェーズインデックスから turnTeam を導出するヘルパー
function phaseToTurnTeam(step: PhaseStep): 'A' | 'B' | undefined {
  if (step.type === 'BAN') return undefined
  return step.type === 'PICK_A' ? 'A' : 'B'
}

async function setCurrentPhase(s: RoomState, phaseIndex: number) {
  const seq = s.customPhases
  const step = seq[phaseIndex]
  s.phaseIndex = phaseIndex

  if (step.type === 'BAN') {
    s.phase = 'BAN'
    s.turnTeam = undefined
    s.remainingSelections = s.players.length  // 全員が投票
  } else {
    s.phase = step.type  // 'PICK_A' or 'PICK_B'
    s.turnTeam = phaseToTurnTeam(step)
    s.remainingSelections = step.count
  }
  s.pendingBanVotes = {}

  await query(
    'UPDATE rooms SET phase_index=$1, status=$2, remaining_selections=$3 WHERE id=$4',
    [phaseIndex, s.phase, s.remainingSelections, s.id]
  )
}

async function advanceTurn(io: Server, roomId: string) {
  const s = rooms.get(roomId)
  if (!s) return
  const canonicalId = s.id
  s.pendingBanVotes = {}
  const seq = s.customPhases

  // BAN フェーズ完了 → 次のフェーズへ即遷移
  if (s.phase === 'BAN') {
    const nextIndex = (s.phaseIndex ?? 0) + 1
    if (nextIndex >= seq.length) {
      return finishGame(io, s, canonicalId)
    }
    await setCurrentPhase(s, nextIndex)
    s.remainingTime = 30
    io.to(canonicalId).emit('turn:next', { turnTeam: s.turnTeam, remainingTime: s.remainingTime, remainingSelections: s.remainingSelections })
    startTimer(io, canonicalId)
    broadcastState(io, canonicalId)
    return
  }

  // PICK フェーズ:
  // ※ デクリメントは呼び出し元(requestAction/handleTimeout)で完了済み。
  //   ここでは現在の remainingSelections を見るだけ。

  // まだ残りがあれば同じフェーズ・同じチームを継続
  if ((s.remainingSelections ?? 0) > 0) {
    s.remainingTime = 30
    io.to(canonicalId).emit('turn:next', { turnTeam: s.turnTeam, remainingTime: s.remainingTime, remainingSelections: s.remainingSelections })
    startTimer(io, canonicalId)
    broadcastState(io, canonicalId)
    return
  }

  // 次のフェーズへ
  const nextIndex = (s.phaseIndex ?? 0) + 1
  if (nextIndex >= seq.length) {
    return finishGame(io, s, canonicalId)
  }
  await setCurrentPhase(s, nextIndex)
  s.remainingTime = 30
  io.to(canonicalId).emit('turn:next', { turnTeam: s.turnTeam, remainingTime: s.remainingTime, remainingSelections: s.remainingSelections })
  startTimer(io, canonicalId)
  broadcastState(io, canonicalId)
}

async function finishGame(io: Server, s: RoomState, canonicalId: string) {
  s.phase = 'finished'
  s.turnTeam = undefined
  s.remainingSelections = 0
  clearInterval(s.timer)
  await query('UPDATE rooms SET status=$1 WHERE id=$2', ['finished', canonicalId])
  io.to(canonicalId).emit('phase:finished', {})
  broadcastState(io, canonicalId)
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
      const canonicalId = s.id
      const p = s.players.find(p => p.id === playerId)
      if (!p || !p.isHost) return socket.emit('error', { message: 'not_host' })
      if (s.phase !== 'lobby') return socket.emit('error', { message: 'invalid_phase' })
      // フェーズが1つも設定されていなければデフォルトを使用
      if (!s.customPhases.length) {
        s.customPhases = [...DEFAULT_PHASE_SEQUENCE]
        await query('UPDATE rooms SET custom_phases=$1 WHERE id=$2', [JSON.stringify(s.customPhases), canonicalId])
      }
      await setCurrentPhase(s, 0)
      startTimer(io, canonicalId)
      broadcastState(io, canonicalId)
    })

    socket.on('stopBanPick', async ({ roomId, playerId }: any) => {
      const s = await initRoom(roomId)
      if (!s) return socket.emit('error', { message: 'no_room' })
      const canonicalId = s.id
      const p = s.players.find(p => p.id === playerId)
      if (!p || !p.isHost) return socket.emit('error', { message: 'not_host' })
      s.phase = 'lobby'
      s.phaseIndex = 0
      s.turnTeam = undefined
      s.remainingSelections = 0
      clearInterval(s.timer)
      await query('UPDATE rooms SET status=$1, phase_index=$2, remaining_selections=$3 WHERE id=$4', ['lobby', 0, 0, canonicalId])
      io.to(canonicalId).emit('action:stopped', { by: playerId })
      broadcastState(io, canonicalId)
    })

    socket.on('requestAction', async ({ roomId, playerId, actionType, characterId }: any) => {
      try {
        // ensure we have canonical room state (supports PIN or UUID inputs)
        const s = await initRoom(roomId)
        if (!s) return socket.emit('error', { message: 'no_room' })
        const canonicalId = s.id
        console.debug('[requestAction] canonicalId=', canonicalId, 'incomingRoomId=', roomId, 'characterId=', characterId, 'playerId=', playerId, 'action=', actionType)
        const player = s.players.find(p => p.id === playerId)
        if (!player) return socket.emit('error', { message: 'player_not_found' })

        if (actionType === 'ban') {
          // BANフェーズ: 全プレイヤーが投票権を持つ
          if (s.phase !== 'BAN') return socket.emit('error', { message: 'invalid_phase_for_action' })
          // チーム未所属でも BAN は可能
        }

        if (actionType === 'pick') {
          // PICKフェーズ: チームに所属していて、自分のチームのターンであれば誰でも操作可能
          if (s.phase === 'BAN') return socket.emit('error', { message: 'invalid_phase_for_action' })
          if (!player.team) return socket.emit('error', { message: 'no_team_assigned' })
          // turnTeam が設定されていて、自分のチームと違う場合のみ弾く
          if (s.turnTeam !== undefined && s.turnTeam !== null && player.team !== s.turnTeam) {
            return socket.emit('error', { message: 'not_your_turn' })
          }
        }
        if (actionType === 'ban' && s.phase === 'BAN' && Object.prototype.hasOwnProperty.call(s.pendingBanVotes ?? {}, playerId)) {
          return socket.emit('error', { message: 'already_voted' })
        }
        const client = await getClient()
        try {
          await client.query('BEGIN')

          if (actionType === 'ban' && s.phase === 'BAN') {
            const roomPlayers = s.players
            if (!roomPlayers.length) {
              await client.query('ROLLBACK')
              client.release()
              return socket.emit('error', { message: 'not_your_turn' })
            }

            s.pendingBanVotes ??= {}
            if (Object.prototype.hasOwnProperty.call(s.pendingBanVotes, playerId)) {
              await client.query('ROLLBACK')
              client.release()
              return socket.emit('error', { message: 'already_voted' })
            }

            s.pendingBanVotes[playerId] = characterId

            const voteIds = roomPlayers.map((player) => player.id)
            const votedAll = voteIds.every((id) => Object.prototype.hasOwnProperty.call(s.pendingBanVotes, id))

            if (!votedAll) {
              await client.query('ROLLBACK')
              client.release()
              broadcastState(io, canonicalId)
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
            io.to(canonicalId).emit('action:confirmed', { playerId, actionType, characterId: selectedCharacters })
            const roomRow = (await query('SELECT remaining_selections FROM rooms WHERE id=$1', [canonicalId])).rows[0]
            if (roomRow) s.remainingSelections = roomRow.remaining_selections
            broadcastState(io, canonicalId)
            await advanceTurn(io, canonicalId)
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
            // チームフル制限なし（フェーズ設定で枚数を管理）
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
        io.to(canonicalId).emit('action:confirmed', { playerId, actionType, characterId })
        // refresh remainingSelections from DB
        const roomRow = (await query('SELECT remaining_selections FROM rooms WHERE id=$1', [canonicalId])).rows[0]
        if (roomRow) s.remainingSelections = roomRow.remaining_selections
        broadcastState(io, canonicalId)
        await advanceTurn(io, canonicalId)
      } catch(e) { console.error(e); socket.emit('error', { message: 'server_error' }) }
    })

    // ホストがフェーズ構成を更新するイベント
    socket.on('setPhaseSequence', async ({ roomId, playerId, phases }: any) => {
      try {
        const s = await initRoom(roomId)
        if (!s) return socket.emit('error', { message: 'no_room' })
        const p = s.players.find(p => p.id === playerId)
        if (!p || !p.isHost) return socket.emit('error', { message: 'not_host' })
        if (s.phase !== 'lobby') return socket.emit('error', { message: 'cannot_edit_during_game' })
        // 検証: phases は PhaseStep[] であること
        if (!Array.isArray(phases) || phases.length === 0) return socket.emit('error', { message: 'invalid_phases' })
        for (const ph of phases) {
          if (!['BAN','PICK_A','PICK_B'].includes(ph.type)) return socket.emit('error', { message: 'invalid_phase_type' })
          if (ph.type !== 'BAN' && (typeof ph.count !== 'number' || ph.count < 1)) return socket.emit('error', { message: 'invalid_phase_count' })
        }
        s.customPhases = phases
        await query('UPDATE rooms SET custom_phases=$1 WHERE id=$2', [JSON.stringify(phases), s.id])
        broadcastState(io, s.id)
      } catch(e) { console.error(e); socket.emit('error', { message: 'server_error' }) }
    })

    socket.on('assignTeam', async ({ roomId, playerId, team }: any) => {
      try {
        const s = await initRoom(roomId)
        if (!s) return
        const canonicalId = s.id
        const p = s.players.find(p => p.id === playerId)
        if (!p) return
        p.team = team
        await query('UPDATE players SET team=$1 WHERE id=$2', [team, playerId])
        io.to(canonicalId).emit('room:players', { players: s.players })
        broadcastState(io, canonicalId)
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
