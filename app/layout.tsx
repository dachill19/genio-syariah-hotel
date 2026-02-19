import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { OrderProvider } from '@/context/order-context'
import { AuthProvider } from '@/context/auth-context'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'POS Application',
  description: 'Next.js POS System',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <OrderProvider>
          <AuthProvider>{children}</AuthProvider>
        </OrderProvider>
      </body>
    </html>
  )
}
