import { PageHeader } from '@/components/ui'
import { EmptyState } from '@/components/Tally'

export function Agents() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Agents" />
      <EmptyState title="Nothing here yet" body="This screen arrives in a later phase." />
    </div>
  )
}
