import * as React from 'react'
import { clsx } from 'clsx'

type TableProps = React.TableHTMLAttributes<HTMLTableElement>

type TableSectionProps<T extends HTMLElement> = React.HTMLAttributes<T>

type TableCellProps = React.TdHTMLAttributes<HTMLTableCellElement>

type TableHeadCellProps = React.ThHTMLAttributes<HTMLTableCellElement>

export function Table({ className, ...props }: TableProps) {
  return <table className={clsx('w-full caption-bottom text-sm', className)} {...props} />
}

export function TableHeader({ className, ...props }: TableSectionProps<HTMLTableSectionElement>) {
  return <thead className={clsx('[&_tr]:border-b', className)} {...props} />
}

export function TableBody({ className, ...props }: TableSectionProps<HTMLTableSectionElement>) {
  return <tbody className={clsx('[&_tr:last-child]:border-0', className)} {...props} />
}

export function TableRow({ className, ...props }: TableSectionProps<HTMLTableRowElement>) {
  return <tr className={clsx('border-b transition-colors hover:bg-slate-50 data-[state=selected]:bg-slate-100', className)} {...props} />
}

export function TableHead({ className, ...props }: TableHeadCellProps) {
  return <th className={clsx('h-10 px-2 text-left align-middle text-xs font-medium text-slate-500', className)} {...props} />
}

export function TableCell({ className, ...props }: TableCellProps) {
  return <td className={clsx('p-2 align-middle text-sm text-slate-700', className)} {...props} />
}

export function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={clsx('mt-4 text-sm text-slate-500', className)} {...props} />
}
