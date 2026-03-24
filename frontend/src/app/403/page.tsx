import Link from 'next/link'
import { ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(13,148,136,0.10),_transparent_40%),linear-gradient(180deg,_#f8fffd_0%,_#eef7f4_52%,_#e6f0ee_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-teal-100 bg-white/90 p-10 text-center shadow-[0_24px_80px_rgba(15,118,110,0.10)] backdrop-blur">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-100">
            <ShieldOff className="h-8 w-8" />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-teal-600">
            Access Restricted
          </p>
          <h1 className="font-serif text-4xl text-slate-900">403</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-600 md:text-base">
            Your session is valid, but it does not include the administrator role required for
            this area.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/">Back to Home</Link>
            </Button>
            <Button asChild>
              <Link href="/login">Sign in as Admin</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  )
}
