'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/spinner'
import { removePushSubscription, savePushSubscription, sendTestPush } from './actions'

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

type State = 'loading' | 'unconfigured' | 'ios-install' | 'unsupported' | 'denied' | 'off' | 'on'

function keyBytes(base64url: string) {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** Phone / browser notifications for this device (Web Push). */
export function PushSettings() {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState<null | 'on' | 'off' | 'test'>(null)

  useEffect(() => {
    ;(async () => {
      if (!PUBLIC_KEY) return setState('unconfigured')
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
      if (!supported) return setState(isIos() && !isInstalled() ? 'ios-install' : 'unsupported')
      if (Notification.permission === 'denied') return setState('denied')
      const reg = await navigator.serviceWorker.ready
      setState((await reg.pushManager.getSubscription()) ? 'on' : 'off')
    })().catch(() => setState('unsupported'))
  }, [])

  async function enable() {
    setBusy('on')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off')
        return void toast.error('Autorisation refusée : les notifications restent désactivées.')
      }
      const reg = await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY!) }))
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const res = await savePushSubscription({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent.slice(0, 300) })
      if (res.status === 'error') return void toast.error(res.message)
      setState('on')
      toast.success('Notifications activées sur cet appareil')
    } catch (e) {
      console.error(e)
      toast.error('Les notifications n’ont pas pu être activées sur cet appareil.')
    } finally {
      setBusy(null)
    }
  }

  async function disable() {
    setBusy('off')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await removePushSubscription({ endpoint: sub.endpoint })
        await sub.unsubscribe()
      }
      setState('off')
      toast.success('Notifications désactivées sur cet appareil')
    } catch {
      toast.error('Les notifications n’ont pas pu être désactivées.')
    } finally {
      setBusy(null)
    }
  }

  async function test() {
    setBusy('test')
    const res = await sendTestPush()
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Notification de test envoyée')
  }

  if (state === 'loading') return <p className="text-sm text-ink-600">Vérification…</p>
  if (state === 'unconfigured') return <p className="text-sm text-ink-600">Les notifications ne sont pas encore configurées sur ce site.</p>
  if (state === 'ios-install')
    return (
      <p className="text-sm text-ink-600">
        Sur iPhone et iPad, installez d’abord l’app : dans Safari, touchez <strong>Partager</strong> puis <strong>Sur l’écran d’accueil</strong>. Ouvrez ensuite l’app Solident et
        revenez ici pour activer les notifications.
      </p>
    )
  if (state === 'unsupported') return <p className="text-sm text-ink-600">Ce navigateur ne permet pas les notifications. Essayez Chrome, Edge, Firefox ou Safari récent.</p>
  if (state === 'denied')
    return (
      <p className="text-sm text-ink-600">
        Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur (icône à gauche de l’adresse, ou réglages de l’app), puis rechargez la
        page.
      </p>
    )

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${state === 'on' ? 'bg-success/15 text-success' : 'bg-navy-100 text-ink-600'}`}>
        {state === 'on' ? 'Activées' : 'Désactivées'}
      </span>
      {state === 'off' ? (
        <button type="button" onClick={enable} disabled={busy !== null} className="btn btn-primary px-4 py-2 text-sm">
          {busy === 'on' && <Spinner />} Activer les notifications
        </button>
      ) : (
        <>
          <button type="button" onClick={test} disabled={busy !== null} className="btn btn-ghost px-4 py-2 text-sm">
            {busy === 'test' && <Spinner />} Envoyer un test
          </button>
          <button type="button" onClick={disable} disabled={busy !== null} className="btn btn-ghost px-4 py-2 text-sm text-danger">
            {busy === 'off' && <Spinner />} Désactiver
          </button>
        </>
      )}
    </div>
  )
}
