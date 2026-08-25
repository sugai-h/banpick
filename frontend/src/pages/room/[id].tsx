import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { io } from 'socket.io-client'
import { useStore } from '../../store/useStore'
import CharacterGrid from '../../components/CharacterGrid'
import TeamPanel from '../../components/TeamPanel'
import TurnPanel from '../../components/TurnPanel'

export default function RoomPage() {
  const router = useRouter()
  const { id } = router.query
  const socketRef = useRef<any>(null)
  const [socket, setSocket] = useState<any>(null)
  const playerIdRef = useRef<string | null>(null)
  const setRoomState = useStore(s => s.setRoomState)
  const players = useStore(s => s.players)
  const phase = useStore(s => s.phase)
  const currentPlayerId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null
  const currentPlayer = players.find(p=>p.id===currentPlayerId)

  useEffect(() => {
    if (!id) return
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')
    socketRef.current = socket
    setSocket(socket)
    const playerName = localStorage.getItem('playerName') || 'Player'
    const playerId = localStorage.getItem('playerId') || Math.random().toString(36).slice(2)
    localStorage.setItem('playerId', playerId)
    playerIdRef.current = playerId
    socket.emit('joinRoom', { roomId: id, playerId, playerName })
    // store roomId in Zustand
    setRoomState({ roomId: id as string })
    socket.on('room:state', (state:any) => setRoomState(state))
    socket.on('room:players', (p:any) => setRoomState({ players: p.players }))
    socket.on('timer:update', ({ remainingTime }: any) => setRoomState({ remainingTime }))
    socket.on('action:confirmed', (a:any) => {
      // handled by room:state typically
    })
    socket.on('phase:finished', ()=>{
      // navigate to result page
      router.push(`/result/${id}`)
    })
    socket.on('error', (e:any) => {
      console.error('socket error', e)
      alert(e?.message || JSON.stringify(e))
    })
    return () => { socket.disconnect() }
  }, [id, setRoomState])

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

  return (
    <div className="min-h-screen p-4 bg-gray-900 text-white">
      <div className="container mx-auto grid grid-cols-12 gap-4">
        <div className="col-span-3">
                  <div className="bg-gray-800 p-3 rounded mb-3">
                    <h2 className="font-bold">Room</h2>
                    <div>Room ID: {id}</div>
                    <div>Players: {players.length}/6</div>
                    <div className="mt-2 text-sm">
                      {currentPlayer?.isHost ? <span className="text-green-300 font-semibold">あなたはホストです</span> : <span className="text-gray-400">ホスト権限なし</span>}
                    </div>
                    {phase === 'lobby' ? (
                      <button onClick={startBanPick} disabled={!currentPlayer?.isHost} className="mt-2 py-1 px-2 bg-indigo-600 rounded disabled:opacity-50">BAN/PICK開始（ホスト）</button>
                    ) : (
                      <button onClick={stopBanPick} disabled={!currentPlayer?.isHost} className="mt-2 py-1 px-2 bg-red-600 rounded disabled:opacity-50">中止</button>
                    )}
                  </div>
        </div>
        <div className="col-span-6">
          <CharacterGrid socket={socket} />
        </div>
        <div className="col-span-3">
          <TurnPanel />
          <TeamPanel team="A" socket={socket} />
          <TeamPanel team="B" socket={socket} />
        </div>
      </div>
    </div>
  )
}
