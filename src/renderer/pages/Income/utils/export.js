import ExcelJS from 'exceljs'

export const exportToExcel = async (reservations, dateRange) => {
  // Filter reservations by date range
  const filteredReservations = reservations.filter(r => {
    const reservationDate = new Date(r.createdAt)
    const startDate = new Date(dateRange.startDate)
    const endDate = new Date(dateRange.endDate)
    endDate.setHours(23, 59, 59, 999)
    
    return reservationDate >= startDate && reservationDate <= endDate
  })

  if (filteredReservations.length === 0) {
    alert('No transactions found in the selected period')
    return
  }

  // Calculate summary statistics
  const paidReservations = filteredReservations.filter(r => r.paymentStatus?.toLowerCase() === 'paid')
  const pendingReservations = filteredReservations.filter(r => r.paymentStatus?.toLowerCase() === 'pending')
  const cancelledReservations = filteredReservations.filter(r => r.paymentStatus?.toLowerCase() === 'cancelled')
  
  const totalIncome = paidReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
  const pendingAmount = pendingReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
  const cancelledAmount = cancelledReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
  
  // Format dates for display
  const startDate = new Date(dateRange.startDate).toLocaleDateString('en-US', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  })
  const endDate = new Date(dateRange.endDate).toLocaleDateString('en-US', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  })
  
  // Sort reservations by date (newest first)
  const sortedReservations = [...filteredReservations].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  )
  
  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Income Report', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }
  })
  
  // Set column widths
  worksheet.columns = [
    { width: 14 },   // A - No.
    { width: 14 },  // B - Date
    { width: 24 },  // C - Homeowner
    { width: 24 },  // D - Facility
    { width: 16 },  // E - Amount
    { width: 18 },  // F - Payment Status
    { width: 18 }   // G - Reservation Status
  ]
  
  let currentRow = 1
  
  // ============ HEADER ============
  const titleRow = worksheet.getRow(currentRow++)
  titleRow.getCell(1).value = 'HOMEOWNERS ASSOCIATION'
  titleRow.getCell(1).font = { size: 16, bold: true, color: { argb: 'FF1f2937' } }
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
  titleRow.height = 24
  
  const subtitleRow = worksheet.getRow(currentRow++)
  subtitleRow.getCell(1).value = 'Income Report'
  subtitleRow.getCell(1).font = { size: 13, color: { argb: 'FF4b5563' } }
  subtitleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
  
  currentRow++ // Empty row
  
  const infoRow1 = worksheet.getRow(currentRow++)
  infoRow1.getCell(1).value = 'Report Period:'
  infoRow1.getCell(2).value = `${startDate} to ${endDate}`
  infoRow1.getCell(1).font = { bold: true, size: 10 }
  infoRow1.getCell(2).font = { size: 10 }
  
  const infoRow2 = worksheet.getRow(currentRow++)
  infoRow2.getCell(1).value = 'Generated:'
  infoRow2.getCell(2).value = new Date().toLocaleString('en-US', { 
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  })
  infoRow2.getCell(1).font = { bold: true, size: 10 }
  infoRow2.getCell(2).font = { size: 10 }
  
  currentRow++ // Empty row
  currentRow++ // Empty row
  
  // ============ SUMMARY SECTION ============
  const summaryStartRow = currentRow
  
  const summaryRow = worksheet.getRow(currentRow++)
  summaryRow.getCell(1).value = 'SUMMARY'
  summaryRow.getCell(1).font = { size: 12, bold: true, color: { argb: 'FF1f2937' } }
  summaryRow.height = 22
  
  currentRow++ // Empty row
  
  // Summary table header
  const summaryHeaderRow = worksheet.getRow(currentRow++)
  summaryHeaderRow.values = ['', 'Status', 'Count', 'Amount']
  summaryHeaderRow.font = { bold: true, size: 10 }
  summaryHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFf3f4f6' }
  }
  summaryHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' }
  summaryHeaderRow.height = 22
  
  for (let col = 2; col <= 4; col++) {
    summaryHeaderRow.getCell(col).border = {
      top: { style: 'thin', color: { argb: 'FFd1d5db' } },
      bottom: { style: 'thin', color: { argb: 'FFd1d5db' } },
      left: { style: 'thin', color: { argb: 'FFd1d5db' } },
      right: { style: 'thin', color: { argb: 'FFd1d5db' } }
    }
  }
  
  // Summary data
  const summaryData = [
    { label: 'Paid', count: paidReservations.length, amount: totalIncome },
    { label: 'Pending', count: pendingReservations.length, amount: pendingAmount },
    { label: 'Cancelled', count: cancelledReservations.length, amount: cancelledAmount }
  ]
  
  summaryData.forEach(item => {
    const row = worksheet.getRow(currentRow++)
    row.values = ['', item.label, item.count, item.amount]
    row.getCell(2).font = { size: 10 }
    row.getCell(3).font = { size: 10 }
    row.getCell(3).alignment = { horizontal: 'center' }
    row.getCell(4).numFmt = '₱#,##0.00'
    row.getCell(4).alignment = { horizontal: 'right' }
    row.getCell(4).font = { size: 10 }
    row.height = 20
    
    for (let col = 2; col <= 4; col++) {
      row.getCell(col).border = {
        top: { style: 'thin', color: { argb: 'FFe5e7eb' } },
        bottom: { style: 'thin', color: { argb: 'FFe5e7eb' } },
        left: { style: 'thin', color: { argb: 'FFe5e7eb' } },
        right: { style: 'thin', color: { argb: 'FFe5e7eb' } }
      }
    }
  })
  
  // Total row
  const totalRow = worksheet.getRow(currentRow++)
  totalRow.values = ['', 'TOTAL', filteredReservations.length, totalIncome + pendingAmount]
  totalRow.font = { bold: true, size: 10 }
  totalRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFe5e7eb' }
  }
  totalRow.getCell(3).alignment = { horizontal: 'center' }
  totalRow.getCell(4).numFmt = '₱#,##0.00'
  totalRow.getCell(4).alignment = { horizontal: 'right' }
  totalRow.height = 22
  
  for (let col = 2; col <= 4; col++) {
    totalRow.getCell(col).border = {
      top: { style: 'medium', color: { argb: 'FF9ca3af' } },
      bottom: { style: 'medium', color: { argb: 'FF9ca3af' } },
      left: { style: 'thin', color: { argb: 'FFd1d5db' } },
      right: { style: 'thin', color: { argb: 'FFd1d5db' } }
    }
  }
  
  currentRow++ // Empty row
  currentRow++ // Empty row
  currentRow++ // Empty row
  
  // ============ TRANSACTIONS TABLE ============
  const transStartRow = currentRow
  
  const transRow = worksheet.getRow(currentRow++)
  transRow.getCell(1).value = 'TRANSACTION DETAILS'
  transRow.getCell(1).font = { size: 12, bold: true, color: { argb: 'FF1f2937' } }
  transRow.height = 22
  
  currentRow++ // Empty row
  
  // Transaction header
  const transHeaderRow = worksheet.getRow(currentRow++)
  transHeaderRow.values = ['No.', 'Date', 'Homeowner', 'Facility', 'Amount', 'Payment Status', 'Reservation Status']
  transHeaderRow.font = { bold: true, size: 10, color: { argb: 'FF1f2937' } }
  transHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFf3f4f6' }
  }
  transHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' }
  transHeaderRow.height = 24
  
  transHeaderRow.eachCell((cell, colNumber) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFd1d5db' } },
      bottom: { style: 'thin', color: { argb: 'FFd1d5db' } },
      left: { style: 'thin', color: { argb: 'FFd1d5db' } },
      right: { style: 'thin', color: { argb: 'FFd1d5db' } }
    }
  })
  
  // Transaction data rows
  sortedReservations.forEach((r, index) => {
    const row = worksheet.getRow(currentRow++)
    row.values = [
      index + 1,
      new Date(r.createdAt).toLocaleDateString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric' 
      }),
      r.homeownerName || 'N/A',
      r.facilityName || 'N/A',
      r.totalAmount || 0,
      r.paymentStatus || 'N/A',
      r.status || 'N/A'
    ]
    
    row.height = 20
    row.font = { size: 10 }
    
    // Alternating row colors
    if (index % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFfafafa' }
      }
    }
    
    row.getCell(1).alignment = { horizontal: 'center' }
    row.getCell(2).alignment = { horizontal: 'center' }
    row.getCell(5).numFmt = '₱#,##0.00'
    row.getCell(5).alignment = { horizontal: 'right' }
    row.getCell(6).alignment = { horizontal: 'center' }
    row.getCell(7).alignment = { horizontal: 'center' }
    
    // Payment status formatting
    const paymentStatus = r.paymentStatus?.toLowerCase()
    if (paymentStatus === 'Paid') {
      row.getCell(6).font = { color: { argb: 'FF059669' }, bold: true, size: 10 }
    } else if (paymentStatus === 'Pending') {
      row.getCell(6).font = { color: { argb: 'FFd97706' }, bold: true, size: 10 }
    } else if (paymentStatus === 'Cancelled') {
      row.getCell(6).font = { color: { argb: 'FFdc2626' }, bold: true, size: 10 }
    }
    
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFe5e7eb' } },
        bottom: { style: 'thin', color: { argb: 'FFe5e7eb' } },
        left: { style: 'thin', color: { argb: 'FFe5e7eb' } },
        right: { style: 'thin', color: { argb: 'FFe5e7eb' } }
      }
    })
  })
  
  currentRow++ // Empty row
  currentRow++ // Empty row
  
  // ============ FOOTER ============
  const footerRow = worksheet.getRow(currentRow++)
  footerRow.getCell(1).value = `Total Records: ${filteredReservations.length} transactions`
  footerRow.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF6b7280' } }
  footerRow.getCell(1).alignment = { horizontal: 'center' }
  worksheet.mergeCells(currentRow - 1, 1, currentRow - 1, 7)
  
  const systemRow = worksheet.getRow(currentRow++)
  systemRow.getCell(1).value = 'Homeowners Association Management System'
  systemRow.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF9ca3af' } }
  systemRow.getCell(1).alignment = { horizontal: 'center' }
  worksheet.mergeCells(currentRow - 1, 1, currentRow - 1, 7)
  
  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Income-Report-${dateRange.startDate}-to-${dateRange.endDate}.xlsx`
  a.click()
  window.URL.revokeObjectURL(url)
}

// Keep the old function name for backward compatibility
export const exportToCSV = exportToExcel