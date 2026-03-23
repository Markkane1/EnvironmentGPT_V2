'use client'

import { useEffect } from 'react'
import { useAppSettingsStore } from '@/lib/app-settings'

function resolveTheme(theme: 'light' | 'dark' | 'system') {
  if (theme !== 'system') {
    return theme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function AppSettingsProvider() {
  const theme = useAppSettingsStore((state) => state.settings.theme)

  useEffect(() => {
    const root = document.documentElement

    const applyTheme = () => {
      const resolvedTheme = resolveTheme(theme)
      root.classList.toggle('dark', resolvedTheme === 'dark')
      root.dataset.theme = resolvedTheme
    }

    applyTheme()

    if (theme !== 'system') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => applyTheme()

    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  return null
}
