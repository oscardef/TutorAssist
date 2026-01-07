'use client'

// Sound effect utility for celebratory feedback
// Uses Web Audio API for lightweight, responsive sounds

class SoundManager {
  private audioContext: AudioContext | null = null
  private enabled: boolean = true
  private preloaded: boolean = false

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    // Resume if suspended (required after user interaction)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }
    return this.audioContext
  }

  // Preload the audio context to eliminate first-play delay
  preload() {
    if (this.preloaded) return
    try {
      const ctx = this.getContext()
      // Create a silent oscillator to "warm up" the audio context
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      gainNode.gain.value = 0 // Silent
      oscillator.start()
      oscillator.stop(ctx.currentTime + 0.001)
      this.preloaded = true
    } catch (e) {
      console.warn('Could not preload audio:', e)
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (typeof window !== 'undefined') {
      localStorage.setItem('soundEffectsEnabled', JSON.stringify(enabled))
    }
  }

  isEnabled(): boolean {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('soundEffectsEnabled')
      if (stored !== null) {
        this.enabled = JSON.parse(stored)
      }
    }
    return this.enabled
  }

  // Play a success/correct answer sound (pleasant chime)
  playCorrect() {
    if (!this.isEnabled()) return
    
    try {
      const ctx = this.getContext()
      const now = ctx.currentTime

      // Create a pleasant two-tone chime
      const frequencies = [523.25, 659.25] // C5, E5
      
      frequencies.forEach((freq, i) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        oscillator.frequency.value = freq
        oscillator.type = 'sine'
        
        // Stagger the notes slightly
        const startTime = now + i * 0.08
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02)
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4)
        
        oscillator.start(startTime)
        oscillator.stop(startTime + 0.5)
      })
    } catch (e) {
      console.warn('Could not play sound:', e)
    }
  }

  // Play incorrect answer sound (subtle low tone)
  playIncorrect() {
    if (!this.isEnabled()) return
    
    try {
      const ctx = this.getContext()
      const now = ctx.currentTime

      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      oscillator.frequency.value = 220 // A3 - lower, softer tone
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
      
      oscillator.start(now)
      oscillator.stop(now + 0.3)
    } catch (e) {
      console.warn('Could not play sound:', e)
    }
  }

  // Play streak sound (ascending notes)
  playStreak(streakCount: number) {
    if (!this.isEnabled()) return
    
    try {
      const ctx = this.getContext()
      const now = ctx.currentTime

      // More notes for higher streaks (max 5)
      const noteCount = Math.min(streakCount, 5)
      const baseFreq = 392 // G4
      
      for (let i = 0; i < noteCount; i++) {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        // Major scale ascending
        const semitones = [0, 2, 4, 5, 7][i]
        oscillator.frequency.value = baseFreq * Math.pow(2, semitones / 12)
        oscillator.type = 'sine'
        
        const startTime = now + i * 0.06
        gainNode.gain.setValueAtTime(0, startTime)
        gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.01)
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2)
        
        oscillator.start(startTime)
        oscillator.stop(startTime + 0.25)
      }
    } catch (e) {
      console.warn('Could not play sound:', e)
    }
  }

  // Play completion fanfare
  playCompletion() {
    if (!this.isEnabled()) return
    
    try {
      const ctx = this.getContext()
      const now = ctx.currentTime

      // Triumphant chord progression
      const chords = [
        [261.63, 329.63, 392.00], // C major
        [293.66, 369.99, 440.00], // D major
        [329.63, 415.30, 493.88], // E major
      ]
      
      chords.forEach((chord, chordIdx) => {
        chord.forEach((freq) => {
          const oscillator = ctx.createOscillator()
          const gainNode = ctx.createGain()
          
          oscillator.connect(gainNode)
          gainNode.connect(ctx.destination)
          
          oscillator.frequency.value = freq
          oscillator.type = 'sine'
          
          const startTime = now + chordIdx * 0.2
          gainNode.gain.setValueAtTime(0, startTime)
          gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.02)
          gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5)
          
          oscillator.start(startTime)
          oscillator.stop(startTime + 0.6)
        })
      })
    } catch (e) {
      console.warn('Could not play sound:', e)
    }
  }

  // Play button click (subtle)
  playClick() {
    if (!this.isEnabled()) return
    
    try {
      const ctx = this.getContext()
      const now = ctx.currentTime

      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.1, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05)
      
      oscillator.start(now)
      oscillator.stop(now + 0.05)
    } catch (e) {
      console.warn('Could not play sound:', e)
    }
  }
}

// Singleton instance
export const soundManager = typeof window !== 'undefined' ? new SoundManager() : null

// Hook for React components
export function useSounds() {
  return {
    playCorrect: () => soundManager?.playCorrect(),
    playIncorrect: () => soundManager?.playIncorrect(),
    playStreak: (count: number) => soundManager?.playStreak(count),
    playCompletion: () => soundManager?.playCompletion(),
    playClick: () => soundManager?.playClick(),
    isEnabled: () => soundManager?.isEnabled() ?? true,
    setEnabled: (enabled: boolean) => soundManager?.setEnabled(enabled),
    preload: () => soundManager?.preload(),
  }
}
