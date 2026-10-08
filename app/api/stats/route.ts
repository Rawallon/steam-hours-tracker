import { getStats } from '@/lib/stats'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = Number(searchParams.get('days') ?? '30')
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    return Response.json({ error: 'days must be an integer 1..366' }, { status: 400 })
  }
  try {
    const data = await getStats(days)
    return Response.json(data, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate' },
    })
  } catch (err) {
    console.error('stats fetch failed', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
