import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsPanel } from '@/components/settings/settings-panel'

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-3">
          <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 hover:text-gray-700 -ml-2" asChild>
            <Link href="/">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <div className="h-4 w-px bg-gray-200" />
          <h1 className="text-sm font-semibold text-gray-800">Settings</h1>
        </div>
      </header>
      <main aria-label="Settings">
        <SettingsPanel />
      </main>
    </div>
  )
}
