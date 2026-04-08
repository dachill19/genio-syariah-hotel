import { Pool, PoolClient } from 'pg'

type PostingAccounts = {
  debitAccountCode: string
  creditAccountCode: string
}

export async function resolvePostingAccounts(
  db: Pool | PoolClient,
  moduleCode: string,
  eventCode: string,
  keyCode: string,
): Promise<PostingAccounts> {
  const exactRes = await db.query(
    `
      SELECT debit_account_code, credit_account_code
      FROM posting_account_mappings
      WHERE module_code = $1
        AND event_code = $2
        AND key_code = $3
        AND is_active = true
      LIMIT 1
    `,
    [moduleCode, eventCode, keyCode],
  )

  const exact = exactRes.rows[0]
  if (exact?.debit_account_code && exact?.credit_account_code) {
    return {
      debitAccountCode: exact.debit_account_code,
      creditAccountCode: exact.credit_account_code,
    }
  }

  const fallbackRes = await db.query(
    `
      SELECT debit_account_code, credit_account_code
      FROM posting_account_mappings
      WHERE module_code = $1
        AND event_code = $2
        AND key_code = '*'
        AND is_active = true
      LIMIT 1
    `,
    [moduleCode, eventCode],
  )

  const fallback = fallbackRes.rows[0]
  if (fallback?.debit_account_code && fallback?.credit_account_code) {
    return {
      debitAccountCode: fallback.debit_account_code,
      creditAccountCode: fallback.credit_account_code,
    }
  }

  throw new Error(`Posting account mapping not found for ${moduleCode}/${eventCode}/${keyCode}`)
}