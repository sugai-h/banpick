import type { NextApiRequest, NextApiResponse } from 'next'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const r = await fetch(`${BACKEND_URL}/api/characters`)
    const j = await r.json()
    return res.status(r.status).json(j)
  } catch (err: any) {
    return res.status(500).json({ error: err.message || String(err) })
  }
}
