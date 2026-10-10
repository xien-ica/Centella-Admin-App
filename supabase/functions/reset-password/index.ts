// supabase/functions/reset-password/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
// ✅ Initialize client once (faster cold starts)
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
serve(async (req)=>{
  // ✅ Handle preflight request for CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  // ✅ Simple GET ping endpoint — FAST response for cron
  if (req.method === "GET") {
    return new Response(JSON.stringify({
      success: true,
      message: "pong",
      timestamp: Date.now()
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  // ✅ Main logic for resetting password
  try {
    const { email, code, newPassword, authUserId } = await req.json();
    if (!email || !code || !newPassword || !authUserId) {
      return new Response(JSON.stringify({
        error: "Missing required fields"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ✅ Create client with SERVICE ROLE KEY for password update
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    // Verify code one more time
    const { data: resetCode, error: fetchError } = await supabaseClient.from("reset_codes").select("*").eq("email", email).eq("code", code).eq("used", false).single();
    if (fetchError || !resetCode) {
      return new Response(JSON.stringify({
        error: "Invalid or expired verification code"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Check if code is expired
    const now = new Date();
    const expiresAt = new Date(resetCode.expires_at);
    if (now > expiresAt) {
      await supabaseClient.from("reset_codes").delete().eq("email", email);
      return new Response(JSON.stringify({
        error: "Verification code has expired"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Update password using Supabase Auth Admin API
    const { error: updateError } = await supabaseClient.auth.admin.updateUserById(authUserId, {
      password: newPassword
    });
    if (updateError) {
      console.error("Password update error:", updateError);
      return new Response(JSON.stringify({
        error: "Failed to update password"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Mark code as used and delete it
    await supabaseClient.from("reset_codes").delete().eq("email", email);
    return new Response(JSON.stringify({
      success: true,
      message: "Password reset successfully"
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
