import { useStore, TEAM_LABELS } from '../store/useStore'

export default function TeamPanel({ team, socket }: { team: 'A'|'B', socket?: any }){
  const players = useStore(s => s.players.filter(p=>p.team===team))
  const currentPlayerId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null
  const currentPlayer = useStore(s => s.players.find(p => p.id === currentPlayerId))
  const phase = useStore(s => s.phase)
  const isMyTeam = currentPlayer?.team === team
  const isFull = players.length >= 3
  const label = TEAM_LABELS[team]

  function changeTeam() {
    if (phase !== 'lobby') return alert('フェーズ開始後はチーム変更できません')
    if (!socket) return alert('Socket not connected')
    const pid = currentPlayerId
    if (!pid) return alert('playerId not found')
    if (isFull && !isMyTeam) return alert(`${label}チームは定員(3人)に達しています`)
    socket.emit('assignTeam', { roomId: useStore.getState().roomId, playerId: pid, team })
  }

  return (
    <div className={`bg-gray-800 p-3 rounded mt-3 border ${isMyTeam ? 'border-indigo-400' : 'border-transparent'}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-bold">{label}チーム ({players.length}/3)</h3>
        <button
          className="text-xs text-indigo-300 underline disabled:text-gray-500 disabled:no-underline"
          onClick={changeTeam}
          disabled={phase!=='lobby' || isMyTeam || (isFull && !isMyTeam)}
        >
          {isMyTeam ? '所属中' : `${label}に移動`}
        </button>
      </div>
      <ul>
        {players.map(p=> <li key={p.id} className="py-1">{p.name} {p.isHost? '(Host)':''}</li>)}
      </ul>
    </div>
  )
}
