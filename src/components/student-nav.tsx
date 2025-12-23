'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/student/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/student/practice', label: 'Practice', icon: '✏️' },
  { href: '/student/assignments', label: 'Assignments', icon: '📋' },
  { href: '/student/progress', label: 'My Progress', icon: '📊' },
  { href: '/student/sessions', label: 'Sessions', icon: '📅' },
]

export function StudentNav() {
  const pathname = usePathname()
  
  return (
    <nav className="w-64 bg-white border-r min-h-screen p-4">
      <div className="mb-8">
        <Link href="/student/dashboard" className="text-xl font-bold text-gray-900">
          TutorAssist
        </Link>
        <p className="text-xs text-gray-500 mt-1">Student Portal</p>
      </div>
      
      <ul className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-green-50 text-green-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
      
      <div className="mt-8 pt-8 border-t">
        <Link
          href="/student/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
          <span>⚙️</span>
          Settings
        </Link>
      </div>
    </nav>
  )
}
