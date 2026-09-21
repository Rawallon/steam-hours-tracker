import { getStats } from '@/lib/stats'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = Number(searchParams.get('days') ?? '30')
  const data = await getStats(days)
  return Response.json(data)
}
