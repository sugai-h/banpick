import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { io } from 'socket.io-client'
import { useStore } from '../../store/useStore'
import CharacterGrid from '../../components/CharacterGrid'
import TeamPanel from '../../components/TeamPanel'
import TurnPanel from '../../components/TurnPanel'
import PhaseEditor from '../../components/PhaseEditor'
import BanPickStatus from '../../components/BanPickStatus'

function getSocketBackendUrl() {
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_API_URL
    if (envUrl) return envUrl
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:4000'
    return window.location.origin
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
}

async function ensurePlayerForRoom(roomId: string, playerName: string) {
  const existingPlayerId = localStorage.getItem('playerId')
  if (existingPlayerId) return existingPlayerId
  const res = await fetch('/api/rooms/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, playerName }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || 'join_failed') }
  const { playerId } = await res.json()
  if (!playerId) throw new Error('join_failed_no_player_id')
  localStorage.setItem('playerId', playerId)
  return playerId
}

export default function RoomPage() {
  const router    = useRouter()
  const { id }    = router.query
  const socketRef = useRef<any>(null)
  const [socket, setSocket]               = useState<any>(null)
  const [socketConnected, setConnected]   = useState(false)
  const playerIdRef = useRef<string | null>(null)
  const setRoomState = useStore(s => s.setRoomState)
  const players      = useStore(s => s.players)
  const phase        = useStore(s => s.phase)
  const currentPlayerId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null
  const currentPlayer   = players.find(p => p.id === currentPlayerId)

  useEffect(() => {
    if (!id) return
    const resolvedRoomId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : ''
    const playerName     = localStorage.getItem('playerName') || 'Player'
    let isMounted = true

    const sock = io(getSocketBackendUrl(), {
      reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000,
      transports: ['websocket', 'polling'], timeout: 20000, forceNew: true,
    })
    socketRef.current = sock
    setSocket(sock)
    setConnected(sock.connected)

    const handleConnect = async () => {
      try {
        const playerId = await ensurePlayerForRoom(resolvedRoomId, playerName)
        if (!isMounted) return
        playerIdRef.current = playerId
        localStorage.setItem('playerId', playerId)
        setConnected(true)
        sock.emit('joinRoom', { roomId: resolvedRoomId, playerId, playerName })
      } catch (e: any) { alert(e?.message || 'room_join_failed') }
    }

    sock.on('connect',       handleConnect)
    sock.on('disconnect',    () => { setConnected(false) })
    sock.on('connect_error', () => { setConnected(false) })
    setRoomState({ roomId: id as string })
    sock.on('room:state',  (s: any)  => setRoomState(s))
    sock.on('room:players', (p: any) => setRoomState({ players: p.players }))
    sock.on('timer:update', ({ remainingTime }: any) => setRoomState({ remainingTime }))
    sock.on('phase:finished', () => router.push(`/result/${id}`))
    sock.on('error', (e: any) => { console.error('socket error', e); alert(e?.message || JSON.stringify(e)) })
    if (sock.connected) void handleConnect()

    return () => { isMounted = false; sock.off('connect', handleConnect); sock.disconnect() }
  }, [id, router, setRoomState])

  const startBanPick = () => {
    const pid = playerIdRef.current
    if (!socketRef.current || !pid) return
    socketRef.current.emit('startBanPick', { roomId: id, playerId: pid })
  }
  const stopBanPick = () => {
    const pid = playerIdRef.current
    if (!socketRef.current || !pid) return
    socketRef.current.emit('stopBanPick', { roomId: id, playerId: pid })
  }

  const teamLabel = currentPlayer?.team === 'A' ? '蒼' : currentPlayer?.team === 'B' ? '紅' : '—'

  return (
    <div className="min-h-screen bg-compass-bg text-compass-text font-hud" style={{ background: '#04070f' }}>
      {/* ── ヘッダー ── */}
      <div className="border-b border-compass-border px-4 py-2 flex items-center gap-4"
        style={{ background: 'linear-gradient(90deg, #060a14, #080e1c)' }}>
        <div>
          <div className="text-compass-cyan font-black text-sm tracking-widest uppercase">
            ◈ BATTLE ANALYSIS SYSTEM
          </div>
          <div className="text-compass-textDim text-xs tracking-wider">
            ROOM <span className="text-compass-gold font-bold">{id}</span>
            <span className="ml-3">PLAYERS <span className="text-compass-cyan font-bold">{players.length}</span></span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* 接続状態 */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: socketConnected ? '#00d4ff' : '#e02020',
                       boxShadow: socketConnected ? '0 0 6px #00d4ff' : '0 0 6px #e02020' }} />
            <span className={socketConnected ? 'text-compass-cyan' : 'text-red-400'}>
              {socketConnected ? 'CONNECTED' : 'OFFLINE'}
            </span>
          </div>
          {/* 自分の情報 */}
          <div className="text-xs text-compass-textDim">
            TEAM <span className="font-bold" style={{ color: teamLabel === '蒼' ? '#1a6fe0' : teamLabel === '紅' ? '#e0204a' : '#c8a84b' }}>{teamLabel}</span>
            {currentPlayer?.isHost && (
              <span className="ml-2 text-compass-gold border border-compass-goldDim px-1 rounded-sm text-[10px] font-bold">HOST</span>
            )}
          </div>
          {/* 開始/中止ボタン */}
          {phase === 'lobby' ? (
            <button onClick={startBanPick} disabled={!currentPlayer?.isHost}
              className="btn-cyan px-3 py-1 text-xs rounded-sm">
              ▶ START
            </button>
          ) : (
            <button onClick={stopBanPick} disabled={!currentPlayer?.isHost}
              className="btn-danger px-3 py-1 text-xs rounded-sm">
              ■ STOP
            </button>
          )}
        </div>
      </div>

      {/* ── メインコンテンツ ── */}
      <div className="container mx-auto grid grid-cols-12 gap-3 p-3">
        {/* 左カラム: ルーム情報 + フェーズ設定 */}
        <div className="col-span-3">
          <div className="hud-panel hud-corner rounded-sm p-3 mb-3">
            <div className="hud-title mb-3">ROOM STATUS</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-compass-textDim">ROOM ID</span>
                <span className="text-compass-gold font-bold tracking-wider">{id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-compass-textDim">PHASE</span>
                <span className="text-compass-cyan font-bold">{phase.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-compass-textDim">PLAYERS</span>
                <span className="text-compass-text font-bold">{players.length} / 6</span>
              </div>
              <div className="flex justify-between">
                <span className="text-compass-textDim">MY NAME</span>
                <span className="text-compass-text font-bold truncate max-w-[100px]">{currentPlayer?.name ?? '—'}</span>
              </div>
            </div>
          </div>

          {phase === 'lobby' && (
            <PhaseEditor socket={socket} isHost={!!currentPlayer?.isHost} />
          )}
        </div>

        {/* 中央: キャラグリッド + BAN/PICK状況 */}
        <div className="col-span-6">
          <CharacterGrid socket={socket} />
          <BanPickStatus />
        </div>

        {/* 右カラム: ターン + チーム */}
        <div className="col-span-3">
          <TurnPanel />
          <TeamPanel team="A" socket={socket} />
          <TeamPanel team="B" socket={socket} />
        </div>
      </div>
    </div>
  )
}
