import * as TabsPrimitive from '@radix-ui/react-tabs'
import { clsx } from 'clsx'
import { forwardRef } from 'react'

export const Tabs = TabsPrimitive.Root

export const TabsList = forwardRef<HTMLDivElement, TabsPrimitive.TabsListProps>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={clsx('inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-slate-500', className)}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsPrimitive.TabsTriggerProps>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={clsx(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 data-[state=active]:bg-white data-[state=active]:text-slate-900',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

export const TabsContent = forwardRef<HTMLDivElement, TabsPrimitive.TabsContentProps>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={clsx('mt-4 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2', className)}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName
