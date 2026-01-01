'use client'

import { useCallback } from 'react'
import confetti from 'canvas-confetti'

export function useConfetti() {
  // Basic confetti burst for correct answers
  const fireCorrect = useCallback(() => {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#22c55e', '#86efac', '#4ade80'],
      scalar: 0.8,
      gravity: 1.2,
      ticks: 150,
    })
  }, [])

  // Streak celebration - more confetti
  const fireStreak = useCallback((streakCount: number) => {
    const particleCount = Math.min(20 + streakCount * 15, 100)
    
    // Fire from both sides
    confetti({
      particleCount: particleCount / 2,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      colors: ['#fbbf24', '#f59e0b', '#fcd34d'],
    })
    confetti({
      particleCount: particleCount / 2,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      colors: ['#fbbf24', '#f59e0b', '#fcd34d'],
    })
  }, [])

  // Big celebration for completing assignment
  const fireCompletion = useCallback(() => {
    const duration = 2000
    const end = Date.now() + duration

    const colors = ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444']
    
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }
    frame()

    // Big burst in the center
    setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors,
        scalar: 1.2,
      })
    }, 200)
  }, [])

  // Subtle sparkle effect
  const fireSparkle = useCallback(() => {
    confetti({
      particleCount: 20,
      spread: 360,
      startVelocity: 15,
      gravity: 0.5,
      origin: { y: 0.5, x: 0.5 },
      colors: ['#60a5fa', '#93c5fd', '#bfdbfe'],
      scalar: 0.6,
      ticks: 100,
    })
  }, [])

  return {
    fireCorrect,
    fireStreak,
    fireCompletion,
    fireSparkle,
  }
}

// Export types for component props
export type ConfettiType = 'correct' | 'streak' | 'completion' | 'sparkle'
