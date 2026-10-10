// "YYYY-MM-DD" -> Date in local time (new Date("YYYY-MM-DD") is UTC and shifts the day)
const parseLocalDate = (value) => new Date(`${value}T00:00:00`)

export const filterReservationsByPeriod = (reservations, period) => {
  const now = new Date()

  switch (period) {
    case "week": {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return reservations.filter((r) => new Date(r.createdAt) >= weekAgo)
    }
    case "month": {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return reservations.filter((r) => new Date(r.createdAt) >= monthAgo)
    }
    case "year": {
      const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      return reservations.filter((r) => new Date(r.createdAt) >= yearAgo)
    }
    default:
      return reservations
  }
}

export const applyFilters = (reservations, period, filterStatus, filterDateRange) => {
  let filtered = filterReservationsByPeriod(reservations, period)

  // Filter by PAYMENT status (the column shown on the Income page)
  if (filterStatus && filterStatus !== "all") {
    filtered = filtered.filter((r) => r.paymentStatus?.toLowerCase() === filterStatus)
  }

  // Start of the start day
  if (filterDateRange.start) {
    const start = parseLocalDate(filterDateRange.start)
    filtered = filtered.filter((r) => new Date(r.createdAt) >= start)
  }

  // End of the end day, so transactions made on that day are included
  if (filterDateRange.end) {
    const end = parseLocalDate(filterDateRange.end)
    end.setHours(23, 59, 59, 999)
    filtered = filtered.filter((r) => new Date(r.createdAt) <= end)
  }

  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return filtered
}