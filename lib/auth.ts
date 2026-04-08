import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { AppRole, CROSS_UNIT_ROLES, hasPermission } from './access-control'

type TokenPayload = {
  sub: string
  username: string
  role: AppRole
  unit_id: number | null
}

export type AuthContext = {
  userId: string
  username: string
  role: AppRole
  unitId: number | null
}

const JWT_COOKIE_NAME = 'auth_token'
const JWT_EXPIRES_IN = '8h'

function getJwtSecret() {
  return process.env.JWT_SECRET || 'genio-dev-secret-change-me'
}

function parseCookieValue(rawCookie: string, name: string) {
  const parts = rawCookie.split(';').map((v) => v.trim())
  const cookie = parts.find((v) => v.startsWith(`${name}=`))
  if (!cookie) return null
  return cookie.slice(name.length + 1)
}

function getTokenFromRequest(req: Request) {
  const cookieHeader = req.headers.get('cookie') || ''
  return parseCookieValue(cookieHeader, JWT_COOKIE_NAME)
}

export function issueAuthToken(user: {
  id: string
  username: string
  role: AppRole
  unit_id: number | null
}) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      unit_id: user.unit_id,
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN },
  )
}

export function setAuthCookie(res: NextResponse, token: string) {
  const isProd = process.env.NODE_ENV === 'production'
  res.cookies.set(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 60 * 60 * 8,
  })
}

export function clearAuthCookie(res: NextResponse) {
  const isProd = process.env.NODE_ENV === 'production'
  res.cookies.set(JWT_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 0,
  })
}

function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getJwtSecret()) as TokenPayload
}

export function requireAuth(req: Request, allowedRoles?: AppRole[]) {
  const token = getTokenFromRequest(req)

  if (!token) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  try {
    const decoded = verifyToken(token)

    const auth: AuthContext = {
      userId: decoded.sub,
      username: decoded.username,
      role: decoded.role,
      unitId: decoded.unit_id ?? null,
    }

    if (allowedRoles && !allowedRoles.includes(auth.role)) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      }
    }

    return {
      ok: true as const,
      auth,
    }
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Invalid token' }, { status: 401 }),
    }
  }
}

export function canAccessUnit(auth: AuthContext, unitId: number) {
  if (CROSS_UNIT_ROLES.includes(auth.role)) {
    return true
  }

  return auth.unitId === unitId
}

export function canAccessPermission(role: AppRole, permission: Parameters<typeof hasPermission>[1]) {
  return hasPermission(role, permission)
}
