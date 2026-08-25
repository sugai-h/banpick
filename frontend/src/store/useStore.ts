import create from 'zustand'

type Player = { id: string; name: string; team?: 'A'|'B'; isHost?: boolean }
type CharState = { characterId: number; state: 'available'|'banned'|'picked'; pickedBy?: string; pickedTeam?: 'A'|'B' }

type State = {
  roomId?: string
  players: Player[]
  charStates: CharState[]
  phase: string
  turnTeam?: 'A'|'B'|null
  remainingTime: number
  setRoomState: (s: Partial<State>) => void
}

export const useStore = create<State>((set) => ({
  players: [],
  charStates: [],
  phase: 'lobby',
  remainingTime: 30,
  roomId: undefined,
  setRoomState: (s) => set(state => ({...state, ...s}))
}))
