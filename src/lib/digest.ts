import { createAdminClient } from '@/lib/supabase/admin'

export type DigestActionType =
  | 'task_assigned'
  | 'task_comment'
  | 'event_invited'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'added_to_project'
  | 'added_to_cellule'
  | 'proposal_submitted'

export async function queueDigest(
  recipientId: string,
  recipientEmail: string,
  recipientName: string,
  actionType: DigestActionType,
  payload: Record<string, string>
) {
  const admin = createAdminClient()
  const sendAfter = new Date(Date.now() + 60 * 1000).toISOString() // 1 minute from now

  // Check if there's already a pending digest for this recipient
  const { data: existing } = await admin
    .from('email_digest_queue')
    .select('id')
    .eq('recipient_id', recipientId)
    .gt('send_after', new Date().toISOString())
    .limit(1)

  if (existing && existing.length > 0) {
    // Reset the timer on all pending items for this recipient
    await admin
      .from('email_digest_queue')
      .update({ send_after: sendAfter })
      .eq('recipient_id', recipientId)
      .gt('send_after', new Date().toISOString())
  }

  // Always insert the new action
  await admin.from('email_digest_queue').insert({
    recipient_id:    recipientId,
    recipient_email: recipientEmail,
    recipient_name:  recipientName,
    action_type:     actionType,
    payload,
    send_after:      sendAfter,
  })
}