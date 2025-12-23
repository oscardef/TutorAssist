import { TutorNav } from '@/components/tutor-nav'
import { ToastProvider } from '@/components/toast'
import { requireTutor } from '@/lib/auth'

export default async function TutorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireTutor()

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <TutorNav />
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-6 py-8">
            {children}
          </div>
        </div>
      </div>
    </ToastProvider>
  )
}
