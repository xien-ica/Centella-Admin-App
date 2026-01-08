// Cache for formatted dates to avoid re-formatting
const dateCache = new Map()
const DATE_CACHE_SIZE = 100

export const formatDate = (dateStr) => {
  if (dateCache.has(dateStr)) {
    return dateCache.get(dateStr)
  }
  
  const date = new Date(dateStr)
  const formatted = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  })
  
  // Limit cache size to prevent memory leaks
  if (dateCache.size >= DATE_CACHE_SIZE) {
    const firstKey = dateCache.keys().next().value
    dateCache.delete(firstKey)
  }
  
  dateCache.set(dateStr, formatted)
  return formatted
}

export const formatTime = (timeStr) => {
  // Extract hours and minutes from time string (e.g., "09:00:00" or "09:00")
  const [hours, minutes] = timeStr.split(':').map(Number)
  
  // Convert to 12-hour format
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12 // Convert 0 to 12 for midnight
  
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`
}

// Optimized grouping with better performance
export const groupReservationsByUser = (reservations) => {
  if (!reservations || reservations.length === 0) {
    return {}
  }

  const groups = {}
  
  for (let i = 0; i < reservations.length; i++) {
    const reservation = reservations[i]
    const userId = reservation.user_id
    
    if (!groups[userId]) {
      groups[userId] = {
        userName: `${reservation.residents.first_name} ${reservation.residents.last_name}`,
        goodStanding: reservation.residents.good_standing,
        reservations: []
      }
    }
    
    groups[userId].reservations.push(reservation)
  }
  
  return groups
}

export const filterReservations = (reservations, filter) => {
  if (!reservations || reservations.length === 0) {
    return []
  }
  
  switch (filter) {
    case 'pending':
      return reservations.filter(r => r.status === 'pending')
    case 'approved':
      return reservations.filter(r => r.status === 'confirmed')
    case 'rejected':
      return reservations.filter(r => r.status === 'rejected')
    case 'cancelled':
      return reservations.filter(r => r.status === 'cancelled')
    case 'completed':
      return reservations.filter(r => r.status === 'completed')
    default:
      return reservations
  }
}

// Helper to calculate statistics for a group
export const calculateGroupStats = (reservations, goodStanding) => {
  let pendingCount = 0
  let totalAmount = 0
  
  for (let i = 0; i < reservations.length; i++) {
    if (reservations[i].status === 'pending') {
      pendingCount++
    }
    if (!goodStanding) {
      totalAmount += parseFloat(reservations[i].total_amount)
    }
  }
  
  return { pendingCount, totalAmount }
}

// Clear caches if needed
export const clearCaches = () => {
  dateCache.clear()
}