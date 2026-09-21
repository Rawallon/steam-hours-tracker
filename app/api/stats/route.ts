import { getStats } from '@/lib/stats'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = Number(searchParams.get('days') ?? '30')
  try {
    const data = await getStats(days)
    return Response.json(data)
  } catch (err) {
    console.error('stats fetch failed', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
