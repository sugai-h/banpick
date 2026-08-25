import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function ResultPage() {
  const router = useRouter()
  const { id } = router.query
  const [data, setData] = useState<any>(null)
  const [characters, setCharacters] = useState<any[]>([])

  useEffect(() => {
    if (!id) return
    // ルーム状態とキャラクター一覧を並行取得
    Promise.all([
      fetch(`/api/rooms/${id}/state`).then(r => r.json()),
      fetch('/api/characters').then(r => r.json()),
    ]).then(([roomData, charData]) => {
      setData(roomData)
      setCharacters(charData.characters ?? [])
    })
  }, [id])

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      Loading...
    </div>
  )

  // character_id → キャラクター名
  function charName(characterId: number) {
    return characters.find(c => c.id === characterId)?.name ?? `#${characterId}`
  }

  // picked_by (UUID) → プレイヤー名
  function playerName(playerId: string | null) {
    if (!playerId) return '（自動）'
    return data.players?.find((p: any) => p.id === playerId)?.name ?? playerId
  }

  const bans: any[]  = data.chars?.filter((c: any) => c.state === 'banned') ?? []
  const picks: any[] = data.chars?.filter((c: any) => c.state === 'picked') ?? []
  const teamA = picks.filter((p: any) => p.picked_team === 'A')
  const teamB = picks.filter((p: any) => p.picked_team === 'B')

  return (
    <div className="min-h-screen p-6 bg-gray-900 text-white">
      <h1 className="text-2xl font-bold mb-6">結果 — Room {id}</h1>

      <div className="grid grid-cols-3 gap-4">
        {/* 蒼チーム */}
        <div className="bg-gray-800 p-4 rounded border border-blue-700">
          <h2 className="font-bold text-blue-300 mb-3">蒼チーム</h2>
          {teamA.length === 0 ? (
            <p className="text-gray-500 text-sm">なし</p>
          ) : (
            <ul className="space-y-2">
              {teamA.map((t: any, i: number) => (
                <li key={i} className="flex flex-col text-sm">
                  <span className="font-bold text-white">{charName(t.character_id)}</span>
                  <span className="text-gray-400 text-xs">by {playerName(t.picked_by)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* BAN一覧 */}
        <div className="bg-gray-800 p-4 rounded border border-red-800">
          <h2 className="font-bold text-red-400 mb-3">BAN 一覧</h2>
          {bans.length === 0 ? (
            <p className="text-gray-500 text-sm">なし</p>
          ) : (
            <ul className="space-y-1">
              {bans.map((b: any, i: number) => (
                <li key={i} className="text-sm text-gray-300 line-through decoration-red-500">
                  {charName(b.character_id)}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 紅チーム */}
        <div className="bg-gray-800 p-4 rounded border border-rose-700">
          <h2 className="font-bold text-rose-300 mb-3">紅チーム</h2>
          {teamB.length === 0 ? (
            <p className="text-gray-500 text-sm">なし</p>
          ) : (
            <ul className="space-y-2">
              {teamB.map((t: any, i: number) => (
                <li key={i} className="flex flex-col text-sm">
                  <span className="font-bold text-white">{charName(t.character_id)}</span>
                  <span className="text-gray-400 text-xs">by {playerName(t.picked_by)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button
        onClick={() => router.push('/')}
        className="mt-8 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm transition-colors"
      >
        トップに戻る
      </button>
    </div>
  )
}
