export type AppRole =
  | 'BILLER'
  | 'CASHIER'
  | 'SUPERVISOR'
  | 'DEPOSIT_PREPARER'
  | 'RECONCILER'
  | 'FINANCE_MANAGER'
  | 'GENERAL_MANAGER'
  | 'DEPARTMENT_HEAD'
  | 'SUPER_ADMIN'
  | 'AUDITOR'
  | 'MANAGER'

export type AppPermission =
  | 'finance.coa.read'
  | 'finance.coa.write'
  | 'finance.gl.read'
  | 'finance.gl.post'
  | 'finance.period.lock'
  | 'finance.period.close'
  | 'finance.cash.read'
  | 'finance.cash.write'
  | 'finance.bank.reconcile'
  | 'finance.folio.read'
  | 'finance.folio.write'
  | 'finance.folio.void'
  | 'finance.audit.read'
  | 'pos.read'
  | 'pos.write'
  | 'pos.manage'

export type AccessUser = {
  role: AppRole
  unitId?: number | null
}

export const FINANCE_ROLES: AppRole[] = [
  'BILLER',
  'CASHIER',
  'SUPERVISOR',
  'DEPOSIT_PREPARER',
  'RECONCILER',
  'FINANCE_MANAGER',
  'GENERAL_MANAGER',
  'DEPARTMENT_HEAD',
  'SUPER_ADMIN',
  'AUDITOR',
]

export const CROSS_UNIT_ROLES: AppRole[] = [
  'SUPER_ADMIN',
  'FINANCE_MANAGER',
  'RECONCILER',
  'GENERAL_MANAGER',
  'AUDITOR',
]

export const POS_ROLES: AppRole[] = ['CASHIER', 'MANAGER', 'SUPER_ADMIN', 'AUDITOR']

export const ROLE_PERMISSION_MATRIX: Record<AppRole, AppPermission[]> = {
  BILLER: ['finance.folio.read', 'finance.folio.write'],
  CASHIER: ['finance.cash.read', 'finance.cash.write', 'finance.folio.read'],
  SUPERVISOR: ['finance.cash.read', 'finance.folio.read', 'finance.folio.void', 'pos.manage'],
  DEPOSIT_PREPARER: ['finance.cash.read', 'finance.cash.write'],
  RECONCILER: ['finance.gl.read', 'finance.bank.reconcile', 'finance.audit.read'],
  FINANCE_MANAGER: [
    'finance.coa.read',
    'finance.coa.write',
    'finance.gl.read',
    'finance.gl.post',
    'finance.period.lock',
    'finance.period.close',
    'finance.cash.read',
    'finance.cash.write',
    'finance.bank.reconcile',
    'finance.folio.read',
    'finance.folio.write',
    'finance.folio.void',
    'finance.audit.read',
  ],
  GENERAL_MANAGER: ['finance.coa.read', 'finance.gl.read', 'finance.audit.read'],
  DEPARTMENT_HEAD: ['finance.coa.read', 'finance.gl.read', 'finance.folio.read'],
  SUPER_ADMIN: [
    'finance.coa.read',
    'finance.coa.write',
    'finance.gl.read',
    'finance.gl.post',
    'finance.period.lock',
    'finance.period.close',
    'finance.cash.read',
    'finance.cash.write',
    'finance.bank.reconcile',
    'finance.folio.read',
    'finance.folio.write',
    'finance.folio.void',
    'finance.audit.read',
    'pos.read',
    'pos.write',
    'pos.manage',
  ],
  AUDITOR: ['finance.coa.read', 'finance.gl.read', 'finance.audit.read', 'pos.read'],
  MANAGER: ['pos.read', 'pos.write', 'pos.manage'],
}

export function isFinanceRole(role: AppRole, unitId?: number | null) {
  if (role === 'CASHIER') {
    return unitId == null
  }

  return FINANCE_ROLES.includes(role)
}

export function hasPermission(role: AppRole, permission: AppPermission) {
  return ROLE_PERMISSION_MATRIX[role]?.includes(permission) ?? false
}

export function getHomeRoute(user: AccessUser) {
  if (isFinanceRole(user.role, user.unitId)) {
    return '/finance'
  }

  if (user.role === 'MANAGER') {
    return user.unitId === 2 ? '/pos/restaurant/manager' : '/pos/cafe/manager'
  }

  if (user.role === 'CASHIER') {
    return user.unitId === 2 ? '/pos/restaurant' : '/pos/cafe'
  }

  return '/pos/cafe'
}