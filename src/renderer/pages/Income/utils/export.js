import ExcelJS from 'exceljs'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

const ORG_NAME = 'HOMEOWNERS ASSOCIATION'
const SYSTEM_NAME = 'Homeowners Association Management System'

// Treat "YYYY-MM-DD" as a local date (avoids off-by-one timezone issues)
const parseDate = (value) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`)
  }
  return new Date(value)
}

const fmtLong = (d) =>
  parseDate(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

const fmtShort = (d) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

const fmtGenerated = () =>
  new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : 'N/A')

// PDF default fonts don't include the ₱ glyph, so the PDF uses "PHP"
const money = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const filterByRange = (reservations, dateRange) => {
  const start = parseDate(dateRange.startDate)
  const end = parseDate(dateRange.endDate)
  end.setHours(23, 59, 59, 999)
  return reservations.filter((r) => {
    const d = new Date(r.createdAt)
    return d >= start && d <= end
  })
}

const buildReport = (reservations, dateRange) => {
  const rows = filterByRange(reservations, dateRange).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  )

  const group = (status) => {
    const items = rows.filter((r) => r.paymentStatus?.toLowerCase() === status)
    return { count: items.length, amount: items.reduce((s, r) => s + (r.totalAmount || 0), 0) }
  }

  const paid = group('paid')
  const pending = group('pending')
  const cancelled = group('cancelled')
  const refunded = group('refunded')

  return {
    rows,
    paid,
    pending,
    cancelled,
    refunded,
    // Cancelled / refunded are excluded from the total
    total: {
      count: paid.count + pending.count,
      amount: paid.amount + pending.amount,
    },
    periodText: `${fmtLong(dateRange.startDate)} to ${fmtLong(dateRange.endDate)}`,
  }
}

const triggerDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.URL.revokeObjectURL(url)
}

/* ------------------------------------------------------------------ */
/* Status colour palette (hex without #)                               */
/* ------------------------------------------------------------------ */

const STATUS_COLORS = {
  paid:      { bg: 'D1FAE5', fg: '065F46' },
  completed: { bg: 'D1FAE5', fg: '065F46' },
  confirmed: { bg: 'DBEAFE', fg: '1E40AF' },
  pending:   { bg: 'FEF3C7', fg: '92400E' },
  cancelled: { bg: 'FEE2E2', fg: '991B1B' },
  refunded:  { bg: 'E0E7FF', fg: '3730A3' },
}
const getStatusColor = (s) => STATUS_COLORS[s?.toLowerCase()] || { bg: 'F3F4F6', fg: '374151' }
const hexToRgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))

/* ------------------------------------------------------------------ */
/* EXCEL                                                               */
/* ------------------------------------------------------------------ */

export const exportToExcel = async (reservations, dateRange) => {
  const report = buildReport(reservations, dateRange)

  if (report.rows.length === 0) {
    alert('No transactions found in the selected period')
    return
  }

  const C = {
    dark: 'FF111827',
    darkSoft: 'FF1F2937',
    green: 'FF059669',
    blue: 'FF2563EB',
    amber: 'FFD97706',
    gray50: 'FFF9FAFB',
    gray100: 'FFF3F4F6',
    gray200: 'FFE5E7EB',
    gray500: 'FF6B7280',
    gray700: 'FF374151',
    white: 'FFFFFFFF',
  }
  const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
  const border = (argb = C.gray200, style = 'thin') => ({
    top: { style, color: { argb } },
    bottom: { style, color: { argb } },
    left: { style, color: { argb } },
    right: { style, color: { argb } },
  })
  const FONT = 'Calibri'

  const workbook = new ExcelJS.Workbook()
  workbook.creator = SYSTEM_NAME
  workbook.created = new Date()

  const ws = workbook.addWorksheet('Income Report', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: { oddFooter: '&L&8' + SYSTEM_NAME + '&R&8Page &P of &N' },
  })

  ws.columns = [
    { width: 7 },  // A  No.
    { width: 16 }, // B  Date
    { width: 26 }, // C  Homeowner
    { width: 26 }, // D  Facility
    { width: 16 }, // E  Amount
    { width: 18 }, // F  Payment Status
    { width: 20 }, // G  Reservation Status
  ]
  const LAST_COL = 7

  const mergedCell = (row, c1, c2) => {
    ws.mergeCells(row, c1, row, c2)
    return ws.getCell(row, c1)
  }

  let r = 1

  /* ---------- Banner ---------- */
  for (let c = 1; c <= LAST_COL; c++) {
    ws.getCell(r, c).fill = fill(C.dark)
    ws.getCell(r + 1, c).fill = fill(C.dark)
  }
  let cell = mergedCell(r, 1, LAST_COL)
  cell.value = ORG_NAME
  cell.font = { name: FONT, size: 18, bold: true, color: { argb: C.white } }
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(r).height = 36
  r++

  cell = mergedCell(r, 1, LAST_COL)
  cell.value = 'Income Report'
  cell.font = { name: FONT, size: 12, color: { argb: 'FFD1D5DB' } }
  cell.alignment = { vertical: 'top', horizontal: 'left', indent: 1 }
  ws.getRow(r).height = 24
  r += 2

  /* ---------- Report info ---------- */
  const infoRow = (label, value) => {
    const l = mergedCell(r, 1, 2)
    l.value = label
    l.font = { name: FONT, size: 10, bold: true, color: { argb: C.gray500 } }
    l.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    const v = mergedCell(r, 3, LAST_COL)
    v.value = value
    v.font = { name: FONT, size: 10, color: { argb: C.dark } }
    v.alignment = { vertical: 'middle', horizontal: 'left' }
    ws.getRow(r).height = 18
    r++
  }
  infoRow('Report Period', report.periodText)
  infoRow('Generated', fmtGenerated())
  r++

  /* ---------- KPI cards ---------- */
  const cards = [
    { c1: 1, c2: 3, label: 'TOTAL INCOME (PAID)', value: report.paid.amount, sub: `${report.paid.count} paid reservations`, color: C.green },
    { c1: 4, c2: 5, label: 'PENDING PAYMENTS', value: report.pending.amount, sub: `${report.pending.count} pending`, color: C.amber },
    { c1: 6, c2: 7, label: 'TRANSACTIONS', value: report.rows.length, sub: 'in this period', color: C.blue, plain: true },
  ]
  const kpiTop = r
  cards.forEach((k) => {
    for (let rr = kpiTop; rr < kpiTop + 3; rr++) {
      for (let c = k.c1; c <= k.c2; c++) {
        const cl = ws.getCell(rr, c)
        cl.fill = fill(C.gray50)
        cl.border = {
          left: c === k.c1 ? { style: 'thick', color: { argb: k.color } } : undefined,
          right: c === k.c2 ? { style: 'thin', color: { argb: C.gray200 } } : undefined,
          top: rr === kpiTop ? { style: 'thin', color: { argb: C.gray200 } } : undefined,
          bottom: rr === kpiTop + 2 ? { style: 'thin', color: { argb: C.gray200 } } : undefined,
        }
      }
    }
    const l = mergedCell(kpiTop, k.c1, k.c2)
    l.value = k.label
    l.font = { name: FONT, size: 9, bold: true, color: { argb: C.gray500 } }
    l.alignment = { vertical: 'bottom', horizontal: 'left', indent: 1 }

    const v = mergedCell(kpiTop + 1, k.c1, k.c2)
    v.value = k.value
    if (!k.plain) v.numFmt = '"₱"#,##0.00'
    v.font = { name: FONT, size: 18, bold: true, color: { argb: k.color } }
    v.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

    const s = mergedCell(kpiTop + 2, k.c1, k.c2)
    s.value = k.sub
    s.font = { name: FONT, size: 9, color: { argb: C.gray500 } }
    s.alignment = { vertical: 'top', horizontal: 'left', indent: 1 }
  })
  ws.getRow(kpiTop).height = 20
  ws.getRow(kpiTop + 1).height = 32
  ws.getRow(kpiTop + 2).height = 20
  r = kpiTop + 4

  /* ---------- Section title helper ---------- */
  const sectionTitle = (text) => {
    const c = mergedCell(r, 1, LAST_COL)
    c.value = text
    c.font = { name: FONT, size: 12, bold: true, color: { argb: C.dark } }
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    for (let col = 1; col <= LAST_COL; col++) {
      ws.getCell(r, col).border = { bottom: { style: 'medium', color: { argb: C.dark } } }
    }
    ws.getRow(r).height = 24
    r += 2
  }

  /* ---------- Summary ---------- */
  sectionTitle('SUMMARY')

  const sumHeader = ['Payment Status', 'Count', 'Amount']
  sumHeader.forEach((h, i) => {
    const c = ws.getCell(r, 3 + i)
    c.value = h
    c.font = { name: FONT, size: 10, bold: true, color: { argb: C.white } }
    c.fill = fill(C.darkSoft)
    c.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : i === 1 ? 'center' : 'right', indent: i === 0 || i === 2 ? 1 : 0 }
    c.border = border(C.darkSoft)
  })
  ws.getRow(r).height = 24
  r++

  const summaryRows = [
    { key: 'paid', label: 'Paid', data: report.paid },
    { key: 'pending', label: 'Pending', data: report.pending },
    { key: 'cancelled', label: 'Cancelled (excluded)', data: report.cancelled },
  ]
  if (report.refunded.count > 0) {
    summaryRows.push({ key: 'refunded', label: 'Refunded (excluded)', data: report.refunded })
  }

  summaryRows.forEach((item, i) => {
    const col = getStatusColor(item.key)
    const a = ws.getCell(r, 3)
    a.value = item.label
    a.font = { name: FONT, size: 10, bold: true, color: { argb: `FF${col.fg}` } }
    a.fill = fill(`FF${col.bg}`)
    a.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

    const b = ws.getCell(r, 4)
    b.value = item.data.count
    b.font = { name: FONT, size: 10 }
    b.alignment = { vertical: 'middle', horizontal: 'center' }

    const c = ws.getCell(r, 5)
    c.value = item.data.amount
    c.numFmt = '"₱"#,##0.00'
    c.font = { name: FONT, size: 10 }
    c.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }

    ;[b, c].forEach((x) => { if (i % 2 === 1) x.fill = fill(C.gray50) })
    for (let k = 3; k <= 5; k++) ws.getCell(r, k).border = border()
    ws.getRow(r).height = 20
    r++
  })

  // Total row (Paid + Pending)
  const totals = [
    ['TOTAL (Paid + Pending)', 'left'],
    [report.total.count, 'center'],
    [report.total.amount, 'right'],
  ]
  totals.forEach(([val, align], i) => {
    const c = ws.getCell(r, 3 + i)
    c.value = val
    if (i === 2) c.numFmt = '"₱"#,##0.00'
    c.font = { name: FONT, size: 10, bold: true, color: { argb: C.dark } }
    c.fill = fill(C.gray200)
    c.alignment = { vertical: 'middle', horizontal: align, indent: align === 'center' ? 0 : 1 }
    c.border = {
      top: { style: 'medium', color: { argb: C.dark } },
      bottom: { style: 'medium', color: { argb: C.dark } },
      left: { style: 'thin', color: { argb: C.gray200 } },
      right: { style: 'thin', color: { argb: C.gray200 } },
    }
  })
  ws.getRow(r).height = 24
  r += 3

  /* ---------- Transactions ---------- */
  sectionTitle('TRANSACTION DETAILS')

  const headers = ['No.', 'Date', 'Homeowner', 'Facility', 'Amount', 'Payment Status', 'Reservation Status']
  const headerRowNum = r
  headers.forEach((h, i) => {
    const c = ws.getCell(r, i + 1)
    c.value = h
    c.font = { name: FONT, size: 10, bold: true, color: { argb: C.white } }
    c.fill = fill(C.darkSoft)
    c.alignment = {
      vertical: 'middle',
      horizontal: i === 2 || i === 3 ? 'left' : i === 4 ? 'right' : 'center',
      indent: i === 2 || i === 3 || i === 4 ? 1 : 0,
    }
    c.border = border(C.darkSoft)
  })
  ws.getRow(r).height = 26
  r++

  report.rows.forEach((item, idx) => {
    const zebra = idx % 2 === 1 ? fill(C.gray50) : undefined
    const values = [
      idx + 1,
      fmtShort(item.createdAt),
      item.homeownerName || 'N/A',
      item.facilityName || 'N/A',
      item.totalAmount || 0,
      capitalize(item.paymentStatus),
      capitalize(item.status),
    ]
    values.forEach((val, i) => {
      const c = ws.getCell(r, i + 1)
      c.value = val
      c.font = { name: FONT, size: 10, color: { argb: C.gray700 } }
      c.alignment = {
        vertical: 'middle',
        horizontal: i === 2 || i === 3 ? 'left' : i === 4 ? 'right' : 'center',
        indent: i === 2 || i === 3 || i === 4 ? 1 : 0,
      }
      if (zebra) c.fill = zebra
      c.border = border()
    })
    ws.getCell(r, 5).numFmt = '"₱"#,##0.00'
    ws.getCell(r, 5).font = { name: FONT, size: 10, bold: true, color: { argb: C.dark } }

    // Status "pills"
    ;[
      [6, item.paymentStatus],
      [7, item.status],
    ].forEach(([col, status]) => {
      const sc = getStatusColor(status)
      const c = ws.getCell(r, col)
      c.fill = fill(`FF${sc.bg}`)
      c.font = { name: FONT, size: 10, bold: true, color: { argb: `FF${sc.fg}` } }
    })
    ws.getRow(r).height = 22
    r++
  })

  // Filter dropdowns on the transaction header
  ws.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: r - 1, column: LAST_COL },
  }

  /* ---------- Footer ---------- */
  r += 1
  cell = mergedCell(r, 1, LAST_COL)
  cell.value = `Total Records: ${report.rows.length} transactions`
  cell.font = { name: FONT, size: 9, italic: true, color: { argb: C.gray500 } }
  cell.alignment = { horizontal: 'center' }
  r++
  cell = mergedCell(r, 1, LAST_COL)
  cell.value = SYSTEM_NAME
  cell.font = { name: FONT, size: 9, italic: true, color: { argb: 'FF9CA3AF' } }
  cell.alignment = { horizontal: 'center' }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  triggerDownload(blob, `Income-Report-${dateRange.startDate}-to-${dateRange.endDate}.xlsx`)
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

export const exportToPDF = async (reservations, dateRange) => {
  const report = buildReport(reservations, dateRange)

  if (report.rows.length === 0) {
    alert('No transactions found in the selected period')
    return
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const M = 14
  const contentW = pageW - M * 2

  const DARK = [17, 24, 39]
  const SOFT = [31, 41, 55]
  const GRAY = [107, 114, 128]
  const LIGHT = [249, 250, 251]
  const LINE = [229, 231, 235]

  /* ---------- Banner ---------- */
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageW, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(ORG_NAME, M, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(209, 213, 219)
  doc.text('Income Report', M, 21)

  /* ---------- Report info ---------- */
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GRAY)
  doc.text('REPORT PERIOD', M, 39)
  doc.text('GENERATED', pageW / 2, 39)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...DARK)
  doc.setFontSize(10)
  doc.text(report.periodText, M, 44.5)
  doc.text(fmtGenerated(), pageW / 2, 44.5)

  /* ---------- KPI cards ---------- */
  const gap = 4
  const cardW = (contentW - gap * 2) / 3
  const cardY = 52
  const cardH = 24
  const kpis = [
    { label: 'TOTAL INCOME (PAID)', value: `PHP ${money(report.paid.amount)}`, sub: `${report.paid.count} paid reservations`, color: [5, 150, 105] },
    { label: 'PENDING PAYMENTS', value: `PHP ${money(report.pending.amount)}`, sub: `${report.pending.count} pending`, color: [217, 119, 6] },
    { label: 'TRANSACTIONS', value: String(report.rows.length), sub: 'in this period', color: [37, 99, 235] },
  ]
  kpis.forEach((k, i) => {
    const x = M + i * (cardW + gap)
    doc.setFillColor(...LIGHT)
    doc.setDrawColor(...LINE)
    doc.roundedRect(x, cardY, cardW, cardH, 1.5, 1.5, 'FD')
    doc.setFillColor(...k.color)
    doc.rect(x, cardY, 1.6, cardH, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...GRAY)
    doc.text(k.label, x + 5, cardY + 6.5)
    doc.setFontSize(13)
    doc.setTextColor(...k.color)
    doc.text(k.value, x + 5, cardY + 14.5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text(k.sub, x + 5, cardY + 20)
  })

  /* ---------- Section title helper ---------- */
  const sectionTitle = (text, y) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...DARK)
    doc.text(text, M, y)
    doc.setDrawColor(...DARK)
    doc.setLineWidth(0.5)
    doc.line(M, y + 2, M + contentW, y + 2)
    doc.setLineWidth(0.2)
  }

  /* ---------- Summary table ---------- */
  sectionTitle('SUMMARY', 87)

  const summaryBody = [
    ['Paid', report.paid.count, `PHP ${money(report.paid.amount)}`],
    ['Pending', report.pending.count, `PHP ${money(report.pending.amount)}`],
    ['Cancelled (excluded)', report.cancelled.count, `PHP ${money(report.cancelled.amount)}`],
  ]
  if (report.refunded.count > 0) {
    summaryBody.push(['Refunded (excluded)', report.refunded.count, `PHP ${money(report.refunded.amount)}`])
  }

  autoTable(doc, {
    startY: 92,
    margin: { left: M, right: M },
    tableWidth: 110,
    head: [['Payment Status', 'Count', 'Amount']],
    body: summaryBody,
    foot: [['TOTAL (Paid + Pending)', report.total.count, `PHP ${money(report.total.amount)}`]],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: LINE, lineWidth: 0.2, textColor: DARK },
    headStyles: { fillColor: SOFT, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [229, 231, 235], textColor: DARK, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 40, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'head') {
        if (data.column.index === 1) data.cell.styles.halign = 'center'
        if (data.column.index === 2) data.cell.styles.halign = 'right'
      }
      if (data.section === 'foot') {
        if (data.column.index === 1) data.cell.styles.halign = 'center'
        if (data.column.index === 2) data.cell.styles.halign = 'right'
      }
      if (data.section === 'body' && data.column.index === 0) {
        const key = String(data.cell.raw).split(' ')[0]
        const sc = getStatusColor(key)
        data.cell.styles.fillColor = hexToRgb(sc.bg)
        data.cell.styles.textColor = hexToRgb(sc.fg)
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  /* ---------- Transactions table ---------- */
  const transY = doc.lastAutoTable.finalY + 12
  sectionTitle('TRANSACTION DETAILS', transY)

  autoTable(doc, {
    startY: transY + 5,
    margin: { left: M, right: M, bottom: 16 },
    head: [['No.', 'Date', 'Homeowner', 'Facility', 'Amount', 'Payment', 'Reservation']],
    body: report.rows.map((r, i) => [
      i + 1,
      fmtShort(r.createdAt),
      r.homeownerName || 'N/A',
      r.facilityName || 'N/A',
      `PHP ${money(r.totalAmount)}`,
      capitalize(r.paymentStatus),
      capitalize(r.status),
    ]),
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.4, lineColor: LINE, lineWidth: 0.2, textColor: [55, 65, 81], valign: 'middle' },
    headStyles: { fillColor: SOFT, textColor: 255, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 11, halign: 'center' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 38 },
      3: { cellWidth: 38 },
      4: { cellWidth: 30, halign: 'right', fontStyle: 'bold', textColor: DARK },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 20, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index === 4) data.cell.styles.halign = 'right'
      if (data.section === 'body' && (data.column.index === 5 || data.column.index === 6)) {
        const sc = getStatusColor(data.cell.raw)
        data.cell.styles.fillColor = hexToRgb(sc.bg)
        data.cell.styles.textColor = hexToRgb(sc.fg)
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  /* ---------- Footer on every page ---------- */
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...LINE)
    doc.line(M, pageH - 12, pageW - M, pageH - 12)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text(SYSTEM_NAME, M, pageH - 7)
    doc.text(`Page ${i} of ${pages}`, pageW - M, pageH - 7, { align: 'right' })
    if (i === pages) {
      doc.text(`Total Records: ${report.rows.length} transactions`, pageW / 2, pageH - 7, { align: 'center' })
    }
  }

  doc.save(`Income-Report-${dateRange.startDate}-to-${dateRange.endDate}.pdf`)
}

/* ------------------------------------------------------------------ */
/* Single entry point – PDF is the default                             */
/* ------------------------------------------------------------------ */

export const exportReport = async (reservations, dateRange, format = 'pdf') => {
  if (format === 'excel') return exportToExcel(reservations, dateRange)
  return exportToPDF(reservations, dateRange)
}

// Backward compatibility
export const exportToCSV = exportToExcel