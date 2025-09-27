import { PropsWithChildren } from 'react'

export function EmptyState({ title, description, children }: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
      <h3 className="text-base font-semibold text-slate-700">{title}</h3>
      {description ? <p className="max-w-md text-sm">{description}</p> : null}
      {children}
    </div>
  )
}
