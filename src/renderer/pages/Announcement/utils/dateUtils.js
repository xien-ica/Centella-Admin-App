// Date and time utilities
export const getQuickDate = (type) => {
  const now = new Date()
  const result = new Date()
  
  switch (type) {
    case 'tomorrow':
      result.setDate(now.getDate() + 1)
      result.setHours(9, 0, 0, 0) // 9:00 AM
      break
    case 'nextWeek':
      result.setDate(now.getDate() + 7)
      result.setHours(9, 0, 0, 0) // 9:00 AM
      break
    case 'nextMonth':
      result.setMonth(now.getMonth() + 1)
      result.setHours(9, 0, 0, 0) // 9:00 AM
      break
    default:
      return ""
  }
  
  return result.toISOString().slice(0, 16)
}

export const formatScheduledDateTime = (date, time) => {
  if (!date || !time) return ""
  
  try {
    const scheduledDate = new Date(`${date}T${time}`)
    return scheduledDate.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  } catch (_error) {
    return "Invalid date"
  }
}

export const getTodayDateString = () => {
  return new Date().toISOString().slice(0, 10)
}
