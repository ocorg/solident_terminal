'use client'

export default function MaintenanceActivePage() {
  return (
    <div className="min-h-screen bg-[#050c18] flex items-center justify-center p-6">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#1E5F7A]/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-[#F0A500]/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-lg w-full text-center">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1E5F7A] to-[#0f3344] flex items-center justify-center shadow-2xl shadow-[#1E5F7A]/40 border border-white/10">
            <img
              src="/Logo_Solident.png"
              alt="Solident"
              className="w-14 h-14 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
        </div>

        {/* Status indicator */}
        <div className="inline-flex items-center gap-2 bg-[#F0A500]/10 border border-[#F0A500]/30 text-[#F0A500] text-xs font-semibold px-4 py-2 rounded-full mb-6 tracking-wide">
          <span className="w-2 h-2 bg-[#F0A500] rounded-full animate-pulse" />
          MAINTENANCE EN COURS
        </div>

        {/* Title */}
        <h1 className="text-white text-3xl font-bold mb-3 leading-tight">
          Solident est temporairement<br />
          <span className="text-[#1E5F7A] bg-gradient-to-r from-[#1E5F7A] to-[#5bbcde] bg-clip-text text-transparent">
            hors ligne
          </span>
        </h1>

        <p className="text-white/50 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
          Notre équipe technique effectue une opération de maintenance planifiée.
          La plateforme sera de retour très prochainement.
        </p>

        {/* Separator */}
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mx-auto mb-8" />

        {/* Footer info */}
        <p className="text-white/25 text-xs">
          Bridge de Solidarite des Medecins Dentistes
        </p>
        <p className="text-white/15 text-[11px] mt-1">
          Si vous êtes administrateur,{' '}
          <a href="/login" className="text-[#1E5F7A] hover:text-[#5bbcde] transition underline underline-offset-2">
            connectez-vous ici
          </a>
        </p>
      </div>
    </div>
  )
}