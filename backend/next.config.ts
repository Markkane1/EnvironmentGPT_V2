import path from 'path'
import helmet from 'helmet'
import { fileURLToPath } from 'url'
import type { NextConfig } from 'next'

const configDir = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.resolve(configDir, '..')

function buildContentSecurityPolicy() {
  const directives = helmet.contentSecurityPolicy.getDefaultDirectives()

  directives['frame-ancestors'] = ["'none'"]
  directives['connect-src'] = ["'self'"]

  if (process.env.NODE_ENV !== 'production') {
    delete directives['upgrade-insecure-requests']
  }

  return Object.entries(directives)
    .map(([directive, values]) => {
      const directiveValues = Array.from(values)

      if (directiveValues.length === 0) {
        return directive
      }

      return `${directive} ${directiveValues.join(' ')}`
    })
    .join('; ')
}

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: buildContentSecurityPolicy(),
  },
  {
    key: 'Referrer-Policy',
    value: 'no-referrer',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'off',
  },
  {
    key: 'X-Download-Options',
    value: 'noopen',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Permitted-Cross-Domain-Policies',
    value: 'none',
  },
  {
    key: 'X-XSS-Protection',
    value: '0',
  },
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin',
  },
  {
    key: 'Cross-Origin-Resource-Policy',
    value: 'same-origin',
  },
  {
    key: 'Origin-Agent-Cluster',
    value: '?1',
  },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: workspaceRoot,
  poweredByHeader: false,
  reactStrictMode: false,
  turbopack: {
    root: workspaceRoot,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
