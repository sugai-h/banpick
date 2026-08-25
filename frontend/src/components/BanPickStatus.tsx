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

  function charName(id: number) {
    return characters.find(c => c.id === id)?.name ?? `#${id}`
  }
  function charRole(id: number) {
    return characters.find(c => c.id === id)?.role ?? ''
  }
  function playerName(playerId: string | undefined) {
    if (!playerId) return ''
    return players.find(p => p.id === playerId)?.name ?? ''
  }

  const banned = charStates.filter(c => c.state === 'banned')
  const pickedA = charStates.filter(c => c.state === 'picked' && c.pickedTeam === 'A')
  const pickedB = charStates.filter(c => c.state === 'picked' && c.pickedTeam === 'B')

  if (banned.length === 0 && pickedA.length === 0 && pickedB.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      {/* BAN済み */}
      {banned.length > 0 && (
        <div className="bg-gray-800 rounded p-2">
          <div className="text-xs font-bold text-red-400 mb-1.5 uppercase tracking-wide">
            BAN済み ({banned.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AnimatePresence>
              {banned.map(c => (
                <motion.div
                  key={c.characterId}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-red-900/60 border border-red-700 text-xs"
                >
                  <span className="w-5 h-5 rounded bg-red-800 flex items-center justify-center font-bold text-red-200 text-[10px] shrink-0">
                    {charName(c.characterId)[0]}
                  </span>
                  <span className="text-red-100 font-semibold">{charName(c.characterId)}</span>
                  {charRole(c.characterId) && (
                    <span className="text-red-400 hidden sm:inline">{charRole(c.characterId)}</span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* PICK済み（蒼・紅 横並び） */}
      {(pickedA.length > 0 || pickedB.length > 0) && (
        <div className="grid grid-cols-2 gap-2">
          {/* 蒼チーム PICK */}
          <div className="bg-gray-800 rounded p-2">
            <div className="text-xs font-bold text-blue-400 mb-1.5 uppercase tracking-wide">
              蒼PICK ({pickedA.length})
            </div>
            <div className="space-y-1">
              <AnimatePresence>
                {pickedA.map(c => (
                  <motion.div
                    key={c.characterId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-900/50 border border-blue-700 text-xs"
                  >
                    <span className="w-5 h-5 rounded bg-blue-800 flex items-center justify-center font-bold text-blue-200 text-[10px] shrink-0">
                      {charName(c.characterId)[0]}
                    </span>
                    <div className="min-w-0">
                      <div className="text-blue-100 font-semibold truncate">{charName(c.characterId)}</div>
                      {playerName(c.pickedBy) && (
                        <div className="text-blue-400 text-[10px] truncate">{playerName(c.pickedBy)}</div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* 紅チーム PICK */}
          <div className="bg-gray-800 rounded p-2">
            <div className="text-xs font-bold text-rose-400 mb-1.5 uppercase tracking-wide">
              紅PICK ({pickedB.length})
            </div>
            <div className="space-y-1">
              <AnimatePresence>
                {pickedB.map(c => (
                  <motion.div
                    key={c.characterId}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-rose-900/50 border border-rose-700 text-xs"
                  >
                    <span className="w-5 h-5 rounded bg-rose-800 flex items-center justify-center font-bold text-rose-200 text-[10px] shrink-0">
                      {charName(c.characterId)[0]}
                    </span>
                    <div className="min-w-0">
                      <div className="text-rose-100 font-semibold truncate">{charName(c.characterId)}</div>
                      {playerName(c.pickedBy) && (
                        <div className="text-rose-400 text-[10px] truncate">{playerName(c.pickedBy)}</div>
                      )}
                    </div>
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
