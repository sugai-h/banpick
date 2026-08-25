import type { NextApiRequest, NextApiResponse } from 'next'

type Character = { id: number; name: string; role: string; icon_url?: string }

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const characters: Character[] = Array.from({ length: 102 }, (_, i) => {
    const id = i + 1
    return { id, name: String(id), role: `Role ${((id - 1) % 5) + 1}`, icon_url: undefined }
  })
  res.status(200).json({ characters })
}
