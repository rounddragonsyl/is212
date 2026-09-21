// send-review-notifications — US4 (SCRUM-9) AC-004.4, delivered by SCRUM-41.
//
// Drains public.notification_outbox, which the decision trigger in
// 0009_review_decisions.sql fills in the same transaction as the decision itself.
// This is the only place an email provider key exists: never in the browser bundle.
//
// Runs on Deno in Supabase Edge Functions, not in Vite, so it is outside src/ and uses
// URL imports. Invoke it from a Database Webhook on INSERT into notification_outbox (see
// README), or on a schedule; either way it is safe to call repeatedly.
//
// Secrets (supabase secrets set ...):
//   RESEND_API_KEY       — API key from resend.com
//   NOTIFICATION_FROM    — sender, e.g. "ConnectSphere <onboarding@resend.dev>"
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BATCH_SIZE = 20
// After this many failed sends a message stops being retried and is left for a human.
const MAX_ATTEMPTS = 5

interface OutboxRow {
  id: string
  recipient_email: string
  subject: string
  body: string
  attempts: number
}

Deno.serve(async () => {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('NOTIFICATION_FROM')
  if (!resendKey || !from) {
    return Response.json({ error: 'Email provider is not configured' }, { status: 500 })
  }

  // The service role bypasses RLS, which is required: no browser role can read the outbox.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data, error } = await supabase
    .from('notification_outbox')
    .select('id, recipient_email, subject, body, attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  let sent = 0
  let failed = 0

  for (const row of (data ?? []) as OutboxRow[]) {
    // Claim the row by bumping attempts only if nobody else has. Two overlapping
    // invocations (a webhook and a retry, say) then cannot both email the same message.
    const { data: claimed } = await supabase
      .from('notification_outbox')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id)
      .eq('status', 'pending')
      .eq('attempts', row.attempts)
      .select('id')
      .maybeSingle()
    if (!claimed) continue

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [row.recipient_email], subject: row.subject, text: row.body }),
    })

    if (response.ok) {
      await supabase
        .from('notification_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        .eq('id', row.id)
      sent += 1
    } else {
      const attempts = row.attempts + 1
      await supabase
        .from('notification_outbox')
        .update({
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          last_error: `${response.status} ${(await response.text()).slice(0, 500)}`,
        })
        .eq('id', row.id)
      failed += 1
    }
  }

  return Response.json({ sent, failed })
})
