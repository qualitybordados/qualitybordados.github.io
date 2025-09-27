import { clsx } from 'clsx'
import { forwardRef, HTMLAttributes } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement>

type CardHeaderProps = HTMLAttributes<HTMLDivElement>

type CardTitleProps = HTMLAttributes<HTMLHeadingElement>

type CardContentProps = HTMLAttributes<HTMLDivElement>

type CardFooterProps = HTMLAttributes<HTMLDivElement>

export const Card = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={clsx('rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm', className)} {...props} />
))
Card.displayName = 'Card'

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={clsx('flex flex-col space-y-1.5 p-6', className)} {...props} />
))
CardHeader.displayName = 'CardHeader'

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={clsx('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
))
CardTitle.displayName = 'CardTitle'

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={clsx('p-6 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={clsx('flex items-center p-6 pt-0', className)} {...props} />
))
CardFooter.displayName = 'CardFooter'
