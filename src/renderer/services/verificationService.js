import { supabase } from "../../utils/supabase"

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-verification-code`
// ✅ Using the official Supabase-provided env variable name
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * Send verification code to admin email
 * @param {string} email - Email address to send code to
 * @returns {Promise<{success: boolean, message: string, error?: any}>}
 */
export const sendAdminVerificationCode = async (email) => {
  try {
    console.log('📧 Sending admin verification code to:', email)
    
    if (!SUPABASE_KEY) {
      console.error('❌ SUPABASE_KEY is undefined!')
      return {
        success: false,
        message: 'Configuration error: Missing API key'
      }
    }
    
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      },
      body: JSON.stringify({ email })
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('❌ Failed to send verification code:', result)
      return {
        success: false,
        message: result.message || 'Failed to send verification code',
        error: result
      }
    }

    console.log('✅ Verification code sent successfully')
    return {
      success: true,
      message: result.message || 'Verification code sent!',
      data: result
    }
  } catch (error) {
    console.error('❌ Error sending verification code:', error)
    return {
      success: false,
      message: 'Network error. Please check your connection.',
      error
    }
  }
}

/**
 * Verify the code entered by user
 * @param {string} email - Email address
 * @param {string} code - 6-digit verification code
 * @returns {Promise<{success: boolean, message: string, error?: any}>}
 */
export const verifyAdminCode = async (email, code) => {
  try {
    console.log('🔍 Verifying code for:', email)
    
    if (!SUPABASE_KEY) {
      console.error('❌ SUPABASE_KEY is undefined!')
      return {
        success: false,
        message: 'Configuration error: Missing API key'
      }
    }
    
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      },
      body: JSON.stringify({ 
        email, 
        code,
        action: 'verify'
      })
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('❌ Failed to verify code:', result)
      return {
        success: false,
        message: result.message || 'Invalid verification code',
        error: result
      }
    }

    console.log('✅ Code verified successfully')
    return {
      success: true,
      message: result.message || 'Email verified successfully!',
      data: result
    }
  } catch (error) {
    console.error('❌ Error verifying code:', error)
    return {
      success: false,
      message: 'Network error. Please try again.',
      error
    }
  }
}