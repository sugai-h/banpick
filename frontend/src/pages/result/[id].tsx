import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function ResultPage(){
  const router = useRouter()
  const { id } = router.query
  const [data, setData] = useState<any>(null)

  useEffect(()=>{
    if(!id) return
    fetch(`/api/rooms/${id}/state`).then(r=>r.json()).then(j=>setData(j))
  }, [id])

  if(!data) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  const bans = data.chars.filter((c:any)=>c.state==='banned')
  const picks = data.chars.filter((c:any)=>c.state==='picked')
  const teamA = picks.filter((p:any)=>p.picked_team==='A')
  const teamB = picks.filter((p:any)=>p.picked_team==='B')

  return (
    <div className="min-h-screen p-6 bg-gray-900 text-white">
      <h1 className="text-2xl mb-4">結果 - Room {id}</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="font-bold">蒼チーム</h2>
          <ul>
            {teamA.map((t:any,i:number)=>(<li key={i}>{t.picked_by} - Character {t.character_id}</li>))}
          </ul>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="font-bold">BAN 一覧</h2>
          <ul>
            {bans.map((b:any,i:number)=>(<li key={i}>Character {b.character_id}</li>))}
          </ul>
        </div>
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="font-bold">紅チーム</h2>
          <ul>
            {teamB.map((t:any,i:number)=>(<li key={i}>{t.picked_by} - Character {t.character_id}</li>))}
          </ul>
        </div>
      </div>
    </div>
  )
}
