/**
 * Overview Data Service
 * All data fetching functions for the Overview dashboard
 * This avoids conflicts with existing service files
 */

import { supabase } from '../../utils/supabase'

// ==================== RESIDENTS ====================

/**
 * Get count of all verified residents
 * @returns {Promise<number>} Count of verified residents
 */
export const getVerifiedResidentsCount = async () => {
  try {
    const { count, error } = await supabase
      .from('residents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'verified')

    if (error) throw error
    return count || 0
  } catch (error) {
    console.error('Error fetching verified residents count:', error)
    throw error
  }
}

/**
 * Get recently registered unverified residents
 * @param {number} limit - Number of residents to fetch
 * @returns {Promise<Array>} Array of unverified residents
 */
export const getRecentUnverifiedResidents = async (limit = 5) => {
  try {
    const { data, error } = await supabase
      .from('residents')
      .select('id, account_id, first_name, middle_initial, last_name, created_at, status')
      .eq('status', 'unverified')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching recent unverified residents:', error)
    throw error
  }
}

// ==================== RESERVATIONS ====================

/**
 * Get today's reservations with facility and user details
 * Includes all statuses (confirmed, pending, completed) for current date
 * @returns {Promise<Array>} Array of today's reservations
 */
export const getTodayReservations = async () => {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id,
        reservation_date,
        start_time,
        end_time,
        purpose,
        status,
        facility_id,
        facilities (
          id,
          name,
          icon
        ),
        user_id,
        residents (
          id,
          first_name,
          middle_initial,
          last_name
        )
      `)
      .eq('reservation_date', today)
      .in('status', ['confirmed', 'pending', 'completed'])
      .order('start_time', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching today\'s reservations:', error)
    throw error
  }
}

/**
 * Get reservation counts by facility for the current month
 * @returns {Promise<Object>} Object with reserved and available counts per facility
 */
export const getFacilityReservationCounts = async () => {
  try {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    
    // Calculate total days in current month
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    // Get all facilities
    const { data: facilities, error: facilitiesError } = await supabase
      .from('facilities')
      .select('id, name')

    if (facilitiesError) throw facilitiesError

    // Get this month's reservations count per facility
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('facility_id, reservation_date')
      .gte('reservation_date', firstDay)
      .lte('reservation_date', lastDay)
      .in('status', ['confirmed', 'pending', 'completed'])

    if (reservationsError) throw reservationsError

    // Calculate counts - count unique days reserved per facility
    const facilityCounts = {}

    facilities.forEach(facility => {
      // Get unique dates for this facility
      const facilityReservations = reservations.filter(r => r.facility_id === facility.id)
      const uniqueDates = [...new Set(facilityReservations.map(r => r.reservation_date))]
      const reserved = uniqueDates.length
      
      const facilityKey = facility.name.toLowerCase().replace(/[^a-z]/g, '')
      facilityCounts[facilityKey] = {
        reserved,
        available: daysInMonth - reserved
      }
    })

    return facilityCounts
  } catch (error) {
    console.error('Error fetching facility reservation counts:', error)
    throw error
  }
}

/**
 * Get total monthly income from paid reservations
 * @returns {Promise<number>} Total income for current month
 */
export const getMonthlyIncome = async () => {
  try {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('reservations')
      .select('total_amount')
      .eq('payment_status', 'paid')
      .gte('reservation_date', firstDay)
      .lte('reservation_date', lastDay)

    if (error) throw error

    const total = data.reduce((sum, reservation) => sum + parseFloat(reservation.total_amount), 0)
    return total
  } catch (error) {
    console.error('Error fetching monthly income:', error)
    throw error
  }
}

// ==================== ANNOUNCEMENTS ====================

/**
 * Get latest published announcements for Overview dashboard
 * Note: We exclude 'views' field to prevent unnecessary real-time updates
 * when users view announcements (views changes don't affect the Overview display)
 * @param {number} limit - Number of announcements to fetch
 * @returns {Promise<Array>} Array of announcements
 */
export const getLatestAnnouncementsForOverview = async (limit = 3) => {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, content, category, created_at, published_at, image_url')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching latest announcements for overview:', error)
    throw error
  }
}