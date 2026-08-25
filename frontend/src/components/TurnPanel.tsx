import { useStore, TEAM_LABELS, PHASE_LABELS, PHASE_COLORS } from '../store/useStore'
import { motion } from 'framer-motion'

export default function TurnPanel(){
  const phase = useStore(s=>s.phase)
  const turnTeam = useStore(s=>s.turnTeam)
  const remainingTime = useStore(s=>s.remainingTime)
  const players = useStore(s=>s.players)
  const phaseIndex = useStore(s=>s.phaseIndex) ?? 0
  const customPhases = useStore(s=>s.customPhases)
  const remainingSelections = useStore(s=>s.remainingSelections) ?? 0
  const turnPlayers = turnTeam ? players.filter(p=>p.team===turnTeam) : []
  const percent = Math.max(0, Math.min(100, Math.round((remainingTime/30)*100)))

  // 現在フェーズの総枚数と進捗
  const currentPhase = customPhases[phaseIndex]
  const totalCount = currentPhase?.type !== 'BAN' ? (currentPhase?.count ?? 0) : 0
  const doneCount = totalCount - remainingSelections
  const pickProgress = totalCount > 0 ? `${doneCount + 1}/${totalCount}` : ''

  const turnLabel =
    phase === 'BAN'   ? '全員選択' :
    phase === 'PICK_A' ? TEAM_LABELS['A'] :
    phase === 'PICK_B' ? TEAM_LABELS['B'] : '—'

  const barColor =
    phase === 'BAN'    ? 'bg-red-500' :
    phase === 'PICK_A' ? 'bg-blue-500' :
    phase === 'PICK_B' ? 'bg-rose-500' : 'bg-indigo-500'

  return (
    <div className="bg-gray-800 p-3 rounded mb-3">
      <div className="text-sm text-gray-400">Phase: {phase}</div>
      <div className="text-lg font-bold">
        Turn: {turnLabel}
        {pickProgress && (
          <span className="ml-2 text-base font-mono text-indigo-300">{pickProgress}</span>
        )}
      </div>
      {phase === 'BAN' ? (
        <div className="text-sm text-gray-300">
          全員: {players.length ? players.map(p=>p.name+(p.isHost?' (Host)':'')).join(', ') : '—'}
        </div>
      ) : turnTeam && (
        <div className="text-sm text-gray-300">
          {turnPlayers.length ? turnPlayers.map(p=>p.name+(p.isHost?' (Host)':'')).join(', ') : '—'}
        </div>
      )}
      <div className="text-sm">残り時間: {remainingTime}s</div>
      <div className="w-full bg-gray-700 h-2 rounded mt-2 overflow-hidden">
        <motion.div
          className={`h-2 ${barColor}`}
          style={{ width: `${percent}%` }}
          transition={{ ease: 'linear', duration: 0.5 }}
        />
      </div>

      {/* フェーズ進行ミニマップ */}
      {customPhases.length > 0 && phase !== 'lobby' && (
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1">進行状況</div>
          <div className="flex flex-wrap gap-1">
            {customPhases.map((ph, i) => {
              const isCurrent = i === phaseIndex
              const isDone = i < phaseIndex
              return (
                <div
                  key={i}
                  className={`px-1.5 py-0.5 rounded text-xs font-bold border transition-all ${
                    isCurrent
                      ? `${PHASE_COLORS[ph.type]} scale-110 shadow-md`
                      : isDone
                        ? 'bg-gray-700 border-gray-600 text-gray-500 line-through'
                        : 'bg-gray-900 border-gray-700 text-gray-400'
                  }`}
                >
                  {PHASE_LABELS[ph.type]}{ph.type !== 'BAN' ? `×${ph.count}` : ''}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
