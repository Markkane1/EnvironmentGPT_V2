'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  showSources: boolean
  maxHistoryItems: number
}

export const defaultAppSettings: AppSettings = {
  theme: 'light',
  showSources: true,
  maxHistoryItems: 10,
}

interface AppSettingsState {
  settings: AppSettings
  setSettings: (settings: AppSettings) => void
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  resetSettings: () => void
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      settings: defaultAppSettings,
      setSettings: (settings) => set({ settings }),
      updateSetting: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [key]: value,
          },
        })),
      resetSettings: () => set({ settings: defaultAppSettings }),
    }),
    {
      name: 'epa-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
