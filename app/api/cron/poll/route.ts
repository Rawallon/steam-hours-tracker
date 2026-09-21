import { runPoll } from '@/lib/poll'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const result = await runPoll()
    return Response.json(result)
  } catch (err) {
    console.error('poll failed', err)
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
