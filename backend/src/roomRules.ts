export type RoomPlayer = {
  id: string
  name: string
  team?: 'A' | 'B'
  isHost?: boolean
}

export type ResolvedJoinState = {
  id: string
  name: string
  team?: 'A' | 'B'
  isHost: boolean
}

export function reconcileHostAssignment(players: RoomPlayer[]) {
  const currentHost = players.find((player) => player.isHost)

  if (currentHost) {
    for (const player of players) {
      if (player.id !== currentHost.id) player.isHost = false
    }
    return players
  }

  if (players.length === 0) return players

  const firstPlayer = players[0]
  firstPlayer.isHost = true
  if (!firstPlayer.team) firstPlayer.team = 'A'

  return players
}

function toRoomPlayer(value: Partial<RoomPlayer> & { is_host?: boolean; team?: 'A' | 'B' | null }): RoomPlayer {
  return {
    id: value.id ?? '',
    name: value.name ?? 'Player',
    team: value.team ?? undefined,
    isHost: value.isHost ?? value.is_host ?? false
  }
}

export function resolveJoinPlayerState(
  players: Array<Partial<RoomPlayer> & { is_host?: boolean }>,
  playerId: string,
  playerName: string
): ResolvedJoinState {
  const normalizedPlayers = players.map((player) => toRoomPlayer(player as any))
  const existing = normalizedPlayers.find((player) => player.id === playerId)

  if (existing) {
    const hasAnyHost = normalizedPlayers.some((player) => player.isHost)
    const shouldBeHost = existing.isHost || !hasAnyHost
    const team: 'A' | 'B' | undefined = existing.team ?? (shouldBeHost ? 'A' : undefined)

    return {
      id: existing.id,
      name: existing.name || playerName,
      team,
      isHost: shouldBeHost
    }
  }

  const hasAnyHost = normalizedPlayers.some((player) => player.isHost)
  const isHost = !hasAnyHost

  return {
    id: playerId,
    name: playerName,
    team: isHost ? 'A' : undefined,
    isHost
  }
}
