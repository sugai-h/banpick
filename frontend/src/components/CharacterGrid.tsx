import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import ConfirmDialog from './ConfirmDialog'
import { motion } from 'framer-motion'

export default function CharacterGrid({ socket }: any){
  const [characters, setCharacters] = useState<any[]>([])
  const charStates = useStore(s => s.charStates)
  const turnTeam = useStore(s=>s.turnTeam)
  const players = useStore(s=>s.players)
  const [confirm, setConfirm] = useState<{ open: boolean; char?: any; action?: 'ban'|'pick' }>({ open: false })

  useEffect(()=>{
    fetch('/api/characters').then(r=>r.json()).then(j=>setCharacters(j.characters))
  }, [])

  const currentPlayerId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null
  const currentPlayer = players.find(p=>p.id===currentPlayerId)

  function onClickChar(c: any) {
    const state = charStates.find((s:any)=>s.characterId===c.id)?.state || 'available'
    if (state !== 'available') return
    const phase = useStore.getState().phase
    const action: 'ban'|'pick' = phase && phase.startsWith('BAN') ? 'ban' : 'pick'

    if (action === 'pick') {
      // PICKフェーズ: チームに所属していて、自分のチームのターンのみ操作可能
      if (!currentPlayer?.team) return
      if (turnTeam !== undefined && turnTeam !== null && currentPlayer.team !== turnTeam) return
    }
    // BANフェーズ: チーム問わず全員が操作可能（チーム未所属でも可）
    setConfirm({ open: true, char: c, action })
  }

  function confirmAction() {
    if (!confirm.char || !confirm.action) return setConfirm({ open:false })
    const sock = socket
    if (!sock || !sock.emit) { alert('Socket not connected'); setConfirm({ open:false }); return }
    if (!currentPlayerId) { alert('playerId not found'); setConfirm({ open:false }); return }
    // ensure team if action is pick
    if (confirm.action === 'pick' && (!currentPlayer || !currentPlayer.team)) { alert('チームが割り当てられていません'); setConfirm({ open:false }); return }
    sock.emit('requestAction', { roomId: useStore.getState().roomId, playerId: currentPlayerId, actionType: confirm.action, characterId: confirm.char.id })
    setConfirm({ open:false })
  }

  const variants = {
    available: { scale: 1, filter: 'none', boxShadow: '0 0 0 rgba(0,0,0,0)' },
    banned: { scale: 0.96, filter: 'grayscale(1) blur(0.5px)', boxShadow: '0 0 0 rgba(0,0,0,0)' },
    pickedA: { scale: 1.02, boxShadow: '0 0 12px rgba(59,130,246,0.6)' },
    pickedB: { scale: 1.02, boxShadow: '0 0 12px rgba(248,113,113,0.6)' }
  }

  return (
    <>
    {/* Scroll container: limits height and allows internal scrolling without moving the rest of the page */}
    <div className="h-[70vh] overflow-auto p-1">
      <div className="grid grid-cols-3 gap-3">
      {characters.map(c => {
        const cs = charStates.find((s:any)=>s.characterId===c.id)
        const state = cs?.state || 'available'
        const phase = useStore.getState().phase
        const isBanPhase = phase && phase.startsWith('BAN')
        const isPickPhase = phase && phase.startsWith('PICK')
        // BAN: 全員操作可能（チーム未所属でも可）
        // PICK: 自分のチームのターンのみ操作可能
        const disabled = state !== 'available' || (
          isPickPhase && (
            !currentPlayer?.team ||
            (turnTeam !== undefined && turnTeam !== null && currentPlayer.team !== turnTeam)
          )
        )
        const animKey = state === 'picked' ? `picked-${cs?.pickedTeam}` : state
        const variantKey = state === 'picked' ? (cs?.pickedTeam === 'A' ? 'pickedA' : 'pickedB') : state
        return (
          <motion.div key={`${c.id}-${animKey}`} onClick={()=>onClickChar(c)} whileHover={{ scale: disabled?1:1.03 }} whileTap={{ scale: 0.98 }} animate={variants[variantKey as keyof typeof variants]} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className={`p-3 rounded bg-gray-800 flex flex-col items-center cursor-pointer ${disabled?'opacity-50 pointer-events-none':''}`}> 
            <div className="w-20 h-20 bg-gray-700 rounded mb-2 flex items-center justify-center overflow-hidden">
              {/* placeholder for icon */}
              <motion.span layout className="text-sm">{c.name[0]}</motion.span>
            </div>
            <div className="text-sm font-bold">{c.name}</div>
            <div className="text-xs text-gray-400">{c.role}</div>
            {state==='banned' && <div className="mt-2 text-red-400 text-xs">BANNED</div>}
            {state==='picked' && <div className="mt-2 text-green-400 text-xs">PICKED</div>}
          </motion.div>
        )
      })}
      </div>
    </div>
    <ConfirmDialog open={confirm.open} message={`確定しますか？ (${confirm.action} ${confirm.char?.name})`} onConfirm={confirmAction} onCancel={()=>setConfirm({ open:false })} />
    </>
  )
}
