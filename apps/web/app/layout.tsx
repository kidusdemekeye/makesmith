import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Makesmith — Build the thing you imagine',
  description: 'Turn a hardware idea into a clear, researched build plan.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
