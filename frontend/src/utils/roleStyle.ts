export function roleBadgeClass(role: string): string {
  const r = role?.toLowerCase() ?? ''
  if (r.includes('ファイター') || r.includes('fighter')) return 'role-fighter'
  if (r.includes('メイジ') || r.includes('mage'))         return 'role-mage'
  if (r.includes('アサシン') || r.includes('assassin'))   return 'role-assassin'
  if (r.includes('サポート') || r.includes('support'))    return 'role-support'
  if (r.includes('タンク') || r.includes('tank'))         return 'role-tank'
  if (r.includes('ガンナー') || r.includes('gunner'))     return 'role-gunner'
  if (r.includes('スプリンター') || r.includes('sprinter')) return 'role-sprinter'
  return 'role-default'
}

export const ROLE_LIST = [
  'すべて',
  'アタッカー',
  'ガンナー',
  'スプリンター',
  'タンク',
]
