import type { NextFunction, Request, Response } from 'express'
import { NextRequest } from 'next/server'
import { getRouteAuthContext, runRouteMiddleware } from '@/lib/route-middleware'

type Middleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>

describe('route-middleware adapter', () => {
  it('should return the authenticated user when all middleware call next()', async () => {
    const attachUser: Middleware = (req, _res, next) => {
      req.user = {
        userId: 'user-1',
        role: 'admin',
      }
      next()
    }

    const context = await getRouteAuthContext(
      new NextRequest('http://localhost/api/test', {
        headers: {
          authorization: 'Bearer token-123',
        },
      }),
      attachUser
    )

    expect(context.response).toBeUndefined()
    expect(context.user).toEqual({
      userId: 'user-1',
      role: 'admin',
    })
  })

  it('should convert middleware JSON failures into NextResponse objects', async () => {
    const rejectRequest: Middleware = (_req, res) => {
      res.status(401).json({ error: 'Authentication token required' })
    }

    const response = await runRouteMiddleware(
      new NextRequest('http://localhost/api/test'),
      rejectRequest
    )

    expect(response?.status).toBe(401)
    await expect(response?.json()).resolves.toEqual({
      error: 'Authentication token required',
    })
  })

  it('should stop on the first failing middleware and preserve the attached user context', async () => {
    const attachUser: Middleware = (req, _res, next) => {
      req.user = {
        userId: 'user-2',
        role: 'viewer',
      }
      next()
    }
    const requireAdmin: Middleware = (_req, res) => {
      res.status(403).json({ error: 'Admin access required' })
    }

    const context = await getRouteAuthContext(
      new NextRequest('http://localhost/api/test'),
      attachUser,
      requireAdmin
    )

    expect(context.user).toEqual({
      userId: 'user-2',
      role: 'viewer',
    })
    expect(context.response?.status).toBe(403)
    await expect(context.response?.json()).resolves.toEqual({
      error: 'Admin access required',
    })
  })

  it('should convert thrown middleware errors into safe 500 responses', async () => {
    const explodingMiddleware: Middleware = async () => {
      throw new Error('boom')
    }

    const response = await runRouteMiddleware(
      new NextRequest('http://localhost/api/test'),
      explodingMiddleware
    )

    expect(response?.status).toBe(500)
    await expect(response?.json()).resolves.toEqual({
      error: 'Failed to process request middleware',
    })
  })
})
