import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Home() {
  const [name, setName] = useState('')
  const [roomId, setRoomId] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(()=>{
    const saved = localStorage.getItem('playerName')
    if (saved) setName(saved)
  }, [])

  async function joinOrCreate() {
    if (!name.trim()) return alert('名前を入力してください')
    setLoading(true)
    try {
      // If roomId provided, check if it exists via state endpoint
      let targetRoomId = roomId.trim()
      if (targetRoomId) {
        const stateRes = await fetch(`/api/rooms/${encodeURIComponent(targetRoomId)}/state`)
        const stateJson = await stateRes.json()
        if (stateJson.room) {
          // room exists -> join
            const joinRes = await fetch('/api/rooms/join', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ roomId: targetRoomId, playerName: name }) })
          if (!joinRes.ok) {
            const err = await joinRes.json()
            throw new Error(err?.error || 'join_failed')
          }
          const { playerId } = await joinRes.json()
          localStorage.setItem('playerName', name)
          localStorage.setItem('playerId', playerId)
          router.push(`/room/${targetRoomId}`)
          return
        }
        // otherwise fallthrough to create
      }

      // create room (host player record with is_host=true, team already set server-side)
      const createRes = await fetch('/api/rooms', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ hostName: name }) })
      if (!createRes.ok) throw new Error('create_failed')
      const { roomId: newRoomId, playerId: creatorPlayerId } = await createRes.json()
      if (!creatorPlayerId) throw new Error('create_failed_no_player_id')
      // use the host playerId directly - no second /join call needed, avoids
      // accidentally overwriting/losing the host flag and team assignment
      localStorage.setItem('playerName', name)
      localStorage.setItem('playerId', creatorPlayerId)
      router.push(`/room/${String(newRoomId)}`)
    } catch (err:any) {
      alert(err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="w-full max-w-md p-6 bg-gray-900/60 rounded-lg">
        <h1 className="text-2xl mb-4">BAN/PICK 3v3</h1>
        <input className="w-full p-2 mb-2 bg-gray-800 rounded" placeholder="あなたの名前 (必須)" value={name} onChange={e=>setName(e.target.value)} />
          {/* PIN は廃止: Room ID のみで作成/参加します */}
        <input className="w-full p-2 mb-2 bg-gray-800 rounded" placeholder="Room ID (空なら新規作成)" value={roomId} onChange={e=>setRoomId(e.target.value)} />
        <button disabled={loading} className="w-full py-2 mb-2 bg-indigo-600 rounded disabled:opacity-50" onClick={joinOrCreate}>{loading? '処理中...' : '参加／作成して参加'}</button>
        <div className="text-xs text-gray-400">名前は必須です。Room ID を入力すると既存ルームに参加、未入力または存在しない ID は新規作成します。</div>
      </div>
    </div>
  )
}
