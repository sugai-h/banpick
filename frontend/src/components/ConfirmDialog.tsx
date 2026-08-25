export default function ConfirmDialog({ open, message, onConfirm, onCancel }: any){
  if(!open) return null
  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="bg-black/60 absolute inset-0" onClick={onCancel}></div>
      <div className="bg-white text-black p-4 rounded z-10">
        <p>{message}</p>
        <div className="mt-2 flex gap-2">
          <button className="px-3 py-1 bg-red-500 text-white" onClick={onConfirm}>確定</button>
          <button className="px-3 py-1 bg-gray-300" onClick={onCancel}>キャンセル</button>
        </div>
      </div>
    </div>
  )
}
