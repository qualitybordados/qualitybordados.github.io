import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'

dayjs.extend(localizedFormat)

export function formatCurrency(value: number, currency: string = 'MXN') {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

export function formatDate(timestamp?: Date | string | number) {
  if (!timestamp) return 'Sin fecha'
  return dayjs(timestamp).format('DD MMM YYYY')
}

export function formatDateTime(timestamp?: Date | string | number) {
  if (!timestamp) return 'Sin fecha'
  return dayjs(timestamp).format('DD MMM YYYY HH:mm')
}

export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length !== 10) return phone
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
}
