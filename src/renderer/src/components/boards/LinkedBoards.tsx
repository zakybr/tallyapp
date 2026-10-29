import { api, useData, ago, fileUrl } from '@/lib/api'
import { href } from '@/lib/router'
import { Section } from '../ui'

/* Boards linked to a person or company, shown on their page. */
export function LinkedBoards({ personId, companyId }: { personId?: number; companyId?: number }) {
  const { data: boards } = useData(() => api.boardsFor({ personId, companyId }), [personId, companyId])
  if (!boards?.length) return null
  return (
    <Section title="Boards">
      <ul className="flex flex-col gap-2">
        {boards.map((b) => (
          <li key={b.id}>
            <a href={href({ name: 'board', id: b.id })} className="flex items-center gap-3 rounded-md border border-rule bg-paper-raised p-2 hover:border-rule-strong">
              <span className="h-10 w-16 shrink-0 overflow-hidden rounded border border-rule bg-[#F2EDE4]">{b.thumbnail && <img src={`${fileUrl(b.thumbnail)}&v=${encodeURIComponent(b.updatedAt)}`} alt="" className="h-full w-full object-contain" />}</span>
              <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{b.name}</span><span className="text-[11.5px] text-ink-3">{ago(b.updatedAt)}</span></span>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  )
}
