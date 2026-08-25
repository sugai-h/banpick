import { useStore } from '../store/useStore'

export default function TeamPanel({ team, socket }: { team: 'A'|'B', socket?: any }){
  const players = useStore(s => s.players.filter(p=>p.team===team))
  const currentPlayerId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null
  const phase = useStore(s => s.phase)

  function changeTeam() {
    if (phase !== 'lobby') return alert('フェーズ開始後はチーム変更できません')
    if (!socket) return alert('Socket not connected')
    const pid = currentPlayerId
    if (!pid) return alert('playerId not found')
    socket.emit('assignTeam', { roomId: useStore.getState().roomId, playerId: pid, team })
  }

  return (
    <div className="bg-gray-800 p-3 rounded mt-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">Team {team}</h3>
        <button className="text-xs text-indigo-300 underline" onClick={changeTeam} disabled={phase!=='lobby'}>チームを変更</button>
      </div>
      <ul>
        {players.map(p=> <li key={p.id} className="py-1">{p.name} {p.isHost? '(Host)':''}</li>)}
      </ul>
    </div>
  )
}
