import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0f1e] px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#1E5F7A] opacity-10 rounded-full blur-[120px]" />
      </div>

      <div className="relative text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-gray-200 dark:border-white/10 mb-6 shadow-lg overflow-hidden mx-auto">
          <Image src="/Logo_Solident.png" alt="Solident" width={72} height={72} className="object-contain" />
        </div>

        <h1 className="text-[#1E5F7A] text-8xl font-black mb-4">404</h1>
        <h2 className="text-gray-900 dark:text-white text-xl font-semibold mb-2">Page introuvable</h2>
        <p className="text-gray-500 dark:text-slate-400 text-sm mb-8">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>

        <Link href="/dashboard"
          className="inline-flex items-center gap-2 bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white font-semibold px-6 py-3 rounded-xl transition shadow-lg shadow-[#1E5F7A]/30 active:scale-[0.98]">
          ← Retour au dashboard
        </Link>

        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="h-px w-12 bg-[#F0A500]/30" />
          <p className="text-gray-400 dark:text-slate-600 text-xs">Solidarité Dentaires © {new Date().getFullYear()}</p>
          <div className="h-px w-12 bg-[#F0A500]/30" />
        </div>
      </div>
    </div>
  )
}