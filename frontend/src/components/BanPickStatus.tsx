import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { motion, AnimatePresence } from 'framer-motion'

export default function BanPickStatus() {
  const charStates = useStore(s => s.charStates)
  const players    = useStore(s => s.players)
  const [characters, setCharacters] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/characters').then(r => r.json()).then(j => setCharacters(j.characters ?? []))
  }, [])

  const charName   = (id: number) => characters.find(c => c.id === id)?.name  ?? `#${id}`
  const charRole   = (id: number) => characters.find(c => c.id === id)?.role  ?? ''
  const playerName = (pid?: string) => pid ? (players.find(p => p.id === pid)?.name ?? '') : ''

  const banned  = charStates.filter(c => c.state === 'banned')
  const pickedA = charStates.filter(c => c.state === 'picked' && c.pickedTeam === 'A')
  const pickedB = charStates.filter(c => c.state === 'picked' && c.pickedTeam === 'B')

  if (banned.length === 0 && pickedA.length === 0 && pickedB.length === 0) return null

  const Chip = ({ name, sub, color }: { name: string; sub?: string; color: string }) => (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-sm border text-xs hud-panel`}
      style={{ borderColor: color + '60' }}>
      <span className="w-5 h-5 rounded-sm flex items-center justify-center font-black text-[10px] shrink-0"
        style={{ backgroundColor: color + '30', color }}>
        {name[0]}
      </span>
      <div className="min-w-0">
        <div className="font-bold truncate" style={{ color: '#c0d8f0' }}>{name}</div>
        {sub && <div className="text-[9px] truncate" style={{ color }}>{sub}</div>}
      </div>
    </div>
  )

  return (
    <div className="mt-3 space-y-2">
      {/* BAN済み */}
      {banned.length > 0 && (
        <div className="hud-panel rounded-sm p-2">
          <div className="hud-title mb-1.5" style={{ color: '#e02020' }}>
            BANNED ({banned.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AnimatePresence>
              {banned.map(c => (
                <motion.div key={c.characterId}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                  <Chip name={charName(c.characterId)} sub={charRole(c.characterId) || undefined} color="#e02020" />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* PICK済み */}
      {(pickedA.length > 0 || pickedB.length > 0) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="hud-panel rounded-sm p-2">
            <div className="hud-title mb-1.5" style={{ color: '#1a6fe0' }}>
              蒼 PICK ({pickedA.length})
            </div>
            <div className="space-y-1">
              <AnimatePresence>
                {pickedA.map(c => (
                  <motion.div key={c.characterId}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}>
                    <Chip name={charName(c.characterId)} sub={playerName(c.pickedBy) || undefined} color="#1a6fe0" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="hud-panel rounded-sm p-2">
            <div className="hud-title mb-1.5" style={{ color: '#e0204a' }}>
              紅 PICK ({pickedB.length})
            </div>
            <div className="space-y-1">
              <AnimatePresence>
                {pickedB.map(c => (
                  <motion.div key={c.characterId}
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}>
                    <Chip name={charName(c.characterId)} sub={playerName(c.pickedBy) || undefined} color="#e0204a" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
