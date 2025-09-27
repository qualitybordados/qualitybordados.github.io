import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import { forwardRef } from 'react'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal
export const DialogClose = DialogPrimitive.Close

export const DialogOverlay = forwardRef<HTMLDivElement, DialogPrimitive.DialogOverlayProps>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={clsx('fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out', className)}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

export const DialogContent = forwardRef<HTMLDivElement, DialogPrimitive.DialogContentProps>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={clsx(
        'fixed left-1/2 top-1/2 z-50 grid w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-accent">
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={clsx('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)

export const DialogTitle = forwardRef<HTMLHeadingElement, DialogPrimitive.DialogTitleProps>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={clsx('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

export const DialogDescription = forwardRef<
  HTMLParagraphElement,
  DialogPrimitive.DialogDescriptionProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={clsx('text-sm text-slate-500', className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName
