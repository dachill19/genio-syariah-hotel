import { Pool, PoolClient } from 'pg'

type AuditInput = {
  userId: string
  action: string
  tableName?: string
  resource?: string
  recordId?: string | null
  resourceId?: string | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  ipAddress?: string | null
  correlationId?: string | null
  metadata?: Record<string, unknown> | null
}

export async function writeAuditLog(db: Pool | PoolClient, input: AuditInput) {
  const tableName = input.tableName || input.resource
  const recordId = input.recordId ?? input.resourceId ?? null

  await db.query(
    `
      INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        record_id,
        old_value,
        new_value,
        ip_address,
        correlation_id,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      input.userId,
      input.action,
      tableName,
      recordId,
      input.oldValue || null,
      input.newValue || null,
      input.ipAddress || null,
      input.correlationId || null,
      input.metadata || null,
    ],
  )
}
