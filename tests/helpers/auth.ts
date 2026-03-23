import { signAuthToken } from '@/middleware/auth'
import type { UserRole } from '@/types'

export function createAuthHeaders(
  role: UserRole = 'viewer',
  userId: string = 'test-user'
): HeadersInit {
  return {
    Authorization: `Bearer ${signAuthToken({ userId, role })}`,
  }
}
