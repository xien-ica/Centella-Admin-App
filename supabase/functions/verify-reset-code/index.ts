// supabase/functions/verify-reset-code/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
// ✅ Initialize client once (faster cold starts)
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
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
  // ✅ Main logic for verifying reset code
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return new Response(JSON.stringify({
        error: "Email and code are required"
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // ✅ Create client per request (with auth header)
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization")
        }
      }
    });
    // Verify code from database
    const { data: resetCode, error: fetchError } = await supabaseClient.from("reset_codes").select("*").eq("email", email).eq("code", code).eq("used", false).single();
    if (fetchError || !resetCode) {
      return new Response(JSON.stringify({
        error: "Invalid verification code"
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
      // Delete expired code
      await supabaseClient.from("reset_codes").delete().eq("email", email);
      return new Response(JSON.stringify({
        error: "Verification code has expired. Please request a new one."
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Code is valid - don't mark as used yet (will be marked when password is actually reset)
    return new Response(JSON.stringify({
      success: true,
      message: "Code verified successfully"
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
