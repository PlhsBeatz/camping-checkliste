'use client'

import { useEffect } from 'react'

export function InitializeDB() {
  useEffect(() => {
    const initDB = async () => {
      try {
        await fetch('/api/init', { method: 'POST' })
      } catch (error) {
        console.error('Failed to initialize database:', error)
      }
    }

    initDB()
  }, [])

  return null
}
