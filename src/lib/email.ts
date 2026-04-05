import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'Solident <onboarding@resend.dev>'
const BASE_URL = 'https://solident-terminal.vercel.app'

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

// ─── Email functions ──────────────────────────────────────────

export async function emailInvite(to: string, fullName: string, activationLink: string) {
  await sendEmail(
    to,
    'Bienvenue sur Solident — Activez votre compte',
    template(
      `Bienvenue, ${fullName} ! 🎉`,
      `
      ${para("Vous avez été invité(e) à rejoindre la plateforme <strong>Solident</strong> de l'association <strong>Solidarité Dentaires</strong>.")}
      <div style="background:#f0f9ff;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
        <p style="margin:0 0 8px;color:#1E5F7A;font-size:32px;">🦷</p>
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

export async function emailTaskAssigned(
  to: string, fullName: string, taskTitle: string, taskId: string
) {
  await sendEmail(
    to,
    `Nouvelle tâche assignée : ${taskTitle}`,
    template(
      'Une tâche vous a été assignée',
      `
      ${para(`Bonjour ${fullName},`)}
      ${para(`La tâche suivante vous a été assignée :`)}
      <div style="background:#f0f9ff;border-left:4px solid #1E5F7A;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;">
        <p style="margin:0;color:#0f172a;font-weight:600;font-size:14px;">${taskTitle}</p>
      </div>
      ${para("Connectez-vous à la plateforme pour consulter les détails et commencer à travailler.")}
      ${btn('Voir la tâche', `${BASE_URL}/tasks`)}
      `
    )
  )
}

export async function emailProposalSubmitted(
  to: string, adminName: string, proposalTitle: string, proposedBy: string
) {
  await sendEmail(
    to,
    `Nouvelle proposition à examiner : ${proposalTitle}`,
    template(
      'Nouvelle proposition en attente',
      `
      ${para(`Bonjour ${adminName},`)}
      ${para(`<strong>${proposedBy}</strong> a soumis une nouvelle proposition qui attend votre examen :`)}
      <div style="background:#fffbeb;border-left:4px solid #F0A500;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;">
        <p style="margin:0;color:#0f172a;font-weight:600;font-size:14px;">${proposalTitle}</p>
      </div>
      ${btn('Examiner la proposition', `${BASE_URL}/proposals`)}
      `
    )
  )
}

export async function emailProposalApproved(
  to: string, fullName: string, proposalTitle: string
) {
  await sendEmail(
    to,
    `Votre proposition a été approuvée : ${proposalTitle}`,
    template(
      '🎉 Proposition approuvée !',
      `
      ${para(`Bonjour ${fullName},`)}
      ${para(`Bonne nouvelle ! Votre proposition a été approuvée et un projet a été créé automatiquement :`)}
      <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;">
        <p style="margin:0;color:#0f172a;font-weight:600;font-size:14px;">${proposalTitle}</p>
      </div>
      ${para("Vous pouvez maintenant accéder au projet et commencer à organiser les activités.")}
      ${btn('Voir mes projets', `${BASE_URL}/projects`)}
      `
    )
  )
}

export async function emailProposalRejected(
  to: string, fullName: string, proposalTitle: string, note: string
) {
  await sendEmail(
    to,
    `Votre proposition n'a pas été retenue : ${proposalTitle}`,
    template(
      'Proposition non retenue',
      `
      ${para(`Bonjour ${fullName},`)}
      ${para(`Après examen, votre proposition n'a malheureusement pas été retenue :`)}
      <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;">
        <p style="margin:0;color:#0f172a;font-weight:600;font-size:14px;">${proposalTitle}</p>
      </div>
      ${note ? `<div style="background:#f8fafc;padding:12px 16px;border-radius:8px;margin:16px 0;"><p style="margin:0;color:#475569;font-size:13px;"><strong>Note de l'administrateur :</strong> ${note}</p></div>` : ''}
      ${para("N'hésitez pas à soumettre une nouvelle proposition en tenant compte des remarques.")}
      ${btn('Soumettre une nouvelle proposition', `${BASE_URL}/proposals`)}
      `
    )
  )
}

export async function emailEventInvited(
  to: string, fullName: string, eventTitle: string, startAt: string, location: string | null
) {
  const date = new Date(startAt).toLocaleDateString('fr-MA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
  await sendEmail(
    to,
    `Invitation : ${eventTitle}`,
    template(
      `Vous êtes invité(e) à un événement`,
      `
      ${para(`Bonjour ${fullName},`)}
      ${para(`Vous avez été invité(e) à l'événement suivant :`)}
      <div style="background:#f0f9ff;border-left:4px solid #1E5F7A;padding:16px;border-radius:0 8px 8px 0;margin:16px 0;">
        <p style="margin:0 0 4px;color:#0f172a;font-weight:600;font-size:15px;">${eventTitle}</p>
        <p style="margin:0 0 4px;color:#475569;font-size:13px;">📅 ${date}</p>
        ${location ? `<p style="margin:0;color:#475569;font-size:13px;">📍 ${location}</p>` : ''}
      </div>
      ${para("Connectez-vous pour confirmer votre présence.")}
      ${btn('Répondre à l\'invitation', `${BASE_URL}/events`)}
      `
    )
  )
}