import { PageHeader } from '@/components/ui'
import { EmptyState } from '@/components/Tally'

export function CallMode() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="CallMode" />
      <EmptyState title="Nothing here yet" body="This screen arrives in a later phase." />
    </div>
  )
}
