import { PageHeader } from '@/components/ui'
import { EmptyState } from '@/components/Tally'

export function Prospect() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Prospect" />
      <EmptyState title="Nothing here yet" body="This screen arrives in a later phase." />
    </div>
  )
}
