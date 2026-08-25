import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PhaseStep,
  PHASE_LABELS,
  PHASE_COLORS,
  DEFAULT_PHASES,
  useStore,
} from '../store/useStore'

type Props = {
  socket: any
  isHost: boolean
}

// フェーズ追加メニューの選択肢
const ADD_OPTIONS: { type: PhaseStep['type']; defaultCount: number }[] = [
  { type: 'BAN',    defaultCount: 0 },
  { type: 'PICK_A', defaultCount: 1 },
  { type: 'PICK_B', defaultCount: 1 },
]

export default function PhaseEditor({ socket, isHost }: Props) {
  const customPhases = useStore(s => s.customPhases)
  const roomId = useStore(s => s.roomId)
  const [showAddMenu, setShowAddMenu] = useState(false)
  // countEditor: インデックス→編集中の文字列
  const [editCount, setEditCount] = useState<Record<number, string>>({})

  function emitUpdate(phases: PhaseStep[]) {
    if (!socket || !roomId) return
    const playerId = typeof window !== 'undefined' ? localStorage.getItem('playerId') : null
    socket.emit('setPhaseSequence', { roomId, playerId, phases })
  }

  function addPhase(type: PhaseStep['type']) {
    const count = type === 'BAN' ? 0 : 1
    const next = [...customPhases, { type, count }]
    emitUpdate(next)
    setShowAddMenu(false)
  }

  function removePhase(index: number) {
    const next = customPhases.filter((_, i) => i !== index)
    emitUpdate(next)
  }

  function movePhase(index: number, dir: -1 | 1) {
    const arr = [...customPhases]
    const target = index + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[index], arr[target]] = [arr[target], arr[index]]
    emitUpdate(arr)
  }

  function commitCount(index: number) {
    const raw = editCount[index]
    if (raw === undefined) return
    const n = parseInt(raw, 10)
    if (isNaN(n) || n < 1) return
    const arr = [...customPhases]
    arr[index] = { ...arr[index], count: n }
    emitUpdate(arr)
    setEditCount(prev => { const c = {...prev}; delete c[index]; return c })
  }

  function resetToDefault() {
    emitUpdate([...DEFAULT_PHASES])
  }

  return (
    <div className="bg-gray-800 rounded p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm text-gray-200">フェーズ設定</h3>
        {isHost && (
          <button
            onClick={resetToDefault}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            デフォルトに戻す
          </button>
        )}
      </div>

      {/* フェーズリスト */}
      <div className="space-y-1.5 mb-2">
        <AnimatePresence initial={false}>
          {customPhases.map((ph, i) => (
            <motion.div
              key={`${ph.type}-${i}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.15 }}
              className={`flex items-center gap-2 px-2 py-1.5 rounded border ${PHASE_COLORS[ph.type]} text-white text-sm`}
            >
              {/* フェーズ番号 */}
              <span className="w-5 text-center text-xs text-gray-300 font-mono">{i + 1}</span>

              {/* ラベル */}
              <span className="flex-1 font-semibold">{PHASE_LABELS[ph.type]}</span>

              {/* 枚数（BAN以外） */}
              {ph.type !== 'BAN' && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-300">×</span>
                  {isHost ? (
                    <input
                      type="number"
                      min={1}
                      max={9}
                      value={editCount[i] !== undefined ? editCount[i] : ph.count}
                      onChange={e => setEditCount(prev => ({ ...prev, [i]: e.target.value }))}
                      onBlur={() => commitCount(i)}
                      onKeyDown={e => e.key === 'Enter' && commitCount(i)}
                      className="w-10 text-center bg-gray-900 rounded border border-gray-600 text-white text-xs py-0.5 focus:outline-none focus:border-indigo-400"
                    />
                  ) : (
                    <span className="w-6 text-center font-bold">{ph.count}</span>
                  )}
                </div>
              )}

              {/* 操作ボタン（ホストのみ） */}
              {isHost && (
                <div className="flex items-center gap-0.5 ml-1">
                  <button
                    onClick={() => movePhase(i, -1)}
                    disabled={i === 0}
                    className="p-0.5 rounded hover:bg-white/20 disabled:opacity-30 transition-colors"
                    title="上へ"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => movePhase(i, 1)}
                    disabled={i === customPhases.length - 1}
                    className="p-0.5 rounded hover:bg-white/20 disabled:opacity-30 transition-colors"
                    title="下へ"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removePhase(i)}
                    className="p-0.5 rounded hover:bg-white/20 text-red-300 hover:text-red-100 transition-colors"
                    title="削除"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {customPhases.length === 0 && (
          <div className="text-xs text-gray-500 text-center py-2">
            フェーズが未設定です
          </div>
        )}
      </div>

      {/* 追加ボタン（ホストのみ） */}
      {isHost && (
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(v => !v)}
            className="w-full flex items-center justify-center gap-1 py-1.5 rounded border border-dashed border-gray-500 hover:border-indigo-400 hover:bg-indigo-900/30 text-gray-400 hover:text-indigo-300 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            フェーズを追加
          </button>

          <AnimatePresence>
            {showAddMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute bottom-full left-0 right-0 mb-1 bg-gray-700 rounded border border-gray-600 overflow-hidden z-10 shadow-lg"
              >
                {ADD_OPTIONS.map(opt => (
                  <button
                    key={opt.type}
                    onClick={() => addPhase(opt.type)}
                    className={`w-full px-3 py-2 text-left text-sm font-semibold hover:bg-gray-600 transition-colors border-b border-gray-600 last:border-0 ${
                      opt.type === 'BAN' ? 'text-red-300' :
                      opt.type === 'PICK_A' ? 'text-blue-300' : 'text-rose-300'
                    }`}
                  >
                    {PHASE_LABELS[opt.type]}
                  </button>
                ))}
                <button
                  onClick={() => setShowAddMenu(false)}
                  className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-600 transition-colors"
                >
                  キャンセル
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
