// Supabase Edge Function: create-payment-link
// This creates a PayMongo Payment Link for the reservation
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Get PayMongo secret key from environment
    const paymongoSecretKey = Deno.env.get('PAYMONGO_SECRET_KEY');
    if (!paymongoSecretKey) {
      throw new Error('PAYMONGO_SECRET_KEY not configured');
    }
    // Initialize Supabase client
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization')
        }
      }
    });
    // Get request body
    const { reservation_id, amount, description } = await req.json();
    // Validate inputs
    if (!reservation_id || !amount) {
      return new Response(JSON.stringify({
        error: 'reservation_id and amount are required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get reservation details
    const { data: reservation, error: reservationError } = await supabaseClient.from('reservations').select(`
        *,
        facilities!inner(name),
        residents!inner(first_name, last_name, email)
      `).eq('id', reservation_id).single();
    if (reservationError || !reservation) {
      return new Response(JSON.stringify({
        error: 'Reservation not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Convert amount to centavos (PayMongo uses centavos)
    const amountInCentavos = Math.round(parseFloat(amount) * 100);
    // Create payment link description
    const linkDescription = description || `${reservation.facilities.name} - ${reservation.reservation_date} ${reservation.start_time}`;
    // Prepare PayMongo Payment Link payload
    const paymongoPayload = {
      data: {
        attributes: {
          amount: amountInCentavos,
          description: linkDescription,
          remarks: `Reservation #${reservation_id}`,
          // Store reservation_id in reference_number for webhook lookup
          reference_number: reservation_id.toString()
        }
      }
    };
    // Create Payment Link via PayMongo API
    const paymongoResponse = await fetch('https://api.paymongo.com/v1/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(paymongoSecretKey + ':')}`
      },
      body: JSON.stringify(paymongoPayload)
    });
    if (!paymongoResponse.ok) {
      const errorData = await paymongoResponse.json();
      console.error('PayMongo API Error:', errorData);
      return new Response(JSON.stringify({
        error: 'Failed to create payment link',
        details: errorData
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const paymongoData = await paymongoResponse.json();
    const paymentLink = paymongoData.data;
    // Update reservation with payment link details
    const updateData = {
      payment_link_id: paymentLink.id,
      payment_link_url: paymentLink.attributes.checkout_url,
      payment_type: 'online',
      updated_at: new Date().toISOString()
    };
    const { error: updateError } = await supabaseClient.from('reservations').update(updateData).eq('id', reservation_id);
    if (updateError) {
      console.error('Error updating reservation:', updateError);
    // Don't fail the request, payment link was created successfully
    }
    // Return success with payment link
    return new Response(JSON.stringify({
      success: true,
      payment_link_id: paymentLink.id,
      payment_link_url: paymentLink.attributes.checkout_url,
      reference_number: paymentLink.attributes.reference_number,
      amount: amountInCentavos,
      description: linkDescription
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in create-payment-link:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
