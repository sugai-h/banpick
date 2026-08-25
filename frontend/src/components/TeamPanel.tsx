import { useStore, TEAM_LABELS } from '../store/useStore'

export default function TeamPanel({ team, socket }: { team: 'A'|'B', socket?: any }) {
  const players       = useStore(s => s.players.filter(p => p.team === team))
  const currentPlayerId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null
  const currentPlayer = useStore(s => s.players.find(p => p.id === currentPlayerId))
  const phase         = useStore(s => s.phase)
  const isMyTeam      = currentPlayer?.team === team
  const isFull        = players.length >= 3
  const label         = TEAM_LABELS[team]
  const isBlue        = team === 'A'

  function changeTeam() {
    if (phase !== 'lobby') return alert('フェーズ開始後はチーム変更できません')
    if (!socket) return alert('Socket not connected')
    if (!currentPlayerId) return alert('playerId not found')
    if (isFull && !isMyTeam) return alert(`${label}チームは定員(3人)に達しています`)
    socket.emit('assignTeam', { roomId: useStore.getState().roomId, playerId: currentPlayerId, team })
  }

  const borderColor = isBlue ? 'border-blue-500/60' : 'border-rose-500/60'
  const accentColor = isBlue ? '#1a6fe0'             : '#e0204a'
  const titleColor  = isBlue ? 'text-blue-400'       : 'text-rose-400'

  return (
    <div className={`hud-panel rounded-sm p-3 mt-3 border ${isMyTeam ? borderColor : 'border-compass-border'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="hud-title" style={{ color: accentColor }}>
          {label} TEAM
        </div>
        <span className={`text-xs font-bold ${titleColor}`}>{players.length} / 3</span>
      </div>

      {/* プレイヤー一覧 */}
      <ul className="space-y-1 mb-2">
        {players.map(p => (
          <li key={p.id} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-compass-text font-semibold">{p.name}</span>
            {p.isHost && (
              <span className="text-compass-gold text-[9px] font-bold tracking-wider border border-compass-goldDim px-1 rounded-sm">HOST</span>
            )}
          </li>
        ))}
        {players.length === 0 && (
          <li className="text-compass-textDim text-xs">— EMPTY —</li>
        )}
      </ul>

      {/* 参加ボタン */}
      {phase === 'lobby' && !isMyTeam && (
        <button
          onClick={changeTeam}
          disabled={isFull}
          className={`w-full py-1 text-xs font-bold tracking-widest uppercase rounded-sm transition-all border ${
            isBlue
              ? 'border-blue-500 text-blue-300 hover:bg-blue-900/40 hover:shadow-blue-glow disabled:opacity-30'
              : 'border-rose-500 text-rose-300 hover:bg-rose-900/40 hover:shadow-red-glow  disabled:opacity-30'
          }`}
        >
          {isFull ? 'FULL' : `JOIN ${label}`}
        </button>
      )}
      {isMyTeam && (
        <div className="text-center text-[10px] tracking-widest uppercase" style={{ color: accentColor }}>
          ◆ YOUR TEAM ◆
        </div>
      )}
    </div>
  )
}
