import create from 'zustand'

export const TEAM_LABELS: Record<'A'|'B', string> = { A: '蒼', B: '紅' }

export type PhaseStep = { type: 'BAN' | 'PICK_A' | 'PICK_B'; count: number }

export const PHASE_LABELS: Record<PhaseStep['type'], string> = {
  BAN:    '全体BAN',
  PICK_A: '蒼PICK',
  PICK_B: '紅PICK',
}

export const PHASE_COLORS: Record<PhaseStep['type'], string> = {
  BAN:    'bg-red-700 border-red-500',
  PICK_A: 'bg-blue-700 border-blue-500',
  PICK_B: 'bg-rose-700 border-rose-500',
}

export const DEFAULT_PHASES: PhaseStep[] = [
  { type: 'BAN',    count: 0 },
  { type: 'PICK_A', count: 1 },
  { type: 'PICK_B', count: 2 },
  { type: 'PICK_A', count: 2 },
  { type: 'PICK_B', count: 1 },
  { type: 'PICK_A', count: 2 },
  { type: 'PICK_B', count: 2 },
]

type Player = { id: string; name: string; team?: 'A'|'B'; isHost?: boolean }
type CharState = { characterId: number; state: 'available'|'banned'|'picked'; pickedBy?: string; pickedTeam?: 'A'|'B' }

type State = {
  roomId?: string
  players: Player[]
  charStates: CharState[]
  phase: string
  turnTeam?: 'A'|'B'|null
  remainingTime: number
  phaseIndex?: number
  customPhases: PhaseStep[]
  setRoomState: (s: Partial<Omit<State, 'setRoomState'>>) => void
}

export const useStore = create<State>((set) => ({
  players: [],
  charStates: [],
  phase: 'lobby',
  remainingTime: 30,
  roomId: undefined,
  phaseIndex: 0,
  customPhases: [...DEFAULT_PHASES],
  setRoomState: (s) => set(state => ({...state, ...s}))
}))
