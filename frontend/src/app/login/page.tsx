'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startTransition, useState, type FormEvent } from 'react'
import { ShieldCheck, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        setError(payload?.error || 'Login failed')
        return
      }

      startTransition(() => {
        router.push('/admin')
        router.refresh()
      })
    } catch {
      setError('Unable to contact the authentication service')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,148,136,0.18),_transparent_40%),linear-gradient(180deg,_#f8fffd_0%,_#eef7f4_52%,_#e6f0ee_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <section className="grid w-full max-w-4xl overflow-hidden rounded-[2rem] border border-emerald-200/70 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur md:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-between bg-[linear-gradient(160deg,_#0f766e_0%,_#115e59_52%,_#134e4a_100%)] p-8 text-white md:p-10">
            <div className="space-y-6">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-50">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin Access
              </span>
              <div className="space-y-4">
                <h1 className="max-w-sm font-serif text-4xl leading-tight md:text-5xl">
                  Secure the EPA Punjab control surface.
                </h1>
                <p className="max-w-md text-sm leading-6 text-emerald-50/85 md:text-base">
                  Sign in with your administrator credentials to manage providers, connectors,
                  documents, and pipeline operations.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-emerald-50/85">
              The session token is stored as an `httpOnly` cookie and checked by Next.js
              middleware before any `/admin` route renders.
            </div>
          </div>

          <div className="flex items-center bg-white/95 p-6 md:p-10">
            <Card className="w-full border-none shadow-none">
              <CardHeader className="px-0">
                <CardTitle className="text-2xl text-slate-900">Sign in</CardTitle>
                <CardDescription>
                  Use the administrator username and password configured in the backend.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      name="username"
                      autoComplete="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="admin"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                  </div>

                  {error ? (
                    <Alert variant="destructive">
                      <TriangleAlert className="h-4 w-4" />
                      <AlertTitle>Authentication failed</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}

                  <Button className="w-full" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Signing in...' : 'Sign in to Admin'}
                  </Button>

                  <p className="text-center text-sm text-slate-500">
                    <Link className="font-medium text-teal-700 hover:text-teal-800" href="/">
                      Return to EnvironmentGPT
                    </Link>
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  )
}
