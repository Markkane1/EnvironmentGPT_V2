import type { AuthenticatedUser } from '@/middleware/auth'

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser
  }
}

export {}
