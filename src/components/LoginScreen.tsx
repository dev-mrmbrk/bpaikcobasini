import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, ArrowRight, HelpCircle, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Footer } from './Footer';

import { CardLoginModal } from './CardLoginModal';

export const LoginScreen: React.FC = () => {
  const { loginWithGoogle, isLoading, error, rememberMe, setRememberMe } = useAuth();
  const [showHelp, setShowHelp] = useState(false);
  const [showCardScanner, setShowCardScanner] = useState(false);

  return (
    <div className="min-h-[100svh] w-full bg-[#f7fcf8] relative isolate flex flex-col font-sans antialiased overflow-x-hidden">
      <picture aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[100svh] -z-10 overflow-hidden">
        <source media="(min-width: 768px)" srcSet="/images/Login_BG_BPAIK_Desktop.jpg" />
        <img
          src="/images/Login_BG_BPAIK_Mobile.jpg"
          alt=""
          className="h-full w-full object-cover object-center"
        />
      </picture>
      {/* Decorative ambient dashed geometric paths */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30 hidden" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M -50,120 Q 200,-50 450,150 T 950,80 T 1450,180"
          fill="none"
          stroke="#10b981"
          strokeWidth="3"
          strokeDasharray="12 12"
        />
        <path
          d="M 100,750 Q 500,850 900,600 T 1500,700"
          fill="none"
          stroke="#0284c7"
          strokeWidth="3"
          strokeDasharray="14 14"
        />
        <circle cx="90%" cy="18%" r="130" fill="none" stroke="#F4C542" strokeWidth="2" strokeDasharray="8 8" opacity="0.3" />
      </svg>

      <div className="relative z-10 flex-1 flex items-start md:items-start justify-end w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 pt-[53vh] pb-6 md:pt-[215px] md:pb-8">
        {/* Main 3D Card Container */}
        <div className="relative w-full max-w-[1440px] bg-transparent rounded-none shadow-none border-0 overflow-visible flex flex-col items-end min-h-0 md:min-h-[calc(100svh-120px)]">
          
          {/* LEFT COLUMN: Academic Illustration with curved wave and Islamic Header */}
          <div className="hidden">
            <div className="absolute -top-12 -bottom-12 -right-16 w-36 bg-white hidden md:block rounded-l-[100%] pointer-events-none" />

            {/* Top Brand & Bismillah */}
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/25 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#F4C542] animate-ping" />
                  <span className="text-[11px] font-bold tracking-wide text-white font-islamic">Universitas 'Aisyiyah</span>
                </div>
                <span className="text-[10px] text-emerald-200 font-mono tracking-wider">BPAIK • UNISA</span>
              </div>
              <div className="font-calligraphy text-base sm:text-lg text-[#F4C542] tracking-widest opacity-95 text-center mt-1">
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </div>
            </div>

            {/* SVG Illustration: Academic Workstation */}
            <div className="relative z-10 my-auto py-2 flex items-center justify-center">
              <svg viewBox="0 0 420 300" className="w-full max-w-[280px] h-auto drop-shadow-md select-none" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="210" cy="190" rx="150" ry="70" fill="white" fillOpacity="0.08" />

                {/* Left Potted Plant */}
                <g id="plant-left">
                  <path d="M 65,245 L 85,245 L 81,270 L 69,270 Z" fill="#334155" />
                  <path d="M 62,245 L 88,245" stroke="#1e293b" strokeWidth="2.5" />
                  <path d="M 75,245 Q 60,200 45,185 Q 55,210 75,245" fill="#34d399" />
                  <path d="M 75,245 Q 75,180 65,160 Q 80,185 75,245" fill="#10b981" />
                  <path d="M 75,245 Q 90,195 105,180 Q 92,205 75,245" fill="#059669" />
                  <path d="M 75,245 Q 55,225 35,220 Q 55,235 75,245" fill="#6ee7b7" />
                </g>

                {/* Work Desk Table */}
                <g id="desk">
                  <rect x="130" y="195" width="200" height="12" rx="3" fill="#64748b" />
                  <rect x="255" y="207" width="65" height="65" rx="3" fill="#475569" />
                  <line x1="265" y1="228" x2="310" y2="228" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                  <line x1="265" y1="250" x2="310" y2="250" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                  <line x1="145" y1="207" x2="145" y2="272" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
                </g>

                {/* Computer Monitor */}
                <g id="monitor">
                  <ellipse cx="230" cy="195" rx="16" ry="3" fill="#1e293b" />
                  <rect x="228" y="175" width="4" height="20" fill="#334155" />
                  <rect x="195" y="125" width="70" height="52" rx="4" fill="#0f172a" />
                  <rect x="198" y="128" width="64" height="44" rx="2" fill="#0369a1" />
                  <rect x="203" y="133" width="16" height="16" rx="2" fill="#F4C542" />
                  <line x1="225" y1="135" x2="256" y2="135" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
                  <line x1="225" y1="141" x2="250" y2="141" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
                  <line x1="203" y1="156" x2="256" y2="156" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="215" cy="164" r="3" fill="#38bdf8" />
                  <circle cx="230" cy="164" r="3" fill="#F4C542" />
                  <circle cx="245" cy="164" r="3" fill="#34d399" />
                </g>

                {/* Person */}
                <g id="person">
                  <path d="M 148,118 Q 155,108 166,112 Q 174,116 170,128 Q 165,124 158,124 Q 152,126 148,118 Z" fill="#0f172a" />
                  <ellipse cx="162" cy="124" rx="7.5" ry="9" fill="#fed7aa" />
                  <path d="M 158,133 L 166,133 L 164,152 L 160,152 Z" fill="#0284c7" />
                  <path d="M 152,133 L 172,133 L 176,178 L 148,178 Z" fill="#ffffff" />
                  <line x1="162" y1="133" x2="162" y2="178" stroke="#cbd5e1" strokeWidth="1" />
                  <path d="M 152,142 Q 170,158 188,188" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" />
                  <ellipse cx="188" cy="188" rx="4" ry="4" fill="#fed7aa" />
                  <path d="M 150,178 L 180,185 L 176,242 L 164,242 L 166,195 L 148,190 Z" fill="#0369a1" />
                  <path d="M 162,242 L 182,242 Q 186,247 180,250 L 160,250 Z" fill="#1e293b" />
                </g>
              </svg>
            </div>

            {/* Bottom Caption */}
            <div className="relative z-10 font-islamic text-xs text-white font-bold leading-snug">
              Presensi Kegiatan Kajian & Pembinaan Rutinan
            </div>
          </div>

          {/* RIGHT COLUMN: Clean Login - ONLY Google Auth */}
          <div className="w-full md:w-[48%] lg:w-[45%] max-w-[660px] p-5 sm:p-8 flex flex-col justify-center gap-4 bg-transparent text-slate-800 rounded-none shadow-none border-0 backdrop-blur-0">
            
            {/* Header & Brand Identity */}
            <div>

              <p className="text-sm font-bold font-islamic text-emerald-950 mt-2 leading-snug">
                Presensi Kegiatan Kajian dan Pembinaan Rutinan
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Pegawai dan Civitas Akademik Universitas 'Aisyiyah Bandung
              </p>
            </div>

            {/* Main Action Section: Google Sign In Only */}
            <div className="my-5 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-tight">
                    <span className="font-bold">Akses Terkendala: </span>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Primary Google Sign In Button + Camera QR Card Login */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  disabled={isLoading}
                  className="flex-1 h-13 tactile-3d-btn-primary rounded-xl sm:rounded-2xl flex items-center justify-between px-3 sm:px-4 shadow-md group disabled:opacity-50 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white shadow-xs shrink-0">
                    {/* Official Google G Logo mark in white circle */}
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#fff"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#fff"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#fff"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#fff"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  </div>
                  <span className="font-islamic text-xs sm:text-sm md:text-base tracking-wide font-bold truncate mx-1 sm:mx-2">
                    {isLoading ? 'Menghubungkan...' : 'Masuk dengan Akun Google'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#F4C542] group-hover:translate-x-1 transition-transform shrink-0" />
                </button>

                {/* Ikon Kamera di samping CTA untuk Login Kartu Peserta */}
                <button
                  type="button"
                  onClick={() => setShowCardScanner(true)}
                  className="h-13 w-13 shrink-0 tactile-3d-btn-accent rounded-xl sm:rounded-2xl flex flex-col items-center justify-center cursor-pointer shadow-md group border border-amber-400 hover:scale-[1.02] active:scale-95 transition-all"
                  title="Pindai QR Kartu Peserta untuk Masuk"
                  aria-label="Scan QR Kartu Peserta"
                >
                  <Camera className="w-5 h-5 text-slate-950 group-hover:scale-110 transition-transform" />
                  <span className="text-[8px] font-black text-slate-900 leading-none mt-0.5 uppercase tracking-tighter">Kartu</span>
                </button>
              </div>

              {/* Functional Remember Me Checkbox */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0f613c] focus:ring-0 border-slate-300 accent-[#0f613c] cursor-pointer"
                  />
                  <span className="font-semibold text-slate-800 text-[11px] sm:text-xs">
                    Ingat saya di perangkat ini
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowHelp(!showHelp)}
                  className="text-xs text-[#0284c7] hover:underline font-semibold"
                >
                  Bantuan
                </button>
              </div>

              {showHelp && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 leading-relaxed animate-in fade-in">
                  Gunakan akun Google aktif Anda yang terdaftar pada BPAIK Universitas 'Aisyiyah Bandung. Anda juga dapat menggunakan QR pada kartu identitas peserta kegiatan yang di terbitkan oleh PortalBPAIK.
                </div>
              )}
            </div>

            {/* Micro Note */}
            <div className="mt-3 text-center text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>Badan Pengembangan Al-Islam & Kemuhammadiyahan UNISA Bandung</span>
            </div>

          </div>

        </div>
      </div>

      {/* Card QR Login Scanner Modal */}
      {showCardScanner && (
        <CardLoginModal
          onClose={() => setShowCardScanner(false)}
          onSuccess={() => {
            setShowCardScanner(false);
          }}
        />
      )}
      {/* Footer resmi bersama halaman Admin dan Pegawai */}
      <Footer />
    </div>
  );
};
