import { redirect } from 'next/navigation'
import { requireUser, getUserContext } from '@/lib/auth'
import { StudentNav } from '@/components/student-nav'

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()
  
  if (!user) {
    redirect('/login')
  }
  
  const context = await getUserContext()
  
  if (!context) {
    redirect('/onboarding')
  }
  
  // Students only
  if (context.role !== 'student') {
    redirect('/tutor/dashboard')
  }
  
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <StudentNav />
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  )
}
