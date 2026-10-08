import Dashboard from './components/Dashboard'
import { parseView } from '@/lib/view'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; group?: string; game?: string }>
}) {
  const sp = await searchParams
  return <Dashboard initial={parseView(sp)} />
}
