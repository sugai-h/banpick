import { useStore, TEAM_LABELS, PHASE_LABELS, PHASE_COLORS } from '../store/useStore'
import { motion } from 'framer-motion'

export default function TurnPanel() {
  const phase      = useStore(s => s.phase)
  const turnTeam   = useStore(s => s.turnTeam)
  const remaining  = useStore(s => s.remainingTime)
  const players    = useStore(s => s.players)
  const phaseIndex = useStore(s => s.phaseIndex) ?? 0
  const customPhases = useStore(s => s.customPhases)
  const remainingSelections = useStore(s => s.remainingSelections) ?? 0

  const percent = Math.max(0, Math.min(100, Math.round((remaining / 30) * 100)))
  const turnPlayers = turnTeam ? players.filter(p => p.team === turnTeam) : players

  const currentPhase = customPhases[phaseIndex]
  const totalCount   = currentPhase?.type !== 'BAN' ? (currentPhase?.count ?? 0) : 0
  const doneCount    = Math.max(0, totalCount - remainingSelections)
  const pickProgress = totalCount > 0 ? `${doneCount + 1} / ${totalCount}` : ''

  const turnLabel =
    phase === 'BAN'    ? '全員' :
    phase === 'PICK_A' ? TEAM_LABELS['A'] :
    phase === 'PICK_B' ? TEAM_LABELS['B'] : '—'

  const accentColor =
    phase === 'BAN'    ? '#e02020' :
    phase === 'PICK_A' ? '#1a6fe0' :
    phase === 'PICK_B' ? '#e0204a' : '#00d4ff'

  const isUrgent = remaining <= 10 && remaining > 0

  return (
    <div className="hud-panel hud-corner rounded-sm p-3 mb-3">
      <div className="hud-title mb-2">COMBAT ANALYSIS</div>

      {/* フェーズ表示 */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-compass-textDim text-xs tracking-widest uppercase">Phase</span>
        <span className="font-black text-base tracking-wider" style={{ color: accentColor }}>{phase}</span>
        {pickProgress && (
          <span className="ml-auto font-mono text-sm font-bold text-compass-gold">{pickProgress}</span>
        )}
      </div>

      {/* ターン表示 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-compass-textDim text-xs tracking-widest uppercase">Turn</span>
        <span className="font-black text-2xl tracking-wide" style={{ color: accentColor }}>
          {turnLabel}
        </span>
      </div>

      {/* プレイヤー一覧 */}
      <div className="text-xs text-compass-textDim mb-2 truncate">
        {turnPlayers.map(p => p.name).join(' / ') || '—'}
      </div>

      {/* タイマー */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-compass-textDim text-xs uppercase tracking-wider">Time</span>
        <motion.span
          className="font-mono font-black text-lg"
          animate={{ color: isUrgent ? ['#e02020', '#ff6060'] : accentColor }}
          transition={{ repeat: isUrgent ? Infinity : 0, duration: 0.5, repeatType: 'reverse' }}
        >
          {String(remaining).padStart(2, '0')}
        </motion.span>
      </div>
      <div className="w-full bg-compass-border h-1 rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-1 rounded-full"
          style={{
            width: `${percent}%`,
            background: `linear-gradient(90deg, ${accentColor}88, ${accentColor})`,
            boxShadow: `0 0 6px ${accentColor}88`,
          }}
          transition={{ ease: 'linear', duration: 0.5 }}
        />
      </div>

      {/* フェーズミニマップ */}
      {customPhases.length > 0 && phase !== 'lobby' && (
        <div>
          <div className="hud-title mb-1.5">SEQUENCE</div>
          <div className="flex flex-wrap gap-1">
            {customPhases.map((ph, i) => {
              const isCurrent = i === phaseIndex
              const isDone    = i < phaseIndex
              return (
                <div
                  key={i}
                  className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold border transition-all ${
                    isCurrent
                      ? `${PHASE_COLORS[ph.type]} scale-110 shadow-md`
                      : isDone
                        ? 'bg-compass-panel border-compass-border text-compass-textDim line-through'
                        : 'bg-compass-bg border-compass-border text-compass-textDim'
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
