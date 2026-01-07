'use client'

import { memo } from 'react'

// Skeleton pulse animation via Tailwind's animate-pulse
const Pulse = ({ className = '', style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} style={style} />
)

// Dashboard stat card skeleton
export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border-2 border-gray-100 bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-2">
        <Pulse className="w-8 h-8 rounded-lg" />
      </div>
      <Pulse className="h-8 w-16 mb-1" />
      <Pulse className="h-4 w-20" />
    </div>
  )
}

// Assignment card skeleton
export function AssignmentCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-4">
        <Pulse className="w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Pulse className="h-5 w-2/3" />
          <Pulse className="h-4 w-1/2" />
          <Pulse className="h-2 w-full mt-2 rounded-full" />
        </div>
        <Pulse className="w-5 h-5 rounded" />
      </div>
    </div>
  )
}

// Activity item skeleton
export function ActivityItemSkeleton() {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <Pulse className="w-10 h-10 rounded-xl" />
      <div className="flex-1 space-y-1.5">
        <Pulse className="h-4 w-32" />
        <Pulse className="h-3 w-24" />
      </div>
      <Pulse className="w-16 h-4 rounded" />
    </div>
  )
}

// Student dashboard full skeleton
export function StudentDashboardSkeleton() {
  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="mb-8">
        <Pulse className="h-9 w-64 mb-3" />
        <div className="flex gap-3">
          <Pulse className="h-7 w-24 rounded-full" />
          <Pulse className="h-7 w-20 rounded-full" />
        </div>
      </div>
      
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      
      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-2xl border-2 border-gray-100 p-5">
            <div className="flex items-center gap-4">
              <Pulse className="w-14 h-14 rounded-xl" />
              <div className="space-y-2">
                <Pulse className="h-5 w-32" />
                <Pulse className="h-4 w-48" />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Assignments section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <Pulse className="h-6 w-36" />
              <Pulse className="h-4 w-20" />
            </div>
            <div className="divide-y divide-gray-50">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="px-6 py-5">
                  <AssignmentCardSkeleton />
                </div>
              ))}
            </div>
          </div>
          
          {/* Activity section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <Pulse className="h-6 w-32" />
            </div>
            {[...Array(3)].map((_, i) => (
              <ActivityItemSkeleton key={i} />
            ))}
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <Pulse className="h-5 w-24 mb-4" />
            <div className="flex items-end justify-between gap-2 h-28">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <Pulse className="w-full rounded-t-lg" style={{ height: `${20 + Math.random() * 60}%` }} />
                  <Pulse className="h-3 w-6" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Tutor dashboard full skeleton
export function TutorDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <Pulse className="h-8 w-72 mb-2" />
        <Pulse className="h-4 w-48" />
      </div>
      
      {/* Action items */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border-2 border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <Pulse className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Pulse className="h-5 w-20" />
                <Pulse className="h-4 w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Schedule card */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <Pulse className="h-5 w-36" />
          </div>
          <div className="divide-y divide-gray-50">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div className="space-y-1.5">
                  <Pulse className="h-5 w-32" />
                  <Pulse className="h-4 w-20" />
                </div>
                <Pulse className="h-8 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
        
        {/* Assignments card */}
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-4">
            <Pulse className="h-5 w-40" />
          </div>
          <div className="divide-y divide-gray-50">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div className="space-y-1.5">
                  <Pulse className="h-5 w-40" />
                  <Pulse className="h-4 w-28" />
                </div>
                <Pulse className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Students overview */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <Pulse className="h-5 w-28" />
          <Pulse className="h-4 w-24" />
        </div>
        <div className="divide-y divide-gray-50">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <Pulse className="h-9 w-9 rounded-full" />
                <div className="space-y-1">
                  <Pulse className="h-4 w-28" />
                  <Pulse className="h-3 w-36" />
                </div>
              </div>
              <Pulse className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Practice page mode selection skeleton
export function PracticeSelectionSkeleton() {
  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
      <div className="mb-8">
        <Pulse className="h-8 w-48 mb-2" />
        <Pulse className="h-5 w-72" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border-2 border-gray-100 p-6">
            <div className="flex items-start gap-4">
              <Pulse className="w-12 h-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Pulse className="h-6 w-40" />
                <Pulse className="h-4 w-full" />
                <Pulse className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Assignment list skeleton  
export function AssignmentsListSkeleton() {
  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-8">
        <Pulse className="h-8 w-48 mb-2" />
        <Pulse className="h-5 w-64" />
      </div>
      
      <div className="mb-8">
        <Pulse className="h-6 w-32 mb-4" />
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex justify-between items-start mb-3">
                <div className="space-y-2">
                  <Pulse className="h-5 w-48" />
                  <Pulse className="h-4 w-64" />
                </div>
                <Pulse className="h-4 w-24" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <Pulse className="h-3 w-32" />
                  <Pulse className="h-2 w-full rounded-full" />
                </div>
                <Pulse className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Memoize exports to prevent unnecessary re-renders
export const MemoizedStudentDashboardSkeleton = memo(StudentDashboardSkeleton)
export const MemoizedTutorDashboardSkeleton = memo(TutorDashboardSkeleton)
export const MemoizedPracticeSelectionSkeleton = memo(PracticeSelectionSkeleton)
export const MemoizedAssignmentsListSkeleton = memo(AssignmentsListSkeleton)
