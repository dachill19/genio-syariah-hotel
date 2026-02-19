import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import ExcelJS from 'exceljs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const unitId = searchParams.get('unitId')

  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 })
  }

  const queryDate = date

  try {
    const pool = await getDb()

    let whereClause = "WHERE DATE(created_at) = $1 AND status != 'CANCELLED'"
    const params = [queryDate]

    if (unitId) {
      whereClause += ` AND unit_id = $${params.length + 1}`
      params.push(unitId)
    }

    const summaryQuery = `
        SELECT
            COUNT(*) as total_transactions,
            COALESCE(SUM(grand_total), 0) as total_sales,
            SUM(CASE WHEN payment_method = 'CASH' THEN 1 ELSE 0 END) as cash_count,
            SUM(CASE WHEN payment_method = 'QRIS' THEN 1 ELSE 0 END) as qris_count,
            COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN grand_total ELSE 0 END), 0) as cash_total,
            COALESCE(SUM(CASE WHEN payment_method = 'QRIS' THEN grand_total ELSE 0 END), 0) as qris_total
        FROM orders
        ${whereClause}
    `

    const transactionsQuery = `
        SELECT o.*, COALESCE(o.cashier_name, u.username) as cashier_name,
             coalesce(
               json_agg(
                 json_build_object(
                   'name', oi.name,
                   'qty', oi.qty
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), 
               '[]'
             ) as items
        FROM orders o
        LEFT JOIN orders_items oi ON o.id = oi.order_id
        LEFT JOIN users u ON o.user_id = u.id
        WHERE DATE(o.created_at) = $1 
        GROUP BY o.id, u.username
        ORDER BY o.created_at ASC
    `

    const summaryRes = await pool.query(summaryQuery, [queryDate])
    const transactionsRes = await pool.query(transactionsQuery, [queryDate])

    const summary = summaryRes.rows[0]
    const transactions = transactionsRes.rows

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'POS Cafe System'
    workbook.created = new Date()

    const sheetSummary = workbook.addWorksheet('Detail Laporan')
    sheetSummary.columns = [
      { header: 'Keterangan', key: 'label', width: 30 },
      { header: 'Nilai', key: 'value', width: 25 },
    ]
    ;['A1', 'B1'].forEach((cellAddr) => {
      const cell = sheetSummary.getCell(cellAddr)
      cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    sheetSummary.getRow(1).height = 25

    sheetSummary.addRows([
      { label: 'Tanggal Laporan', value: queryDate },
      { label: 'Total Transaksi', value: parseInt(summary.total_transactions) || 0 },
      { label: 'Total Penjualan (Omzet)', value: parseInt(summary.total_sales) || 0 },
      { label: '', value: '' },
      { label: 'Transaksi Cash', value: parseInt(summary.cash_count) || 0 },
      { label: 'Total Uang Cash', value: parseInt(summary.cash_total) || 0 },
      { label: '', value: '' },
      { label: 'Transaksi QRIS', value: parseInt(summary.qris_count) || 0 },
      { label: 'Total Uang QRIS', value: parseInt(summary.qris_total) || 0 },
    ])
    ;[3, 6, 9].forEach((rowNum) => {
      const cell = sheetSummary.getCell(`B${rowNum + 1}`)
      cell.numFmt = 'Rp #,##0'
      cell.font = { bold: true }
    })

    const sheetDetail = workbook.addWorksheet('Detail Transaksi')
    sheetDetail.columns = [
      { header: 'Jam', key: 'time', width: 12 },
      { header: 'No Invoice', key: 'invoice', width: 22 },
      { header: 'Staff', key: 'staff', width: 18 },
      { header: 'Item', key: 'items', width: 45 },
      { header: 'Metode', key: 'method', width: 12 },
      { header: 'Total', key: 'total', width: 18 },
    ]
    ;['A1', 'B1', 'C1', 'D1', 'E1', 'F1'].forEach((cellAddr) => {
      const cell = sheetDetail.getCell(cellAddr)
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    sheetDetail.getRow(1).height = 25

    transactions.forEach((trx: any) => {
      let itemsString = ''
      try {
        const items = trx.items || []
        itemsString = items.map((i: any) => `${i.name} (${i.qty})`).join(', ')
      } catch (e) {
        itemsString = 'Error Data'
      }

      sheetDetail.addRow({
        time: new Date(trx.created_at).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        invoice: trx.invoice_number,
        staff: trx.cashier_name || '-',
        items: itemsString,
        method: trx.payment_method,
        total: trx.grand_total,
      })
    })

    // Formatting currency column
    sheetDetail.getColumn(6).numFmt = 'Rp #,##0'

    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Laporan_${queryDate}.xlsx"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
