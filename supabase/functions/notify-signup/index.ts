import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record // { id, created_at, ... }

    const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey    = Deno.env.get('RESEND_API_KEY')!

    // Fetch email from auth.users — profiles table has no email column
    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(record.id)
    if (userErr || !user) throw new Error(`User lookup failed: ${userErr?.message}`)

    const email      = user.email
    const signedUpAt = record.created_at

    // Send plain-text email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SuperSub <onboarding@resend.dev>',
        to: 'supersubmobi@gmail.com',
        subject: 'New SuperSub signup',
        text: `New user signed up.\n\nEmail: ${email}\nTime:  ${signedUpAt}`,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Resend error ${res.status}: ${err}`)
    }

    console.log(`[notify-signup] email sent for ${email}`)
    return new Response(JSON.stringify({ success: true, email }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    // Always return 200 so the DB trigger doesn't mark the row as failed / retry
    console.error('[notify-signup]', e.message)
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
