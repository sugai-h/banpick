import test from 'node:test'
import assert from 'node:assert/strict'

import { getNextBanTeam, getTeamBanVoteState, resolveJoinPlayerState } from './roomRules'

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

test('BAN voting waits for all players on the active team before moving on', () => {
  const players = [
    { id: 'a1', name: 'A1', team: 'A' as const },
    { id: 'a2', name: 'A2', team: 'A' as const },
    { id: 'b1', name: 'B1', team: 'B' as const }
  ]

  const result = getTeamBanVoteState(players, 'A', { a1: 10 })

  assert.equal(result.ready, false)
  assert.deepEqual(result.pending, ['a2'])
  assert.deepEqual(result.selected, [10])
})

test('BAN team alternates from A to B and then advances out of banning', () => {
  assert.equal(getNextBanTeam('A'), 'B')
  assert.equal(getNextBanTeam('B'), undefined)
})
