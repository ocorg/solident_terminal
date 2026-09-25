import 'server-only'
import nodemailer from 'nodemailer'

// Same Gmail account and SMTP settings as Terminal (apps/terminal/src/lib/email.ts).
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
})

export async function sendMail(to: string, subject: string, html: string, text: string) {
  await transporter.sendMail({
    from: `"Association Solident" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
    text,
  })
}

export function magicLinkEmail(url: string, name: string) {
  const subject = 'Votre lien de connexion Solident'
  const text = `Bonjour ${name},\n\nCliquez sur ce lien pour vous connecter (valable 24 heures, utilisable une seule fois) :\n${url}\n\nSi vous n'avez rien demandé, ignorez cet e-mail.\n\nAssociation Solident`
  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;background:#FBF8F2;font-family:Montserrat,Arial,sans-serif;color:#123A4F">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;box-shadow:0 8px 24px rgba(18,58,79,.08);overflow:hidden">
        <tr><td style="background:#1E5470;padding:20px 28px;color:#ffffff;font-family:Poppins,Arial,sans-serif;font-weight:700;font-size:20px">
          Solident<span style="color:#F4B223">.</span>
        </td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 12px;font-size:16px">Bonjour ${escapeHtml(name)},</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4A5A66">Cliquez sur le bouton ci-dessous pour vous connecter à l'espace membres. Le lien est valable 24 heures et ne fonctionne qu'une fois.</p>
          <a href="${url}" style="display:inline-block;background:#F4B223;color:#123A4F;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:10px">Se connecter</a>
          <p style="margin:24px 0 0;font-size:13px;color:#4A5A66">Si vous n'avez rien demandé, ignorez simplement cet e-mail.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  return { subject, html, text }
}

export function accessRequestEmail(req: { name: string; email: string; message?: string }) {
  const subject = `Nouvelle demande d'accès : ${req.name}`
  const text = `${req.name} (${req.email}) demande un accès à l'espace membres.${req.message ? `\n\nMessage : ${req.message}` : ''}\n\nPour valider : ouvrez la table users (pnpm db:studio) et passez is_active à true.`
  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;background:#FBF8F2;font-family:Montserrat,Arial,sans-serif;color:#123A4F;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;box-shadow:0 8px 24px rgba(18,58,79,.08)">
    <p style="margin:0 0 12px;font-family:Poppins,Arial,sans-serif;font-weight:700;font-size:18px;color:#1E5470">Nouvelle demande d'accès</p>
    <p style="margin:0 0 8px"><strong>${escapeHtml(req.name)}</strong> — ${escapeHtml(req.email)}</p>
    ${req.message ? `<p style="margin:0 0 16px;padding:12px;background:#E3EDF2;border-radius:10px">${escapeHtml(req.message)}</p>` : ''}
    <p style="margin:0;font-size:13px;color:#4A5A66">Pour valider : ouvrez la table <code>users</code> (<code>pnpm db:studio</code>) et passez <code>is_active</code> à <code>true</code>. L'écran /admin/utilisateurs arrive en Phase 1.</p>
  </div>
</body></html>`
  return { subject, html, text }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
