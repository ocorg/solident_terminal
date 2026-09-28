import { prisma } from '@solident/db'
import { requireMemberPage } from '@/lib/space'
import { PushSettings } from './push-settings'
import { AvatarForm, PasswordForm, ProfileForm } from './settings-forms'

export const metadata = { title: 'Paramètres' }

export default async function SettingsPage() {
  const user = await requireMemberPage()
  const [u, credential] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, username: true, emailNotifications: true, image: true, email: true } }),
    prisma.account.findFirst({ where: { userId: user.id, providerId: 'credential', password: { not: null } }, select: { id: true } }),
  ])
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-heading text-2xl font-bold text-navy-700">Paramètres</h1>
      <section className="card space-y-4 p-6">
        <h2 className="font-heading text-lg font-bold text-navy-700">Photo</h2>
        <AvatarForm name={u.name} image={u.image} />
      </section>
      <section className="card space-y-4 p-6">
        <h2 className="font-heading text-lg font-bold text-navy-700">Profil</h2>
        <p className="text-sm text-ink-600">E-mail de connexion : {u.email}</p>
        <ProfileForm initial={{ name: u.name, username: u.username ?? '', emailNotifications: u.emailNotifications }} />
      </section>
      <section className="card space-y-4 p-6">
        <h2 className="font-heading text-lg font-bold text-navy-700">Notifications sur cet appareil</h2>
        <p className="text-sm text-ink-600">
          Recevez une notification sur ce téléphone ou cet ordinateur quand on vous assigne une tâche, commente l’une de vos tâches ou vous invite à une réunion. À activer
          sur chaque appareil.
        </p>
        <PushSettings />
      </section>
      <section className="card space-y-4 p-6">
        <h2 className="font-heading text-lg font-bold text-navy-700">Mot de passe</h2>
        <PasswordForm hasPassword={!!credential} email={u.email} />
      </section>
    </div>
  )
}
