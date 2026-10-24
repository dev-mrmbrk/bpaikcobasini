import React from 'react';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  ExternalLink, 
  ShieldCheck, 
  Award,
  Globe,
  BookOpen,
  CalendarCheck,
  FileText
} from 'lucide-react';

/**
 * Authentic vector emblem for Universitas 'Aisyiyah Bandung (UNISA Bandung) & BPAIK
 */
export const UnisaEmblem: React.FC<{ size?: number; className?: string }> = ({
  size = 48,
  className = ''
}) => (
  <img
    src="/images/logoBPAIK.png"
    alt="Logo BPAIK"
    width={size}
    height={size}
    className={`object-contain ${className}`}
    loading="eager"
  />
);

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#0a462b] text-emerald-100 border-t-2 border-[#F4C542]/50 shadow-[0_-10px_25px_rgba(0,0,0,0.15)] mt-auto select-none">
      {/* Top Section with Gold Accent Bar */}
      <div className="w-full h-1 bg-gradient-to-r from-emerald-600 via-[#F4C542] to-emerald-600 opacity-90" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          
          {/* COLUMN 1: Official University Branding & Identity (6 cols on lg) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center gap-3.5">
              <div className="p-1 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/15 shadow-sm">
                <UnisaEmblem size={54} />
              </div>
              <div>
                <h3 className="font-extrabold font-islamic text-base sm:text-lg text-white tracking-wide leading-tight">
                  PortalBPAIK
                </h3>
                <p className="text-xs font-semibold text-[#F4C542] tracking-wide mt-0.5 font-islamic">
                  Badan Pengembangan Al-Islam & Kemuhammadiyahan
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/60 font-mono font-medium">
                    VersiWeb v1.1
                  </span>
                  <span className="text-[10px] text-emerald-300/80 font-medium font-islamic">
                    Berkemajuan & Berakhlak Mulia
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-emerald-100/80 leading-relaxed text-justify max-w-xl">
              Portal digital resmi pengelolaan presensi kegiatan kajian rutin, baitul arqam, pembinaan ideologi, dan penguatan nilai-nilai Al-Islam Kemuhammadiyahan bagi seluruh dosen, tenaga kependidikan, dan civitas akademika Universitas 'Aisyiyah Bandung.
            </p>

            {/* Institutional Badges / Affiliation */}
            <div className="pt-2 flex flex-wrap items-center gap-2 text-[11px] text-emerald-200">
              <div className="flex items-center gap-1.5 bg-emerald-900/50 px-2.5 py-1 rounded-lg border border-emerald-700/50">
                <ShieldCheck className="w-3.5 h-3.5 text-[#F4C542]" />
                <span className="font-medium">Otentikasi Google Workspace</span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-900/50 px-2.5 py-1 rounded-lg border border-emerald-700/50">
                <Award className="w-3.5 h-3.5 text-[#F4C542]" />
                <span className="font-medium">Akreditasi Institusi BAIK SEKALI</span>
              </div>
            </div>
          </div>

          {/* COLUMN 2: Layanan & Fitur Utama Portal (3 cols on lg) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono border-b border-emerald-800/80 pb-2 flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5 text-[#F4C542]" />
              <span>Fitur Portal</span>
            </h4>
            <ul className="space-y-2 text-xs text-emerald-200/90">
              <li className="flex items-center gap-2 hover:text-white transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F4C542]" />
                <span>Presensi QR Dinamis</span>
              </li>
              <li className="flex items-center gap-2 hover:text-white transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F4C542]" />
                <span>Tanda Tangan Digital Wajib</span>
              </li>
              <li className="flex items-center gap-2 hover:text-white transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F4C542]" />
                <span>Kartu Identitas Digital</span>
              </li>
              <li className="flex items-center gap-2 hover:text-white transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F4C542]" />
                <span>Pengajuan Izin Online (ACC)</span>
              </li>
              <li className="flex items-center gap-2 hover:text-white transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F4C542]" />
                <span>Rekap Absensi & Audit Trail</span>
              </li>
            </ul>
          </div>

          {/* COLUMN 3: Informasi Kampus & Kantor BPAIK (3 cols on lg) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono border-b border-emerald-800/80 pb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#F4C542]" />
              <span>Lokasi & Kontak</span>
            </h4>

            <div className="space-y-2.5 text-xs text-emerald-200/90">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#F4C542] shrink-0 mt-0.5" />
                <div className="leading-snug">
                  <span className="font-bold text-white block">Kantor BPAIK UNISA Bandung</span>
                  <span>Gedung PESMA UNISA Bandung Jl. Terusan Rancagoong II No.1, Gumuruh, Kec. Batununggal, Kota Bandung 40275</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#F4C542] shrink-0" />
                <div>
                  <span className="text-slate-300 mr-1">WhatsApp Layanan:</span>
                  <a 
                    href="https://wa.me/6281223344550" 
                    target="_blank" 
                    rel="noreferrer"
                    className="font-mono font-bold text-white hover:text-[#F4C542] transition-colors"
                  >
                    0812-2334-4550
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#F4C542] shrink-0" />
                <div>
                  <span className="text-slate-300 mr-1">Email:</span>
                  <a 
                    href="mailto:bpaik@unisa-bandung.ac.id" 
                    className="font-mono text-white hover:text-[#F4C542] transition-colors underline decoration-emerald-600"
                  >
                    bpaik@unisa-bandung.ac.id
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-[#F4C542] shrink-0" />
                <div className="text-[11px] text-emerald-200">
                  <span>Senin – Jumat | 08.00 – 16.00 WIB</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM COPYRIGHT & LEGAL BAR */}
        <div className="mt-10 pt-5 border-t border-emerald-800/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <span className="text-[11px]">
              © {new Date().getFullYear()} <strong>Universitas 'Aisyiyah Bandung</strong>. Hak Cipta Dilindungi Undang-Undang.
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="font-islamic text-white font-bold tracking-wide">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </span>
            <span className="text-emerald-500">|</span>
            <span className="text-emerald-200 font-mono text-[10px]">
              BPAIK UNISA Bandung
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
};
