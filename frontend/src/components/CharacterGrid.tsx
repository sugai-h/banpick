import { useEffect, useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import ConfirmDialog from './ConfirmDialog'
import { motion, AnimatePresence } from 'framer-motion'
import { roleBadgeClass, ROLE_LIST } from '../utils/roleStyle'

export default function CharacterGrid({ socket }: any) {
  const [characters, setCharacters] = useState<any[]>([])
  const charStates  = useStore(s => s.charStates)
  const turnTeam    = useStore(s => s.turnTeam)
  const players     = useStore(s => s.players)
  const [confirm, setConfirm] = useState<{ open: boolean; char?: any; action?: 'ban'|'pick' }>({ open: false })
  const [roleFilter, setRoleFilter] = useState('すべて')
  const [sortAlpha,  setSortAlpha]  = useState(false)

  useEffect(() => {
    fetch('/api/characters').then(r => r.json()).then(j => setCharacters(j.characters ?? []))
  }, [])

  const currentPlayerId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null
  const currentPlayer   = players.find(p => p.id === currentPlayerId)

  // ロール一覧（DBから動的に収集）
  const roles = useMemo(() => {
    const set = new Set<string>(characters.map(c => c.role).filter(Boolean))
    return ['すべて', ...Array.from(set).sort()]
  }, [characters])

  // フィルタ＋ソート
  const filtered = useMemo(() => {
    let list = roleFilter === 'すべて' ? characters : characters.filter(c => c.role === roleFilter)
    if (sortAlpha) list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    return list
  }, [characters, roleFilter, sortAlpha])

  function onClickChar(c: any) {
    const cs    = charStates.find(s => s.characterId === c.id)
    if (cs?.state !== 'available' && cs?.state !== undefined) return
    if (!cs && charStates.length > 0) return  // not seeded yet
    const phase  = useStore.getState().phase
    if (phase === 'lobby' || phase === 'finished') return
    const action: 'ban'|'pick' = phase === 'BAN' ? 'ban' : 'pick'
    if (action === 'pick') {
      if (!currentPlayer?.team) return
      if (turnTeam !== undefined && turnTeam !== null && currentPlayer.team !== turnTeam) return
    }
    setConfirm({ open: true, char: c, action })
  }

  function confirmAction() {
    if (!confirm.char || !confirm.action) return setConfirm({ open: false })
    if (!socket?.emit)     { alert('Socket not connected'); setConfirm({ open: false }); return }
    if (!currentPlayerId)  { alert('playerId not found');   setConfirm({ open: false }); return }
    if (confirm.action === 'pick' && !currentPlayer?.team) { alert('チームが割り当てられていません'); setConfirm({ open: false }); return }
    socket.emit('requestAction', {
      roomId: useStore.getState().roomId,
      playerId: currentPlayerId,
      actionType: confirm.action,
      characterId: confirm.char.id,
    })
    setConfirm({ open: false })
  }

  return (
    <>
      {/* ─ フィルターバー ─ */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="hud-title mr-1">FILTER</div>
        {roles.map(r => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`px-2 py-0.5 text-xs font-bold tracking-wide transition-all rounded-sm border ${
              roleFilter === r
                ? 'border-compass-cyan text-compass-cyan bg-compass-cyan/10 shadow-cyan-glow'
                : 'border-compass-border text-compass-textDim hover:border-compass-cyanDim hover:text-compass-text'
            }`}
          >
            {r}
          </button>
        ))}
        <button
          onClick={() => setSortAlpha(v => !v)}
          className={`ml-auto px-2 py-0.5 text-xs font-bold tracking-wide transition-all rounded-sm border ${
            sortAlpha
              ? 'border-compass-gold text-compass-gold bg-compass-gold/10'
              : 'border-compass-border text-compass-textDim hover:border-compass-goldDim hover:text-compass-text'
          }`}
        >
          あ→ん
        </button>
      </div>

      {/* ─ キャラグリッド ─ */}
      <div className="h-[62vh] overflow-auto pr-1">
        <div className="grid grid-cols-4 gap-2">
          <AnimatePresence>
            {filtered.map(c => {
              const cs       = charStates.find(s => s.characterId === c.id)
              const state    = cs?.state ?? 'available'
              const phase    = useStore.getState().phase
              const isBan    = phase === 'BAN'
              const isPick   = phase === 'PICK_A' || phase === 'PICK_B'
              const disabled = state !== 'available'
                || phase === 'lobby'
                || phase === 'finished'
                || (!isBan && !isPick)
                || (isPick && (!currentPlayer?.team || (turnTeam != null && currentPlayer.team !== turnTeam)))

              const isBanned  = state === 'banned'
              const isPicked  = state === 'picked'
              const pickedTeam = cs?.pickedTeam

              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                  onClick={() => !disabled && onClickChar(c)}
                  className={[
                    'relative flex flex-col items-center p-2 rounded-sm cursor-pointer select-none',
                    'hud-panel hud-corner',
                    'transition-all duration-150',
                    disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:border-compass-cyan hover:shadow-cyan-glow',
                    isBanned  ? 'border-compass-red/50 bg-compass-redDim/20' : '',
                    isPicked && pickedTeam === 'A' ? 'border-blue-500/60 bg-blue-900/20' : '',
                    isPicked && pickedTeam === 'B' ? 'border-rose-500/60 bg-rose-900/20' : '',
                  ].join(' ')}
                >
                  {/* アイコン */}
                  <div className={[
                    'w-14 h-14 rounded-sm mb-1 flex items-center justify-center overflow-hidden',
                    'bg-compass-border/50',
                    isBanned  ? 'grayscale' : '',
                  ].join(' ')}>
                    <span className={`text-xl font-bold ${isBanned ? 'text-compass-textDim' : 'text-compass-cyan'}`}>
                      {c.name[0]}
                    </span>
                  </div>

                  {/* 名前 */}
                  <div className={`text-xs font-bold text-center leading-tight truncate w-full ${isBanned ? 'text-compass-textDim line-through' : 'text-compass-text'}`}>
                    {c.name}
                  </div>

                  {/* ロールバッジ */}
                  {c.role && (
                    <span className={`role-badge mt-0.5 ${roleBadgeClass(c.role)}`}>{c.role}</span>
                  )}

                  {/* 状態オーバーレイ */}
                  {isBanned && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-black tracking-widest text-red-400 bg-black/60 px-1 rotate-[-15deg] border border-red-600">BAN</span>
                    </div>
                  )}
                  {isPicked && (
                    <div className={`absolute top-0.5 right-0.5 text-[9px] font-black px-1 rounded-sm ${
                      pickedTeam === 'A' ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'
                    }`}>
                      {pickedTeam === 'A' ? '蒼' : '紅'}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      <ConfirmDialog
        open={confirm.open}
        message={`確定しますか？ [${confirm.action?.toUpperCase()}] ${confirm.char?.name}`}
        onConfirm={confirmAction}
        onCancel={() => setConfirm({ open: false })}
      />
    </>
  )
}
