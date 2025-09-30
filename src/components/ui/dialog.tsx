import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import { forwardRef, useEffect } from 'react'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal
export const DialogClose = DialogPrimitive.Close

export const DialogOverlay = forwardRef<HTMLDivElement, DialogPrimitive.DialogOverlayProps>(({ className, ...props }, ref) => {
  useEffect(() => {
    document.documentElement.classList.add('modal-open')
    document.body.classList.add('modal-open')

    return () => {
      document.documentElement.classList.remove('modal-open')
      document.body.classList.remove('modal-open')
    }
  }, [])

  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={clsx(
        'fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out',
        className,
      )}
      {...props}
    />
  )
})
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

export const DialogContent = forwardRef<HTMLDivElement, DialogPrimitive.DialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const portalContainer = typeof document !== 'undefined' ? document.body : undefined

    return (
      <DialogPortal container={portalContainer}>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={clsx(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-[min(100vw-24px,680px)] max-h-[calc(100dvh-24px)] flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white shadow-2xl outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:duration-200 data-[state=open]:duration-200 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border sm:shadow-xl',
          'sm:max-w-xl lg:max-w-3xl',
          'overflow-x-hidden',
          className,
        )}
        {...props}
      >
        <span className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" aria-hidden="true" />
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
        <DialogPrimitive.Close className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm ring-offset-white transition-all hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
          <X className="h-4 w-4" />
          <span className="sr-only">Cerrar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
      </DialogPortal>
    )
  },
)
DialogContent.displayName = DialogPrimitive.Content.displayName

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={clsx(
      'sticky top-0 z-10 flex flex-col gap-1.5 border-b border-slate-200 bg-white/95 px-6 pb-4 pt-5 text-center backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:text-left',
      className,
    )}
    {...props}
  />
)

export const DialogTitle = forwardRef<HTMLHeadingElement, DialogPrimitive.DialogTitleProps>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={clsx('text-lg font-semibold leading-tight text-slate-900', className)} {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

export const DialogDescription = forwardRef<
  HTMLParagraphElement,
  DialogPrimitive.DialogDescriptionProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={clsx('text-sm text-slate-500', className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export const DialogBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={clsx('flex-1 overflow-y-auto px-6 py-4 text-left', className)}
    {...props}
  />
))
DialogBody.displayName = 'DialogBody'

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={clsx(
      'sticky bottom-0 z-10 flex flex-col gap-2 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:flex-row sm:items-center sm:justify-end',
      className,
    )}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'
