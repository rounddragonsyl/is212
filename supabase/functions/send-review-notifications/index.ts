// send-review-notifications — US4 (SCRUM-9) AC-004.4, delivered by SCRUM-41.
//
// Drains public.notification_outbox, which the decision trigger in
// 0009_review_decisions.sql fills in the same transaction as the decision itself.
// This is the only place the mail account's credentials exist: never in the browser.
//
// Sends through Gmail over SMTP, which needs no custom domain and can reach any
// recipient. Port 465 (implicit TLS) is deliberate: Supabase Edge Functions block
// outbound connections on ports 25 and 587.
//
// Runs on Deno in Supabase Edge Functions, not in Vite, so it lives outside src/. Invoke
// it from a Database Webhook on INSERT into notification_outbox (see README), or on a
// schedule; either way it is safe to call repeatedly.
//
// Secrets (supabase secrets set ...):
//   GMAIL_USER          — the sending account, e.g. connectsphere212@gmail.com
//   GMAIL_APP_PASSWORD  — a Google app password (16 characters), NOT the account password
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'

const BATCH_SIZE = 20
// After this many failed sends a message stops being retried and is left for a human.
const MAX_ATTEMPTS = 5
const SENDER_NAME = 'ConnectSphere'

interface OutboxRow {
  id: string
  recipient_email: string
  subject: string
  body: string
  attempts: number
}

Deno.serve(async () => {
  const gmailUser = Deno.env.get('GMAIL_USER')
  const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD')
  if (!gmailUser || !gmailPassword) {
    return Response.json({ error: 'Email sending is not configured' }, { status: 500 })
  }

  // The service role bypasses RLS, which is required: no browser role can read the outbox.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: gmailUser, pass: gmailPassword },
  })

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

    try {
      await transport.sendMail({
        from: `"${SENDER_NAME}" <${gmailUser}>`,
        to: row.recipient_email,
        subject: row.subject,
        text: row.body,
      })
      await supabase
        .from('notification_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        .eq('id', row.id)
      sent += 1
    } catch (sendError) {
      const attempts = row.attempts + 1
      const message = sendError instanceof Error ? sendError.message : String(sendError)
      await supabase
        .from('notification_outbox')
        .update({
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          last_error: message.slice(0, 500),
        })
        .eq('id', row.id)
      failed += 1
    }
  }

  transport.close()
  return Response.json({ sent, failed })
})
