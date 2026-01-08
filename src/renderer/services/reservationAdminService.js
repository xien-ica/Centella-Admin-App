// hoa/src/renderer/services/reservationAdminService.js

import { supabase } from "../../utils/supabase"

class ReservationAdminService {
  constructor() {
    this.reservationsChannel = null
    this.residentsChannel = null
  }

  /**
   * Get all reservations with resident and facility details
   * IMPORTANT: This returns raw DB format with snake_case fields
   */
  async getAllReservations() {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          residents!inner(
            id,
            first_name,
            last_name,
            middle_initial,
            contact_number,
            email,
            block_number,
            lot_number,
            phase_number,
            good_standing
          ),
          facilities!inner(
            id,
            name,
            price,
            price_unit
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      return { success: true, data: data || [] }
    } catch (error) {
      console.error('Error fetching reservations:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Subscribe to real-time reservation changes
   * @param {Function} onUpdate - Callback function when data changes
   * @returns {Function} Cleanup function to unsubscribe
   */
  subscribeToReservations(onUpdate) {
    // Remove existing subscription if any
    if (this.reservationsChannel) {
      supabase.removeChannel(this.reservationsChannel)
    }

    // Create new subscription
    this.reservationsChannel = supabase
      .channel('reservations_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'reservations'
        },
        async (payload) => {
          console.log('Reservation change detected:', payload)
          
          // Fetch fresh data and trigger callback
          const result = await this.getAllReservations()
          if (result.success) {
            onUpdate(result.data)
          }
        }
      )
      .subscribe()

    // Return cleanup function
    return () => {
      if (this.reservationsChannel) {
        supabase.removeChannel(this.reservationsChannel)
        this.reservationsChannel = null
      }
    }
  }

  /**
   * Subscribe to real-time resident changes (for good_standing updates)
   * @param {Function} onUpdate - Callback function when data changes
   * @returns {Function} Cleanup function to unsubscribe
   */
  subscribeToResidents(onUpdate) {
    // Remove existing subscription if any
    if (this.residentsChannel) {
      supabase.removeChannel(this.residentsChannel)
    }

    // Create new subscription
    this.residentsChannel = supabase
      .channel('residents_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'residents'
        },
        async (payload) => {
          console.log('Resident change detected:', payload)
          
          // Fetch fresh reservation data (includes updated resident info)
          const result = await this.getAllReservations()
          if (result.success) {
            onUpdate(result.data)
          }
        }
      )
      .subscribe()

    // Return cleanup function
    return () => {
      if (this.residentsChannel) {
        supabase.removeChannel(this.residentsChannel)
        this.residentsChannel = null
      }
    }
  }

  /**
   * Subscribe to both reservations and residents changes
   * @param {Function} onUpdate - Callback function when data changes
   * @returns {Function} Cleanup function to unsubscribe from both
   */
  subscribeToAll(onUpdate) {
    const unsubscribeReservations = this.subscribeToReservations(onUpdate)
    const unsubscribeResidents = this.subscribeToResidents(onUpdate)

    // Return combined cleanup function
    return () => {
      unsubscribeReservations()
      unsubscribeResidents()
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats() {
    try {
      const { data: allReservations, error: resError } = await supabase
        .from('reservations')
        .select('status, payment_status, total_amount')

      if (resError) throw resError

      const { data: goodStandingData, error: standingError } = await supabase
        .from('residents')
        .select('id')
        .eq('good_standing', true)

      if (standingError) throw standingError

      const pending = allReservations.filter(r => r.status === 'pending').length
      const approved = allReservations.filter(r => r.status === 'confirmed').length
      const rejected = allReservations.filter(r => r.status === 'rejected').length
      const cancelled = allReservations.filter(r => r.status === 'cancelled').length
      const completed = allReservations.filter(r => r.status === 'completed').length
      const goodStanding = goodStandingData?.length || 0

      return {
        success: true,
        data: {
          pending,
          approved,
          rejected,
          cancelled,
          completed,
          goodStanding
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Approve reservation with intelligent payment status handling
   * - Cash payments: automatically mark as 'paid'
   * - Online payments: keep existing payment_status
   * - Free reservations (good standing): mark as 'paid'
   */
  async approveReservation(reservationId) {
    try {
      // First, fetch the reservation to check payment type and good standing
      const { data: reservation, error: fetchError } = await supabase
        .from('reservations')
        .select(`
          *,
          residents!inner(good_standing)
        `)
        .eq('id', reservationId)
        .single()

      if (fetchError) throw fetchError

      // Determine payment status based on payment type and good standing
      let paymentStatus = reservation.payment_status // Keep existing by default
      
      const isCashPayment = reservation.payment_type?.toLowerCase() === 'cash'
      const isFree = reservation.residents.good_standing
      
      if (isCashPayment || isFree) {
        // For cash payments or free reservations, mark as paid
        paymentStatus = 'paid'
      }

      // Update the reservation
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ 
          status: 'confirmed',
          payment_status: paymentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', reservationId)

      if (updateError) throw updateError
      
      return { success: true }
    } catch (error) {
      console.error('Error approving reservation:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Reject reservation - ADMIN ACTION
   * Sets status to 'rejected' (not 'cancelled')
   * 'cancelled' is reserved for user-initiated cancellations
   */
  async rejectReservation(reservationId) {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', reservationId)

      if (error) throw error

      return { success: true }
    } catch (error) {
      console.error('Error rejecting reservation:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Bulk update residents good standing from CSV
   */
  async bulkUpdateResidents(csvData) {
    try {
      const updates = []
      const errors = []

      for (const row of csvData) {
        try {
          const { error } = await supabase
            .from('residents')
            .update({
              good_standing: row.good_standing,
              updated_at: new Date().toISOString()
            })
            .eq('id', row.resident_id)

          if (error) {
            errors.push({
              resident_id: row.resident_id,
              name: `${row.first_name} ${row.last_name}`,
              error: error.message
            })
          } else {
            updates.push({ id: row.resident_id })
          }
        } catch (err) {
          errors.push({
            resident_id: row.resident_id,
            name: `${row.first_name} ${row.last_name}`,
            error: err.message
          })
        }
      }

      return {
        success: true,
        data: {
          updated: updates.length,
          failed: errors.length,
          errors
        }
      }
    } catch (error) {
      console.error('Error bulk updating residents:', error)
      return { success: false, error: error.message }
    }
  }
}

export default new ReservationAdminService()