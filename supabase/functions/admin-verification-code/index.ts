import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
// ✅ Initialize outside for faster cold starts
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
serve(async (req)=>{
  // ✅ Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  // ✅ Handle GET ping (for cron keep-alive)
  if (req.method === "GET") {
    return new Response(JSON.stringify({
      success: true,
      message: "Admin verification endpoint alive",
      timestamp: Date.now()
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  // ✅ Main logic
  try {
    const body = await req.json();
    const { email, code, action } = body;
    // Basic email validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({
        success: false,
        message: "Invalid email address"
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
    // If action is 'verify', check the code
    if (action === 'verify') {
      if (!code || code.length !== 6) {
        return new Response(JSON.stringify({
          success: false,
          message: "Invalid verification code format"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      // Get verification code from database
      const { data, error } = await supabaseClient.from("verification_codes").select("code, expires_at, used_at").eq("email", email).single();
      if (error || !data) {
        return new Response(JSON.stringify({
          success: false,
          message: "Invalid or expired code"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      // Check if already used
      if (data.used_at) {
        return new Response(JSON.stringify({
          success: false,
          message: "This code has already been used"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      // Check if expired
      const now = new Date();
      const expiresAt = new Date(data.expires_at);
      if (now > expiresAt) {
        return new Response(JSON.stringify({
          success: false,
          message: "Code has expired"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      // Verify code matches
      if (data.code !== code.toString()) {
        return new Response(JSON.stringify({
          success: false,
          message: "Invalid verification code"
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      // Mark code as used
      await supabaseClient.from("verification_codes").update({
        used_at: new Date().toISOString()
      }).eq("email", email);
      return new Response(JSON.stringify({
        success: true,
        message: "Email verified successfully!"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Default action: Send verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    // Store code in database
    const { error: dbError } = await supabaseClient.from("verification_codes").upsert({
      email,
      code: verificationCode,
      expires_at: expiresAt,
      used_at: null
    }, {
      onConflict: "email"
    });
    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to store verification code");
    }
    // Send email using Resend API
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Centella Homes <hoa@centellahomes.com>",
        to: [
          email
        ],
        subject: "Admin Verification Code - Centella Homes",
        html: `
          <!DOCTYPE html>
          <html>
          <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <div style="background: linear-gradient(135deg, #231828 0%, #4a3a4f 100%); padding: 40px 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Centella Homes</h1>
                <p style="color: #f5f5f5; margin: 10px 0 0; font-size: 14px;">Admin Registration Portal</p>
              </div>
              <div style="padding: 40px 30px;">
                <h2 style="color: #333; margin: 0 0 20px; font-size: 24px;">Verify Your Admin Email</h2>
                <p style="color: #555; margin: 0 0 30px; font-size: 16px; line-height: 1.6;">
                  Use this code to complete your admin account setup:
                </p>
                <div style="background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; padding: 30px; text-align: center; margin: 0 0 30px;">
                  <p style="color: #6c757d; margin: 0 0 15px; font-size: 14px;">YOUR VERIFICATION CODE</p>
                  <div style="font-size: 42px; font-weight: 700; color: #231828; letter-spacing: 8px; font-family: monospace;">
                    ${verificationCode}
                  </div>
                </div>
                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 0 0 30px; border-radius: 4px;">
                  <p style="margin: 0; color: #856404; font-size: 14px;">
                    ⏱️ <strong>This code expires in 10 minutes.</strong>
                  </p>
                </div>
                <p style="color: #6c757d; font-size: 13px; margin: 0;">If you didn't request this, you can ignore this email.</p>
              </div>
              <div style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                <p style="margin: 0; color: #6c757d; font-size: 13px;">Centella Homes HOA - Admin Portal</p>
              </div>
            </div>
          </body>
          </html>
        `
      })
    });
    const resendData = await resendResponse.json();
    if (!resendResponse.ok) {
      console.error("Resend error:", resendData);
      throw new Error(resendData.message || "Failed to send email");
    }
    return new Response(JSON.stringify({
      success: true,
      message: "Verification code sent successfully!"
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({
      success: false,
      message: error.message || "Failed to send verification code"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
