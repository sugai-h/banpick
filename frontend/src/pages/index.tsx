import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Home() {
  const [name,    setName]    = useState('')
  const [roomId,  setRoomId]  = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem('playerName')
    if (saved) setName(saved)
  }, [])

  async function joinOrCreate() {
    if (!name.trim()) return alert('NAME を入力してください')
    setLoading(true)
    try {
      let targetRoomId = roomId.trim()
      if (targetRoomId) {
        const stateRes  = await fetch(`/api/rooms/${encodeURIComponent(targetRoomId)}/state`)
        const stateJson = await stateRes.json()
        if (stateJson.room) {
          const joinRes = await fetch('/api/rooms/join', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: targetRoomId, playerName: name }),
          })
          if (!joinRes.ok) { const e = await joinRes.json(); throw new Error(e?.error || 'join_failed') }
          const { playerId } = await joinRes.json()
          localStorage.setItem('playerName', name)
          localStorage.setItem('playerId',   playerId)
          router.push(`/room/${targetRoomId}`)
          return
        }
      }
      const createRes = await fetch('/api/rooms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: name }),
      })
      if (!createRes.ok) throw new Error('create_failed')
      const { roomId: newRoomId, playerId } = await createRes.json()
      if (!playerId) throw new Error('create_failed_no_player_id')
      localStorage.setItem('playerName', name)
      localStorage.setItem('playerId',   playerId)
      router.push(`/room/${String(newRoomId)}`)
    } catch (e: any) {
      alert(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-hud"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0a1428 0%, #04070f 70%)' }}>
      {/* 背景グリッド */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

      <div className="relative w-full max-w-sm">
        {/* タイトル */}
        <div className="text-center mb-8">
          <div className="text-compass-cyan font-black text-3xl tracking-[0.3em] uppercase mb-1"
            style={{ textShadow: '0 0 20px rgba(0,212,255,0.5)' }}>
            BAN / PICK
          </div>
          <div className="text-compass-textDim text-xs tracking-[0.5em] uppercase">
            Battle Analysis System
          </div>
          <div className="mt-2 h-px w-48 mx-auto"
            style={{ background: 'linear-gradient(90deg, transparent, #00d4ff, transparent)' }} />
        </div>

        {/* フォーム */}
        <div className="hud-panel hud-corner rounded-sm p-5 space-y-3">
          <div>
            <label className="hud-title mb-1">PLAYER NAME</label>
            <input
              className="w-full bg-compass-bg border border-compass-border rounded-sm px-3 py-2 text-sm
                text-compass-text placeholder-compass-textDim focus:outline-none focus:border-compass-cyan
                focus:shadow-cyan-glow transition-all"
              placeholder="名前を入力..."
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinOrCreate()}
            />
          </div>
          <div>
            <label className="hud-title mb-1">ROOM ID <span className="text-compass-textDim normal-case tracking-normal font-normal">（空欄で新規作成）</span></label>
            <input
              className="w-full bg-compass-bg border border-compass-border rounded-sm px-3 py-2 text-sm
                text-compass-text placeholder-compass-textDim focus:outline-none focus:border-compass-gold
                focus:shadow-gold-glow transition-all font-mono tracking-widest"
              placeholder="XXXXX"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinOrCreate()}
              maxLength={10}
            />
          </div>
          <button
            onClick={joinOrCreate}
            disabled={loading || !name.trim()}
            className="btn-cyan w-full py-2.5 text-sm rounded-sm mt-1"
          >
            {loading ? '処理中...' : roomId.trim() ? '▶  JOIN ROOM' : '▶  CREATE ROOM'}
          </button>
        </div>

        {/* 装飾ライン */}
        <div className="mt-4 text-center text-compass-textDim text-[10px] tracking-widest uppercase">
          3 vs 3 Character Selection System
        </div>
      </div>
    </div>
  )
}
