import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import { clsx } from 'clsx'
import { PropsWithChildren } from 'react'

type AlertVariant = 'default' | 'success' | 'warning' | 'destructive'

type AlertProps = PropsWithChildren<{
  title?: string
  variant?: AlertVariant
  description?: string
  className?: string
}>

const icons: Record<AlertVariant, JSX.Element> = {
  default: <Info className="h-4 w-4" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  warning: <TriangleAlert className="h-4 w-4" />,
  destructive: <AlertCircle className="h-4 w-4" />,
}

const variantClasses: Record<AlertVariant, string> = {
  default: 'border-slate-200 bg-white text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  destructive: 'border-red-200 bg-red-50 text-red-700',
}

export function Alert({ children, title, description, variant = 'default', className }: AlertProps) {
  return (
    <div className={clsx('flex gap-3 rounded-lg border p-4 text-sm', variantClasses[variant], className)} role="alert">
      <span className="mt-0.5 text-slate-600">{icons[variant]}</span>
      <div className="space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {description ? <p className="text-sm opacity-90">{description}</p> : null}
        {children}
      </div>
    </div>
  )
}
