// hoa/src/renderer/utils/reservationUtils.js

// Helper to create a date object in local timezone from YYYY-MM-DD string
const parseLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// Helper to format date to YYYY-MM-DD in local timezone
const formatDateToString = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Get reservations for a specific date
export const getReservationsForDate = (date, reservations) => {
  if (!date) return []
  
  const dateString = formatDateToString(date)
  
  return reservations.filter(reservation => {
    return reservation.date === dateString
  })
}

// Get today's reservations
export const getTodayReservations = (reservations) => {
  const today = new Date()
  return getReservationsForDate(today, reservations)
}

// Get this week's reservations
export const getThisWeekReservations = (reservations) => {
  const today = new Date()
  const todayString = formatDateToString(today)
  
  const weekFromNow = new Date(today)
  weekFromNow.setDate(weekFromNow.getDate() + 7)
  const weekFromNowString = formatDateToString(weekFromNow)
  
  return reservations.filter(reservation => {
    return reservation.date >= todayString && reservation.date <= weekFromNowString
  })
}

// Get next month's reservations (excluding this week)
export const getNextMonthReservations = (reservations) => {
  const today = new Date()
  
  // Start date: 8 days from now (after this week)
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() + 8)
  const startDateString = formatDateToString(startDate)
  
  // End date: 1 month from today
  const nextMonth = new Date(today)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const nextMonthString = formatDateToString(nextMonth)
  
  return reservations.filter(reservation => {
    return reservation.date >= startDateString && reservation.date <= nextMonthString
  })
}

// Get CSS class for reservation status
export const getStatusClass = (status, styles) => {
  const statusMap = {
    pending: styles.statusPending,
    confirmed: styles.statusConfirmed,
    cancelled: styles.statusCancelled,
    completed: styles.statusCompleted,
  }
  return statusMap[status?.toLowerCase()] || ''
}