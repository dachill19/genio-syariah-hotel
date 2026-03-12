import { RouteGuard } from '@/components/auth/route-guard'

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <RouteGuard>{children}</RouteGuard>
}
