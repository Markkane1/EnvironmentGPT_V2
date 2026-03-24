'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startTransition, useState, type FormEvent } from 'react'
import { ShieldCheck, TriangleAlert, FileText, Database, Zap, Settings } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getApiErrorMessage } from '@/lib/api-errors'

function Leaf({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  )
}

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const payload = await response.json()

      if (!response.ok) {
        setError(getApiErrorMessage(payload?.error, 'Login failed'))
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
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_rgba(13,148,136,0.12),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(5,150,105,0.08),_transparent_50%),linear-gradient(180deg,_#f0fdf9_0%,_#f8fffe_50%,_#f0fdf9_100%)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl">
        <section className="grid w-full overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-[0_20px_60px_rgba(13,148,136,0.12),0_4px_16px_rgba(0,0,0,0.06)] md:grid-cols-[1fr_1fr]">

          {/* ── Left panel ── */}
          <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 p-8 text-white md:p-10">
            {/* subtle texture circles */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-white/5" />

            <div className="relative space-y-8">
              {/* Brand */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                  <Leaf className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-wide text-teal-100">EPA Punjab</p>
                  <p className="text-xs text-teal-200/70">EnvironmentGPT</p>
                </div>
              </div>

              {/* Heading */}
              <div className="space-y-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-teal-100">
                  <ShieldCheck className="h-3 w-3" />
                  Admin Portal
                </span>
                <h1 className="text-3xl font-bold leading-snug text-white md:text-4xl">
                  Manage the knowledge base.
                </h1>
                <p className="text-sm leading-relaxed text-teal-100/80">
                  Sign in with your administrator credentials to control every aspect of the EPA Punjab Environmental Knowledge Assistant.
                </p>
              </div>

              {/* Feature list */}
              <ul className="space-y-3">
                {[
                  { icon: <FileText className="h-4 w-4" />, label: 'Upload & manage documents' },
                  { icon: <Database className="h-4 w-4" />, label: 'Configure knowledge connectors' },
                  { icon: <Zap className="h-4 w-4" />, label: 'Manage LLM providers' },
                  { icon: <Settings className="h-4 w-4" />, label: 'Monitor system health & cache' },
                ].map(({ icon, label }) => (
                  <li key={label} className="flex items-center gap-2.5 text-sm text-teal-100/90">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      {icon}
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer note */}
            <p className="relative mt-8 text-xs leading-relaxed text-teal-200/60">
              Sessions are secured with httpOnly cookies and verified by Next.js middleware on every admin route.
            </p>
          </div>

          {/* ── Right panel (form) ── */}
          <div className="flex flex-col justify-center bg-white px-8 py-10 md:px-10">
            {/* Mini brand mark */}
            <div className="mb-8 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-sm">
                <Leaf className="h-4.5 w-4.5 h-[18px] w-[18px] text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">EPA Punjab</p>
                <p className="text-xs text-gray-400">Admin access</p>
              </div>
            </div>

            <div className="mb-7">
              <h2 className="text-2xl font-bold text-gray-900">Sign in</h2>
              <p className="mt-1 text-sm text-gray-500">
                Enter the administrator credentials configured in the backend.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit} method="post">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm font-medium text-gray-700">Username</Label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-10"
                />
              </div>

              {error ? (
                <Alert variant="destructive">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>Authentication failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button className="h-10 w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Sign in to Admin'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-400">
              <Link className="font-medium text-teal-700 hover:text-teal-800 hover:underline" href="/">
                ← Return to EnvironmentGPT
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
