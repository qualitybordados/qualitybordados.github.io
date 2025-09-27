import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/config/firebase'

export default function LogoutPage() {
  useEffect(() => {
    signOut(auth).catch(console.error)
  }, [])

  return <Navigate to="/login" replace />
}
