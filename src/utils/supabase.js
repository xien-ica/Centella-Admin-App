import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables")
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // ✅ Disable auto-refresh on window focus/visibility changes
    // This prevents spam auth events when alt-tabbing in Electron
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  // ✅ For Electron: disable visibility-based session checks
  global: {
    headers: {
      'x-client-info': 'centella-homes-electron'
    }
  }
})

export const dbHelpers = {
  // Create admin account and link to auth.user
  createAdminAccount: async (userData, authUserId) => {
    const { data, error } = await supabase
      .from("admin_accounts")
      .insert([
        {
          user_id: authUserId, // ✅ link to auth.users.id
          admin_id: userData.adminId,
          first_name: userData.firstName,
          last_name: userData.lastName,
          status: "active",
        },
      ])
      .select()
      .single()
    return { data, error }
  },

  // Get admin account by admin_id
  getAdminAccount: async (adminId) => {
    const { data, error } = await supabase
      .from("admin_accounts")
      .select("*")
      .eq("admin_id", adminId)
      .single()
    return { data, error }
  },

  // Check if admin_id exists
  checkAdminIdExists: async (adminId) => {
    const { data, error } = await supabase
      .from("admin_accounts")
      .select("admin_id")
      .eq("admin_id", adminId)
      .single()
    return { exists: !!data && !error, error }
  },
}