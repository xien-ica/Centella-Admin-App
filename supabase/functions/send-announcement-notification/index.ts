// supabase/functions/send-announcement-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') // Optional - for higher rate limits
;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: corsHeaders
      });
    }
    // Handle GET requests (for warmup/health check)
    if (req.method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        message: 'Push notification endpoint alive',
        timestamp: Date.now()
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Only allow POST requests for actual notifications
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const requestBody = await req.json();
    const { announcement, test } = requestBody;
    // Handle test/warmup requests
    if (test) {
      console.log('🔥 Warmup request received');
      return new Response(JSON.stringify({
        success: true,
        message: 'Warmup successful'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!announcement || !announcement.id) {
      return new Response(JSON.stringify({
        error: 'Announcement data is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('📢 Processing notification for announcement:', announcement.id);
    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // Fetch all active push tokens from users who have notifications enabled
    const { data: tokens, error: tokensError } = await supabase.from('push_tokens').select(`
        expo_push_token, 
        user_id,
        resident_id,
        residents!inner(notifications_enabled, announcement_notifications)
      `).eq('is_active', true).eq('residents.notifications_enabled', true).eq('residents.announcement_notifications', true);
    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      return new Response(JSON.stringify({
        error: 'Failed to fetch push tokens',
        details: tokensError.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (!tokens || tokens.length === 0) {
      console.log('⚠️ No active push tokens found with notifications enabled');
      return new Response(JSON.stringify({
        success: true,
        message: 'No active push tokens to send to',
        sent: 0
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`📱 Found ${tokens.length} active push tokens with notifications enabled`);
    // Strip HTML tags from title and content for notification
    const stripHtml = (html)=>{
      return html.replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'") // Replace &#39; with '
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
    };
    const cleanTitle = stripHtml(announcement.title);
    const cleanContent = stripHtml(announcement.content);
    // Truncate content for notification (max 178 chars to fit in notification)
    const truncatedContent = cleanContent.length > 178 ? cleanContent.substring(0, 175) + '...' : cleanContent;
    // Prepare push messages
    const messages = tokens.map((token)=>({
        to: token.expo_push_token,
        sound: 'default',
        title: cleanTitle,
        body: truncatedContent,
        data: {
          announcementId: announcement.id,
          category: announcement.category,
          type: 'announcement',
          screen: 'ViewAnnouncement'
        },
        badge: 1,
        channelId: 'announcements',
        priority: 'high'
      }));
    // Send notifications in chunks of 100 (Expo's limit)
    const chunkSize = 100;
    const chunks = [];
    for(let i = 0; i < messages.length; i += chunkSize){
      chunks.push(messages.slice(i, i + chunkSize));
    }
    let totalSent = 0;
    let totalErrors = 0;
    const invalidTokens = [];
    for (const chunk of chunks){
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
            ...EXPO_ACCESS_TOKEN && {
              'Authorization': `Bearer ${EXPO_ACCESS_TOKEN}`
            }
          },
          body: JSON.stringify(chunk)
        });
        if (!response.ok) {
          console.error('Expo API error:', response.status, await response.text());
          totalErrors += chunk.length;
          continue;
        }
        const result = await response.json();
        console.log('Expo push response:', JSON.stringify(result));
        if (result.data) {
          result.data.forEach((ticket, index)=>{
            if (ticket.status === 'ok') {
              totalSent++;
            } else {
              totalErrors++;
              console.error('Failed to send to token:', chunk[index].to.substring(0, 20) + '...', ticket);
              // Mark invalid tokens as inactive
              if (ticket.details?.error === 'DeviceNotRegistered') {
                invalidTokens.push(chunk[index].to);
              }
            }
          });
        }
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
        totalErrors += chunk.length;
      }
    }
    // Batch update invalid tokens
    if (invalidTokens.length > 0) {
      console.log(`Marking ${invalidTokens.length} invalid tokens as inactive`);
      try {
        await supabase.from('push_tokens').update({
          is_active: false
        }).in('expo_push_token', invalidTokens);
      } catch (error) {
        console.error('Error updating invalid tokens:', error);
      }
    }
    console.log(`✅ Sent ${totalSent} notifications, ${totalErrors} errors`);
    return new Response(JSON.stringify({
      success: true,
      sent: totalSent,
      errors: totalErrors,
      total: tokens.length,
      invalidTokens: invalidTokens.length
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error',
      details: error.toString()
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
