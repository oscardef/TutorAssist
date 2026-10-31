import { redirect } from 'next/navigation'
import { requireTutor } from '@/lib/auth'
import PlansAdmin from './PlansAdmin'

export const metadata = { title: 'Plans' }

export default async function PlansAdminPage() {
  const context = await requireTutor()
  if (!context.isPlatformOwner) redirect('/tutor/dashboard')
  return <PlansAdmin />
}
