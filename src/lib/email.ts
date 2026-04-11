import { Resend } from 'resend'

const resend   = new Resend(process.env.RESEND_API_KEY)
const FROM     = 'Solident <onboarding@resend.dev>'
const BASE_URL = 'https://solident-terminal.vercel.app'
const LOGO     = 'https://nuycsptqqxuqxxhofbpv.supabase.co/storage/v1/object/public/Logo_Solident/Logo%20Solident.png'

// ─── Shared email wrapper ─────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  try {
    await resend.emails.send({ from: FROM, to, subject, html })
  } catch (e) {
    console.error('Email send failed:', e)
  }
}

// ─── Email template base ──────────────────────────────────────
function template(title: string, body: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#1E5F7A,#2a7a9a);padding:32px 40px;text-align:center;">
                <img src="${LOGO}" alt="Solident" width="72" height="72" style="border-radius:12px;background:#ffffff;padding:4px;display:block;margin:0 auto 12px;" />
                <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Solident</h1>
                <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Solidarité Dentaires — Espace membre</p>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:32px 40px;">
                <h2 style="margin:0 0 16px;color:#0f172a;font-size:18px;font-weight:600;">${title}</h2>
                ${body}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:20px 40px;border-top:1px solid #f1f5f9;text-align:center;">
                <p style="margin:0;color:#94a3b8;font-size:12px;">Solidarité Dentaires © ${new Date().getFullYear()}</p>
                <p style="margin:4px 0 0;color:#cbd5e1;font-size:11px;">Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `
}

function btn(text: string, url: string) {
  return `<a href="${url}" style="display:inline-block;background:#1E5F7A;color:#ffffff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;font-size:14px;margin-top:20px;">${text}</a>`
}

function para(text: string) {
  return `<p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.6;">${text}</p>`
}

function card(color: string, icon: string, label: string, detail: string) {
  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${color};border-radius:10px;margin:10px 0;">
    <tr>
      <td style="padding:14px 16px;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:36px;vertical-align:middle;padding-right:12px;">
              <div style="width:32px;height:32px;background:#1E5F7A;border-radius:8px;text-align:center;line-height:32px;font-size:16px;">${icon}</div>
            </td>
            <td style="vertical-align:middle;">
              <p style="margin:0;color:#0f172a;font-size:14px;font-weight:600;">${label}${detail ? `<span style="font-weight:400;color:#475569;"> — ${detail}</span>` : ''}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`
}

// ─── Digest email ─────────────────────────────────────────────
const ACTION_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  task_assigned:    { icon: '📋', label: 'Tâche assignée',              color: '#f0f9ff' },
  task_comment:     { icon: '💬', label: 'Nouveau commentaire',         color: '#f0fdf4' },
  event_invited:    { icon: '📅', label: 'Invitation événement',        color: '#faf5ff' },
  proposal_approved:{ icon: '✅', label: 'Proposition approuvée',       color: '#f0fdf4' },
  proposal_rejected:{ icon: '❌', label: 'Proposition non retenue',     color: '#fef2f2' },
  added_to_project: { icon: '📁', label: 'Ajouté à un projet',          color: '#f0f9ff' },
  added_to_cellule: { icon: '🏛️', label: 'Ajouté à une cellule',        color: '#fffbeb' },
  proposal_submitted:{ icon: '💡', label: 'Nouvelle proposition',       color: '#fffbeb' },
}

export async function sendDigestEmail(to: string, fullName: string, actions: any[]) {
  const count = actions.length
  const subject = count === 1
    ? `Solident — 1 nouvelle notification`
    : `Solident — ${count} nouvelles notifications`

  const items = actions.map(a => {
    const meta = ACTION_LABELS[a.action_type] || { icon: '🔔', label: a.action_type, color: '#f8fafc' }
    const detail = a.payload?.title || a.payload?.name || a.payload?.detail || ''
    return card(meta.color, meta.icon, meta.label, detail)
  }).join('')

  await sendEmail(to, subject, template(
    `Bonjour ${fullName}, vous avez ${count} notification${count > 1 ? 's' : ''}`,
    `
    ${para('Voici un résumé de vos dernières activités sur la plateforme Solident :')}
    <div style="margin:20px 0;">${items}</div>
    ${para('Connectez-vous pour voir les détails et répondre.')}
    <div style="text-align:center;margin:24px 0;">
      ${btn('Accéder à la plateforme', BASE_URL)}
    </div>
    `
  ))
}

// ─── Auth emails (immediate — never queued) ───────────────────

export async function emailInvite(to: string, fullName: string, activationLink: string) {
  await sendEmail(
    to,
    'Bienvenue sur Solident — Activez votre compte',
    template(
      `Bienvenue, ${fullName} ! 🎉`,
      `
      ${para("Vous avez été invité(e) à rejoindre la plateforme <strong>Solident</strong> de l'association <strong>Solidarité Dentaires</strong>.")}
      <div style="background:#f0f9ff;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
        <img src="${LOGO}" alt="Solident" width="60" height="60" style="border-radius:10px;display:block;margin:0 auto 8px;" />
        <p style="margin:0;color:#0f172a;font-weight:600;font-size:15px;">Solidarité Dentaires</p>
        <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Plateforme de gestion associative</p>
      </div>
      ${para("Votre compte a été créé. Cliquez sur le bouton ci-dessous pour définir votre mot de passe et accéder à la plateforme.")}
      <div style="text-align:center;margin:24px 0;">
        ${btn('✨ Activer mon compte', activationLink)}
      </div>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin-top:16px;">
        <p style="margin:0;color:#92400e;font-size:12px;">⏰ <strong>Ce lien expire dans 24 heures.</strong> Si vous ne l'utilisez pas à temps, contactez votre administrateur.</p>
      </div>
      ${para("Si vous n'attendiez pas cet email, vous pouvez l'ignorer en toute sécurité.")}
      `
    )
  )
}

export async function emailPasswordReset(to: string, resetLink: string) {
  await sendEmail(
    to,
    'Réinitialisation de votre mot de passe Solident',
    template(
      '🔐 Réinitialisation de mot de passe',
      `
      ${para("Vous avez demandé la réinitialisation de votre mot de passe pour votre compte <strong>Solident</strong>.")}
      ${para("Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe. Ce lien est valable <strong>1 heure</strong>.")}
      <div style="text-align:center;margin:28px 0;">
        ${btn('🔑 Réinitialiser mon mot de passe', resetLink)}
      </div>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 18px;margin-top:16px;">
        <p style="margin:0 0 6px;color:#991b1b;font-size:13px;font-weight:700;">⚠️ Sécurité importante</p>
        <p style="margin:0;color:#b91c1c;font-size:12px;line-height:1.6;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email — votre mot de passe reste inchangé.</p>
      </div>
      ${para("Ce lien expire automatiquement après utilisation ou dans 1 heure.")}
      `
    )
  )
}