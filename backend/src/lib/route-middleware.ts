import type { NextFunction, Request, Response } from 'express'
import { NextRequest, NextResponse } from 'next/server'
import type { AuthenticatedUser } from '@/middleware/auth'

type ExpressMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Response | Promise<void | Response>

function createResponseShim(resolve: (response?: NextResponse) => void): Response {
  let statusCode = 200

  const responseShim = {
    status(code: number) {
      statusCode = code
      return responseShim
    },
    json(body: unknown) {
      resolve(NextResponse.json(body, { status: statusCode }))
      return responseShim
    },
  }

  return responseShim as unknown as Response
}

async function executeMiddleware(req: Request, middleware: ExpressMiddleware): Promise<NextResponse | undefined> {
  return new Promise((resolve) => {
    const res = createResponseShim(resolve)
    const next: NextFunction = () => resolve(undefined)

    Promise.resolve(middleware(req, res, next)).catch((error) => {
      console.error('Route middleware execution failed:', error)
      resolve(
        NextResponse.json(
          { error: 'Failed to process request middleware' },
          { status: 500 }
        )
      )
    })
  })
}

export async function runRouteMiddleware(
  request: NextRequest,
  ...middlewares: ExpressMiddleware[]
): Promise<NextResponse | undefined> {
  const { response } = await getRouteAuthContext(request, ...middlewares)
  return response
}

export async function getRouteAuthContext(
  request: NextRequest,
  ...middlewares: ExpressMiddleware[]
): Promise<{ response?: NextResponse; user?: AuthenticatedUser }> {
  const req = {
    headers: {
      authorization: request.headers.get('authorization') ?? undefined,
      cookie: request.headers.get('cookie') ?? undefined,
    },
  } as Request

  for (const middleware of middlewares) {
    const response = await executeMiddleware(req, middleware)

    if (response) {
      return {
        response,
        user: req.user,
      }
    }
  }

  return {
    response: undefined,
    user: req.user,
  }
}
