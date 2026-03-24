export const DEFAULT_BACKEND_URL = 'http://localhost:3001'

export function getConfiguredBackendUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.BACKEND_URL?.trim() || DEFAULT_BACKEND_URL
}
