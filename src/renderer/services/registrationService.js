import { supabase } from "../../utils/supabase"

// Flag to track if we're in registration process
let isRegistering = false

export const setRegistrationFlag = (flag) => {
  isRegistering = flag
}

export const isInRegistrationProcess = () => {
  return isRegistering
}

export const registerAdmin = async (userData) => {
  try {
    console.log('🚀 Starting registration process for:', userData.email)
    
    // Set registration flag to prevent AuthContext from processing this login
    isRegistering = true
    console.log('🏁 Registration flag set to true')

    // 1. Check if email already exists in admin_accounts first
    console.log('🔍 Step 1: Checking if email exists...')
    const { data: existingEmail, error: emailCheckError } = await supabase
      .from("admin_accounts")
      .select("email")
      .eq("email", userData.email)
      .maybeSingle()

    if (emailCheckError && emailCheckError.code !== "PGRST116") {
      console.error('❌ Error checking email existence:', emailCheckError)
      throw emailCheckError
    }

    if (existingEmail) {
      console.warn('❌ Email already exists')
      throw new Error("An admin account with this email already exists")
    }
    
    console.log('✅ Email is available')

    // 2. Generate unique admin ID
    console.log('🔍 Step 2: Generating admin ID...')
    const { data: rpcData, error: idError } = await supabase.rpc('generate_admin_id')

    if (idError) {
      console.error('❌ Error generating admin ID:', idError)
      throw new Error('Failed to generate admin ID')
    }

    let adminId = null
    if (rpcData == null) {
      adminId = null
    } else if (Array.isArray(rpcData)) {
      adminId = rpcData[0]
    } else {
      adminId = rpcData
    }

    if (adminId && typeof adminId === 'object') {
      adminId = adminId.admin_id || adminId.generate_admin_id || Object.values(adminId)[0]
    }

    if (!adminId) {
      console.error('❌ Could not determine adminId from RPC response:', rpcData)
      throw new Error('Failed to generate admin ID')
    }

    console.log('✅ Generated unique admin ID:', adminId)

    // 3. Ensure we're signed out before creating new account
    await supabase.auth.signOut()
    console.log('Signed out before registration')

    // Wait for signout to complete
    await new Promise(resolve => setTimeout(resolve, 300))

    // 4. Create Supabase auth user
    const authEmail = `${adminId}@centellahomes.com`
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: authEmail,
      password: userData.password,
      options: {
        emailRedirectTo: undefined,
        data: {
          admin_id: adminId,
          first_name: userData.firstName,
          last_name: userData.lastName,
          position: userData.position,
          actual_email: userData.email,
        }
      }
    })

    if (authError) {
      console.error('Auth signup error:', authError)
      isRegistering = false
      throw authError
    }

    if (!authData?.user) {
      isRegistering = false
      throw new Error('Failed to create user account')
    }

    console.log('Auth user created:', authData.user.id)

    // 5. Insert admin account data into database
    const { data: _account, error: insertError } = await supabase
      .from("admin_accounts")
      .insert([
        {
          user_id: authData.user.id,
          admin_id: adminId,
          first_name: userData.firstName,
          last_name: userData.lastName,
          position: userData.position,
          email: userData.email,
          status: "active",
          email_verified: true
        },
      ])
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create admin account:', insertError)
      isRegistering = false
      throw new Error('Failed to create admin account')
    }

    console.log('Admin account created successfully')

    // 6. IMPORTANT: Sign out immediately after registration
    await supabase.auth.signOut()
    console.log('Signed out after registration - user must login manually')
    
    // Wait a bit to ensure signout completes
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Clear registration flag
    isRegistering = false
    console.log('Registration completed successfully')

    return {
      data: {
        adminId: adminId,
        message: "Account created successfully. Please sign in with your Admin ID and password."
      },
      error: null
    }

  } catch (error) {
    console.error("Registration error:", error)
    
    // Clear registration flag
    isRegistering = false
    
    // Ensure we're signed out on any error
    try {
      await supabase.auth.signOut()
      console.log('Signed out after registration error')
    } catch (e) {
      console.warn('Error signing out after registration failure:', e)
    }
    
    return {
      data: null,
      error: {
        message: error.message || 'Registration failed. Please try again.',
        details: error
      }
    }
  }
}

export const checkAdminIdExists = async (adminId) => {
  try {
    const { data, error } = await supabase
      .from("admin_accounts")
      .select("admin_id")
      .eq("admin_id", adminId)
      .maybeSingle()

    if (error && error.code !== "PGRST116") {
      throw error
    }

    return { exists: !!data, error: null }
  } catch (error) {
    console.error("Error checking admin ID:", error)
    return { exists: false, error }
  }
}

export const checkEmailExists = async (email) => {
  try {
    const { data, error } = await supabase
      .from("admin_accounts")
      .select("email")
      .eq("email", email)
      .maybeSingle()

    if (error && error.code !== "PGRST116") {
      throw error
    }

    return { exists: !!data, error: null }
  } catch (error) {
    console.error("Error checking email:", error)
    return { exists: false, error }
  }
}
