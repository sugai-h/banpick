import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveJoinPlayerState } from './roomRules'

test('existing host player keeps their host status when rejoining', () => {
  const players = [
    { id: 'host-1', name: 'Host', isHost: true, team: 'A' as const }
  ]

  const result = resolveJoinPlayerState(players, 'host-1', 'Host')

  assert.equal(result.isHost, true)
  assert.equal(result.team, 'A')
})

test('first player in a room without a host becomes host', () => {
  const result = resolveJoinPlayerState([], 'new-player', 'Player')

  assert.equal(result.isHost, true)
  assert.equal(result.team, 'A')
})
