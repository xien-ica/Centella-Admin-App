// Supabase Edge Function: paymongo-webhook
// This receives webhook events from PayMongo when payment is completed
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
serve(async (req)=>{
  try {
    // Get webhook secret from environment
    const webhookSecret = Deno.env.get('PAYMONGO_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('PAYMONGO_WEBHOOK_SECRET not configured');
      return new Response('Webhook secret not configured', {
        status: 500
      });
    }
    // Get signature from headers
    const signature = req.headers.get('paymongo-signature');
    if (!signature) {
      console.error('No signature provided');
      return new Response('No signature', {
        status: 401
      });
    }
    // Get raw body for signature verification
    const rawBody = await req.text();
    // Parse signature parts
    const sigParts = signature.split(',').reduce((acc, part)=>{
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {});
    const timestamp = sigParts.t;
    const testSignature = sigParts.te;
    const liveSignature = sigParts.li;
    // Create signed payload
    const signedPayload = `${timestamp}.${rawBody}`;
    // Verify signature using HMAC SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(webhookSecret), {
      name: 'HMAC',
      hash: 'SHA-256'
    }, false, [
      'sign'
    ]);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    // Convert to hex string
    const computedSignature = Array.from(new Uint8Array(signatureBuffer)).map((b)=>b.toString(16).padStart(2, '0')).join('');
    // Compare with test or live signature
    const isValid = computedSignature === testSignature || computedSignature === liveSignature;
    if (!isValid) {
      console.error('Invalid webhook signature');
      return new Response('Invalid signature', {
        status: 401
      });
    }
    // Parse webhook payload
    const webhookData = JSON.parse(rawBody);
    const eventType = webhookData.data.attributes.type;
    // Initialize Supabase admin client
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Handle payment events
    if (eventType === 'link.payment.paid') {
      const linkData = webhookData.data.attributes.data;
      const paymentLinkId = linkData.id;
      let reservationId = null;
      let paymentId = null;
      let paymentMethod = null;
      // Get payment details from the payments array
      const payments = linkData.attributes.payments || [];
      if (payments.length > 0) {
        const payment = payments[0];
        if (payment.data?.id) {
          paymentId = payment.data.id;
          paymentMethod = payment.data.attributes?.source?.type || 'unknown';
        }
      }
      // Look up reservation by payment_link_id
      const { data: reservationByLink, error: linkError } = await supabaseAdmin.from('reservations').select('id').eq('payment_link_id', paymentLinkId).single();
      if (!linkError && reservationByLink) {
        reservationId = reservationByLink.id.toString();
      } else {
        // Fallback: extract from remarks
        const remarksMatch = linkData.attributes.remarks?.match(/Reservation #(\d+)/);
        if (remarksMatch) {
          reservationId = remarksMatch[1];
        }
      }
      if (!reservationId) {
        return new Response(JSON.stringify({
          error: 'No reservation_id found',
          payment_link_id: paymentLinkId
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
      // Update reservation
      const updateData = {
        payment_status: 'paid',
        updated_at: new Date().toISOString(),
        paymongo_payment_id: paymentId,
        paymongo_payment_method: paymentMethod
      };
      const { error: updateError } = await supabaseAdmin.from('reservations').update(updateData).eq('id', reservationId);
      if (updateError) {
        return new Response(JSON.stringify({
          error: 'Failed to update reservation',
          details: updateError
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
      return new Response(JSON.stringify({
        success: true,
        reservation_id: reservationId,
        payment_status: 'paid'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } else if (eventType === 'payment.paid') {
      const paymentData = webhookData.data.attributes.data;
      const paymentId = paymentData.id;
      const paymentMethod = paymentData.attributes?.source?.type || 'unknown';
      // Get reservation_id from metadata or description
      const descriptionMatch = paymentData.attributes.description?.match(/Reservation #(\d+)/);
      const reservationId = paymentData.attributes.metadata?.reservation_id || (descriptionMatch ? descriptionMatch[1] : null);
      if (!reservationId) {
        return new Response(JSON.stringify({
          error: 'No reservation_id found'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
      // Update reservation
      const updateData = {
        payment_status: 'paid',
        updated_at: new Date().toISOString(),
        paymongo_payment_id: paymentId,
        paymongo_payment_method: paymentMethod
      };
      const { error: updateError } = await supabaseAdmin.from('reservations').update(updateData).eq('id', reservationId);
      if (updateError) {
        return new Response(JSON.stringify({
          error: 'Failed to update reservation',
          details: updateError
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
      return new Response(JSON.stringify({
        success: true,
        reservation_id: reservationId,
        payment_status: 'paid'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } else if (eventType === 'payment.failed') {
      return new Response(JSON.stringify({
        success: true,
        message: 'Payment failed event logged'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // For other event types
    return new Response(JSON.stringify({
      success: true,
      message: 'Event received'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error?.message || 'Internal server error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});
