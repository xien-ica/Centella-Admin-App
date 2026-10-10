import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Function to strip HTML tags and decode HTML entities
function stripHtml(html) {
  if (!html) return '';
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"').replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'");
  // Remove extra whitespace and trim
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}
// Function to truncate text intelligently
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  // Try to cut at last complete word
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.8) {
    // If we found a space in the last 20% of text, cut there
    return truncated.substring(0, lastSpace) + '...';
  }
  // Otherwise just cut and add ellipsis
  return truncated + '...';
}
serve(async (req)=>{
  try {
    const { announcement_id, title, content, category } = await req.json();
    console.log('📨 Received notification request:', {
      announcement_id,
      raw_title: title,
      raw_content: content,
      category
    });
    // Validate required fields
    if (!announcement_id) {
      console.error('❌ Missing announcement_id');
      return new Response(JSON.stringify({
        error: 'announcement_id is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    if (!title || stripHtml(title).trim() === '') {
      console.error('❌ Missing or empty title');
      return new Response(JSON.stringify({
        error: 'Valid title is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    // Initialize Supabase client
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Get all active push tokens
    const { data: tokens, error } = await supabaseClient.from('push_tokens').select('expo_push_token');
    if (error) {
      console.error('❌ Error fetching tokens:', error);
      throw error;
    }
    if (!tokens || tokens.length === 0) {
      console.log('⚠️ No push tokens found');
      return new Response(JSON.stringify({
        message: 'No tokens found'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    console.log(`📱 Found ${tokens.length} device(s) to notify`);
    // Clean HTML from title and content
    const cleanTitle = stripHtml(title) || 'New Announcement';
    const cleanContent = stripHtml(content) || '';
    // Create notification title (max ~65 chars for visibility)
    const notificationTitle = truncateText(`${category}: ${cleanTitle}`, 65);
    // Create notification body (max 100 chars for preview)
    // If no content, use the title as body
    const notificationBody = cleanContent ? truncateText(cleanContent, 100) : truncateText(cleanTitle, 100);
    console.log('🧹 Cleaned notification:', {
      title: notificationTitle,
      body: notificationBody
    });
    // Prepare push notification messages
    const messages = tokens.map(({ expo_push_token })=>({
        to: expo_push_token,
        sound: 'default',
        title: notificationTitle,
        body: notificationBody,
        data: {
          announcementId: announcement_id,
          type: 'announcement',
          screen: 'AnnouncementDetail',
          // Include clean text for in-app use
          cleanTitle: cleanTitle,
          cleanContent: cleanContent,
          category: category
        },
        priority: 'high',
        channelId: 'announcements'
      }));
    console.log(`🚀 Sending ${messages.length} notification(s) to Expo...`);
    // Send to Expo Push Service
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messages)
    });
    const result = await response.json();
    console.log('✅ Expo response:', result);
    // Check for any errors in the response
    if (result.data) {
      const errors = result.data.filter((item)=>item.status === 'error');
      if (errors.length > 0) {
        console.error('⚠️ Some notifications failed:', errors);
      }
    }
    return new Response(JSON.stringify({
      success: true,
      sent: tokens.length,
      result
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error in push notification function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
});
