import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
      <AlertTriangle className="h-6 w-6" />
      <p>{message}</p>
      {onRetry ? (
        <Button onClick={onRetry} variant="outline">
          Reintentar
        </Button>
      ) : null}
    </div>
  )
}
