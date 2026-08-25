import type { NextApiRequest, NextApiResponse } from 'next'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const upstream = `${BACKEND_URL}/api/rooms`
    try {
      const r = await fetch(upstream, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body) })
      const j = await r.json()
      return res.status(r.status).json(j)
    } catch (err:any) {
      return res.status(500).json({ error: err.message || String(err) })
    }
  }
  res.setHeader('Allow', 'POST')
  res.status(405).end('Method Not Allowed')
}
