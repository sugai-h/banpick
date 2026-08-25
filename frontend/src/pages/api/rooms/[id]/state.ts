import type { NextApiRequest, NextApiResponse } from 'next'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'missing id' })
  if (req.method === 'GET') {
    const upstream = `${BACKEND_URL}/api/rooms/${encodeURIComponent(String(id))}/state`
    try {
      const r = await fetch(upstream)
      const j = await r.json()
      return res.status(r.status).json(j)
    } catch (err:any) {
      return res.status(500).json({ error: err.message || String(err) })
    }
  }
  res.setHeader('Allow', 'GET')
  res.status(405).end('Method Not Allowed')
}
