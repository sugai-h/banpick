import { useStore, TEAM_LABELS } from '../store/useStore'
import { motion } from 'framer-motion'

export default function TurnPanel(){
  const phase = useStore(s=>s.phase)
  const turnTeam = useStore(s=>s.turnTeam)
  const remainingTime = useStore(s=>s.remainingTime)
  const players = useStore(s=>s.players)
  const turnPlayers = turnTeam ? players.filter(p=>p.team===turnTeam) : []
  const percent = Math.max(0, Math.min(100, Math.round((remainingTime/30)*100)))
  const turnLabel = phase && phase.startsWith('BAN') ? '全員選択' : (turnTeam ? TEAM_LABELS[turnTeam] : '—')
  return (
    <div className="bg-gray-800 p-3 rounded">
      <div className="text-sm">Phase: {phase}</div>
      <div className="text-lg font-bold">Turn: {turnLabel}</div>
      {phase && phase.startsWith('BAN') ? (
        <div className="text-sm text-gray-300">Players: {players.length ? players.map(p=>p.name + (p.isHost? ' (Host)':'')).join(', ') : '—'}</div>
      ) : turnTeam && (
        <div className="text-sm text-gray-300">Players: {turnPlayers.length ? turnPlayers.map(p=>p.name + (p.isHost? ' (Host)':'')).join(', ') : '—'}</div>
      )}
      <div className="text-sm">残り時間: {remainingTime}s</div>
      <div className="w-full bg-gray-700 h-2 rounded mt-2 overflow-hidden">
        <motion.div className={`h-2 bg-indigo-500`} style={{ width: `${percent}%` }} transition={{ ease: 'linear', duration: 0.5 }} />
      </div>
    </div>
  )
}
