import { useEffect } from 'react'
import { useStore } from '../store/useStore'

export default function Timer(){
  const remainingTime = useStore(s=>s.remainingTime)
  return (<div className="text-sm">{remainingTime}s</div>)
}
