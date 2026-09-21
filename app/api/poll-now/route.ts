import { runPoll } from '@/lib/poll'

export async function POST() {
  try {
    const result = await runPoll()
    return Response.json(result)
  } catch (err) {
    console.error('poll failed', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
