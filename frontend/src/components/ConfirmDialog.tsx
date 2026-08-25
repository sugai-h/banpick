import { motion, AnimatePresence } from 'framer-motion'

type Props = {
  open: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, message, onConfirm, onCancel }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* オーバーレイ */}
          <motion.div
            className="absolute inset-0 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />

          {/* ダイアログ本体 */}
          <motion.div
            className="relative w-72 hud-panel hud-corner rounded-sm p-5 z-10"
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 10 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{ border: '1px solid #00d4ff44' }}
          >
            {/* タイトル */}
            <div className="hud-title mb-3">CONFIRM ACTION</div>

            {/* メッセージ */}
            <p className="text-compass-text text-sm font-semibold mb-5 leading-relaxed">
              {message}
            </p>

            {/* ボタン */}
            <div className="flex gap-3">
              <button
                onClick={onConfirm}
                className="flex-1 btn-cyan py-2 text-xs rounded-sm"
              >
                ▶ 確定
              </button>
              <button
                onClick={onCancel}
                className="flex-1 py-2 text-xs font-bold tracking-widest uppercase rounded-sm border
                  border-compass-border text-compass-textDim
                  hover:border-compass-textDim hover:text-compass-text transition-all"
              >
                ✕ キャンセル
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
