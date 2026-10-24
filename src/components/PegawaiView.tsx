import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Calendar, 
  User as UserIcon, 
  QrCode, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  LogOut, 
  ChevronRight, 
  PenTool,
  CreditCard,
  Building2,
  CalendarPlus,
  Send,
  X,
  Download,
  Phone,
  Mail,
  ShieldCheck,
  Check,
  MapPinHouse,
  Menu,
  ChevronLeft,
  Printer,
  Loader2
} from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { BPAIKUser, BPAIKEvent, AttendanceRecord, LeaveRequest } from '../types';
import { getCardQrCredential } from '../utils/cardQr';
import { SuratIzinPdfModal } from './SuratIzinPdfModal';
import { downloadElementAsPdf } from '../utils/pdfExport';
import { downloadCardElementAsJpg, generateCardCanvasJpg } from '../utils/cardExport';
import { Footer } from './Footer';

interface PegawaiViewProps {
  user: BPAIKUser;
  events: BPAIKEvent[];
  attendanceRecords: AttendanceRecord[];
  onOpenScanner: () => void;
  onOpenSignPad: (record: AttendanceRecord) => void;
  onLogout: () => void;
}

export const PegawaiView: React.FC<PegawaiViewProps> = ({
  user,
  events,
  attendanceRecords,
  onOpenScanner,
  onOpenSignPad,
  onLogout,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateUserProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'beranda' | 'jadwal' | 'kartu' | 'profil'>('beranda');
  const [isDownloadingCardPdf, setIsDownloadingCardPdf] = useState(false);

  // Sync route with active tab & scroll to top: "buka antar halaman mulai dari atas"
  useEffect(() => {
    const p = location.pathname.replace(/^\//, '').split('/')[0];
    if (p === 'jadwal') setActiveTab('jadwal');
    else if (p === 'kartu') setActiveTab('kartu');
    else if (p === 'profil') setActiveTab('profil');
    else if (p === 'presensi' || p === 'beranda' || p === '') setActiveTab('beranda');

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  // Helper to switch tab, navigate URL, and immediately scroll to top
  const handleSelectTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    const targetPath = tab === 'beranda' ? 'beranda' : tab;
    navigate(`/${targetPath}`);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };
  
  // Real QR data URL for digital card
  const [cardQrDataUrl, setCardQrDataUrl] = useState<string>('');

  // Selected Event Detail Modal (from Jadwal list)
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<BPAIKEvent | null>(null);
  
  // Leave Request Modal
  const [eventForLeave, setEventForLeave] = useState<BPAIKEvent | null>(null);
  const [leaveReason, setLeaveReason] = useState('');
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [leaveSuccessMsg, setLeaveSuccessMsg] = useState<string | null>(null);

  // User Leave Requests
  const [myLeaveRequests, setMyLeaveRequests] = useState<LeaveRequest[]>([]);
  const [selectedLeaveForPdf, setSelectedLeaveForPdf] = useState<LeaveRequest | null>(null);

  // 1-Month Calendar State
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<string | null>(null);

  // Profile Edit State
  const [profileForm, setProfileForm] = useState({
    name: user.name || '',
    email: user.email || '',
    jabatan: user.jabatan || '',
    whatsapp: user.whatsapp || '',
    npp: user.npp || '',
    avatarUrl: user.avatarUrl || ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Generate real QR code for digital card
  useEffect(() => {
    const qrCodeValue = getCardQrCredential(user);
    QRCode.toDataURL(qrCodeValue, {
      width: 260,
      margin: 1,
      color: {
        dark: '#062416',
        light: '#ffffff'
      }
    }).then(url => {
      setCardQrDataUrl(url);
    }).catch(err => {
      console.warn('QR generation error:', err);
    });
  }, [user.qrUniqueCode, user.npp, user.id]);

  // Sync profile form when user updates
  useEffect(() => {
    setProfileForm({
      name: user.name || '',
      email: user.email || '',
      jabatan: user.jabatan || '',
      whatsapp: user.whatsapp || '',
      npp: user.npp || '',
      avatarUrl: user.avatarUrl || ''
    });
  }, [user]);

  // Real-time listener for leave requests
  // Sync own leave requests from Worker / D1
  useEffect(() => {
    let active = true;

    const loadLeaves = async () => {
      try {
        const response = await fetch('/api/leaves', { credentials: 'same-origin' });
        const payload = await response.json() as {
          success?: boolean;
          leaves?: LeaveRequest[];
          error?: string;
        };
        if (!response.ok || payload.success !== true || !Array.isArray(payload.leaves)) {
          throw new Error(payload.error || 'Gagal membaca pengajuan izin.');
        }
        if (active) {
          setMyLeaveRequests([...payload.leaves].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ));
        }
      } catch (error) {
        if (active) console.error('D1 leave sync error:', error);
      }
    };

    void loadLeaves();
    const interval = setInterval(() => void loadLeaves(), 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user.id]);

  // User attendance history
  const myAttendanceRecords = attendanceRecords.filter(
    r => r.userEmail.toLowerCase() === user.email.toLowerCase()
  );

  // Unsigned attendances
  const unsignedRecords = myAttendanceRecords.filter(
    r => r.signatureStatus === 'MENUNGGU_KONFIRMASI'
  );

  // Direct JPG Card Download via html2canvas with high-res 3x scale and fallback
  const handleDownloadCardJpg = async () => {
    const cardEl = document.getElementById('kartu-digital-peserta');
    const cleanName = user.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
    const fileName = `kartu-digital-bpaik-${cleanName}.jpg`;

    try {
      if (cardEl) {
        await downloadCardElementAsJpg(cardEl, fileName);
      } else {
        const jpgUrl = await generateCardCanvasJpg(user, cardQrDataUrl);
        const link = document.createElement('a');
        link.href = jpgUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('html2canvas JPG error, falling back to canvas:', err);
      try {
        const jpgUrl = await generateCardCanvasJpg(user, cardQrDataUrl);
        const link = document.createElement('a');
        link.href = jpgUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (fallbackErr) {
        alert('Gagal mengunduh kartu peserta sebagai JPG.');
      }
    }
  };

  // Direct PDF Card Download via jsPDF & html2canvas
  const handleDownloadCardPdf = async () => {
    const cardEl = document.getElementById('kartu-digital-peserta');
    if (!cardEl) return;
    setIsDownloadingCardPdf(true);
    try {
      const cleanName = user.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
      await downloadElementAsPdf(cardEl, {
        fileName: `kartu-peserta-bpaik-${cleanName}.pdf`,
        orientation: 'portrait',
        format: 'a4',
        marginMm: 20
      });
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Gagal mengunduh PDF kartu peserta.');
    } finally {
      setIsDownloadingCardPdf(false);
    }
  };

  // Calendar reminder download (.ics) & Google Calendar link
  const handleCalendarReminder = (event: BPAIKEvent) => {
    const startIso = event.startDateTime ? new Date(event.startDateTime).toISOString() : new Date(`${event.date}T${event.startTime || '08:00'}:00`).toISOString();
    const endIso = event.endDateTime ? new Date(event.endDateTime).toISOString() : new Date(`${event.date}T${event.endTime || '11:00'}:00`).toISOString();
    
    const startCal = startIso.replace(/-|:|\.\d\d\d/g, "");
    const endCal = endIso.replace(/-|:|\.\d\d\d/g, "");

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Universitas Aisyiyah Bandung//PortalBPAIK//ID',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:bpaik-${event.id}-${Date.now()}@unisa-bandung.ac.id`,
      `DTSTAMP:${new Date().toISOString().replace(/-|:|\.\d\d\d/g, "")}`,
      `DTSTART:${startCal}`,
      `DTEND:${endCal}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
      `LOCATION:${event.location}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Pengingat Kegiatan BPAIK UNISA Bandung',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${event.title.substring(0, 25).replace(/[^a-zA-Z0-9]/g, '_')}_Pengingat.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startCal}/${endCal}&details=${encodeURIComponent(event.description || '')}&location=${encodeURIComponent(event.location)}`;
    window.open(googleCalUrl, '_blank');
  };

  // Submit Leave Request
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForLeave || !leaveReason.trim()) return;

    setIsSubmittingLeave(true);
    try {
      const newLeave: Omit<LeaveRequest, 'id'> = {
        userId: user.id,
        userName: user.name,
        userEmail: user.email.toLowerCase(),
        userNpp: user.npp,
        userJabatan: user.jabatan,
        userWhatsapp: user.whatsapp,
        eventId: eventForLeave.id,
        eventTitle: eventForLeave.title,
        eventDate: eventForLeave.date,
        reason: leaveReason.trim(),
        status: 'MENUNGGU_ACC',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const response = await fetch('/api/leaves', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: newLeave.eventId,
          reason: newLeave.reason
        })
      });

      const payload = await response.json() as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || payload.success !== true) {
        throw new Error(payload.error || 'Gagal menyimpan pengajuan izin ke D1.');
      }
      setLeaveSuccessMsg('Pengajuan izin berhasil dikirim. Menunggu persetujuan (ACC) dari Admin BPAIK.');
      setLeaveReason('');
      setTimeout(() => {
        setLeaveSuccessMsg(null);
        setEventForLeave(null);
        setSelectedEventForDetail(null);
      }, 2000);
    } catch (err) {
      console.error('Submit leave error:', err);
      alert('Gagal mengirimkan pengajuan izin.');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  // Handle Profile Photo Upload (Strict 2x3 & max 200KB check)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      setPhotoError('Ukuran foto melebihi batas maksimal 200KB. Silakan pilih foto yang lebih kecil atau kompres terlebih dahulu.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm(prev => ({ ...prev, avatarUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Handle Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSaveSuccess(false);
    try {
      await updateUserProfile({
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
        jabatan: profileForm.jabatan.trim(),
        whatsapp: profileForm.whatsapp.trim(),
        avatarUrl: profileForm.avatarUrl
      });
      setProfileSaveSuccess(true);
      setTimeout(() => setProfileSaveSuccess(false), 3000);
    } catch (err) {
      alert('Gagal memperbarui profil pribadi.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const formatEventDateRange = (ev: BPAIKEvent) => {
    if (ev.startDateTime && ev.endDateTime) {
      const s = new Date(ev.startDateTime);
      const e = new Date(ev.endDateTime);
      const sDate = s.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      const eDate = e.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      const sTime = s.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const eTime = e.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      if (sDate === eDate) {
        return `${sDate} (${sTime} - ${eTime} WIB)`;
      }
      return `${sDate} ${sTime} s/d ${eDate} ${eTime} WIB`;
    }
    return `${ev.date} (${ev.startTime || '08:00'} - ${ev.endTime || '11:00'} WIB)`;
  };

  return (
    <div className="min-h-screen bg-[#f1f5f3] flex flex-col font-sans antialiased text-slate-800">
      
      {/* 1. TOP STICKY HEADER - Flush at top, no floating gap */}
      <header className="sticky top-0 z-30 w-full bg-[#0f613c] border-b border-[#093d26] shadow-md px-4 sm:px-8 py-3 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F4C542] text-slate-950 font-black text-base flex items-center justify-center font-islamic border border-amber-300 shadow-xs"><img src="/images/logoBPAIK.png" alt="Logo BPAIK" className="w-full h-full object-contain" /></div>
          <div>
            <h1 className="text-base sm:text-lg font-bold font-islamic tracking-tight text-white leading-tight flex items-center gap-1.5">
              Portal<span className="text-[#F4C542]">BPAIK</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono font-medium hidden sm:inline">
                Peserta
              </span>
            </h1>
            <p className="text-[10px] sm:text-[11px] text-emerald-200/90 font-medium leading-none mt-0.5">
              Universitas 'Aisyiyah Bandung
            </p>
          </div>
        </div>

        {/* Desktop Navbar Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-[#093d26] p-1 rounded-xl border border-emerald-700/60 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('beranda')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'beranda' ? 'bg-[#F4C542] text-slate-950 shadow-xs' : 'text-emerald-100 hover:text-white'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Beranda</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('jadwal')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'jadwal' ? 'bg-[#F4C542] text-slate-950 shadow-xs' : 'text-emerald-100 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Jadwal Kegiatan</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kartu')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'kartu' ? 'bg-[#F4C542] text-slate-950 shadow-xs' : 'text-emerald-100 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Kartu Digital</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profil')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profil' ? 'bg-[#F4C542] text-slate-950 shadow-xs' : 'text-emerald-100 hover:text-white'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Profil Pribadi</span>
          </button>
        </nav>

        {/* User Monogram & Logout Button */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-white truncate max-w-[160px]">{user.name}</span>
            <span className="text-[10px] text-emerald-200 truncate">{user.jabatan || 'Peserta'}</span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex px-3 py-1.5 bg-red-600/90 hover:bg-red-600 text-white font-bold text-xs rounded-xl items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Keluar Akun"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-30 flex items-center justify-around py-1 px-2 shadow-lg">
        <button
          onClick={() => handleSelectTab('beranda')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 text-[10px] font-bold rounded-lg ${
            activeTab === 'beranda' ? 'text-[#0f613c] bg-emerald-50' : 'text-slate-500'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Beranda</span>
        </button>
        <button
          onClick={() => handleSelectTab('jadwal')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 text-[10px] font-bold rounded-lg ${
            activeTab === 'jadwal' ? 'text-[#0f613c] bg-emerald-50' : 'text-slate-500'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Jadwal</span>
        </button>
        <button
          onClick={() => handleSelectTab('kartu')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 text-[10px] font-bold rounded-lg ${
            activeTab === 'kartu' ? 'text-[#0f613c] bg-emerald-50' : 'text-slate-500'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Kartu</span>
        </button>
        <button
          onClick={() => handleSelectTab('profil')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 text-[10px] font-bold rounded-lg ${
            activeTab === 'profil' ? 'text-[#0f613c] bg-emerald-50' : 'text-slate-500'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          <span>Profil</span>
        </button>
      </nav>

      {/* 2. MAIN CONTENT BODY */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-3.5 sm:p-6 lg:p-8 pb-24 md:pb-10">
        
        {/* ========================================================
            TAB 1: BERANDA USER
        ======================================================== */}
        {activeTab === 'beranda' && (
          <div className="space-y-4 sm:space-y-5">
            
            {/* BLOK 1: Salam Hangat (Compact 3D Card) */}
            <div className="tactile-3d-card p-3.5 sm:p-5 bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/50 border border-emerald-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-islamic text-sm sm:text-base text-[#0f613c] font-bold leading-tight">
                    Assalamu'alaikum
                  </p>
                  <h2 className="text-base sm:text-xl font-extrabold text-slate-900 font-islamic leading-tight mt-0.5">
                    {user.name}
                  </h2>
                  <p className="text-xs sm:text-sm font-calligraphy text-amber-700 font-bold mt-0.5">
                    kayfa haalukum?
                  </p>
                </div>

                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-100/70 border border-emerald-300 overflow-hidden flex items-center justify-center text-emerald-800 shrink-0">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={`Foto profil ${user.name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true" />
                  )}
                </div>
              </div>
            </div>

            {/* Unsigned Attendance Notification */}
            {unsignedRecords.length > 0 && (
              <div className="tactile-3d-card p-3 sm:p-4 bg-amber-50 border-amber-300 border">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <span className="font-bold text-amber-950">Perhatian: </span>
                    <span className="text-amber-900">
                      Anda memiliki {unsignedRecords.length} presensi yang belum ditandatangani. Kehadiran baru sah setelah tanda tangan digital dibubuhkan.
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {unsignedRecords.map(rec => (
                        <button
                          key={rec.id}
                          onClick={() => onOpenSignPad(rec)}
                          className="tactile-3d-btn-accent text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <PenTool className="w-3 h-3" />
                          <span>TTD: {rec.eventTitle.substring(0, 18)}...</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* BLOK 2: Tatacara Absen dan CTA Scan Presensi Sekarang */}
            <div className="tactile-3d-card p-4 sm:p-5 border border-slate-200">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-[#0f613c] flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 font-islamic">
                  Tata Cara Presensi
                </h3>
              </div>

              {/* Exact user requirement instructions */}
              <div className="space-y-2 mb-3 sm:mb-4 bg-emerald-50/70 p-3 sm:p-3.5 rounded-xl border border-emerald-200/90 text-[11px] sm:text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-[#0f613c] shrink-0">1.</span>
                  <p className="font-medium text-slate-800">Buka fitur pemindaian kamera yang tersedia di bawah ini.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-[#0f613c] shrink-0">2.</span>
                  <p className="font-medium text-slate-800">Pindai QR Code yang tersedia pada panitia penjaga buku tamu.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-[#0f613c] shrink-0">3.</span>
                  <p className="font-medium text-slate-800">Sistem akan otomatis menampilkan artboard untuk membubuhkan tanda tangan. Setelah selesai, klik tombol Konfirmasi Kehadiran.</p>
                </div>
                <p className="pt-2 border-t border-emerald-200/80 text-[10px] sm:text-[11px] font-semibold text-emerald-900 italic">
                  Seluruh data presensi akan tercatat dan direkap secara otomatis melalui sistem Portal BPAIK.
                </p>
              </div>

              {/* 3D CTA BUTTON: Scan Presensi Sekarang */}
              <div>
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="w-full py-3.5 px-4 tactile-3d-btn-primary rounded-xl sm:rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <QrCode className="w-4 h-4 sm:w-5 sm:h-5 text-[#F4C542]" />
                  <span className="font-islamic text-sm sm:text-base">Scan Presensi Sekarang</span>
                </button>
                <p className="text-[10px] text-center text-slate-400 mt-2">
                  *Presensi hanya dapat dipindai saat sesi kegiatan sedang aktif dibuka oleh Admin
                </p>
              </div>
            </div>

            {/* BLOK 3: Kegiatan yang Sudah Saya Ikuti */}
            <div className="tactile-3d-card p-4 sm:p-5 border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-[#0f613c] flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 font-islamic">
                    Kegiatan yang Sudah Saya Ikuti
                  </h3>
                </div>
                <span className="text-[10px] sm:text-xs text-slate-500 font-mono">
                  {myAttendanceRecords.length} Kehadiran
                </span>
              </div>

              {myAttendanceRecords.length === 0 && myLeaveRequests.length === 0 ? (
                <div className="bg-slate-50 rounded-xl p-6 sm:p-8 text-center text-slate-400 border border-slate-200 text-xs">
                  <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-700">Belum ada riwayat kegiatan</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Kegiatan yang Anda hadiri akan tercatat secara otomatis di sini.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Attendance records */}
                  {myAttendanceRecords.map(rec => (
                    <div
                      key={rec.id}
                      className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs"
                    >
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {rec.eventTitle}
                        </h4>
                        <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
                          Tanggal: {rec.eventDate} • Pukul {new Date(rec.scanTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{rec.attendanceStatus}</span>
                        </span>

                        {rec.signatureStatus === 'MENUNGGU_KONFIRMASI' ? (
                          <button
                            onClick={() => onOpenSignPad(rec)}
                            className="tactile-3d-btn-accent text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <PenTool className="w-2.5 h-2.5" />
                            <span>TTD Sekarang</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sah Terverifikasi</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Leave records */}
                  {myLeaveRequests.map(leave => (
                    <div
                      key={leave.id}
                      className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded text-[9px] font-bold">
                            PERIZINAN
                          </span>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {leave.eventTitle}
                          </h4>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          Alasan: <span className="italic">{leave.reason}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          leave.status === 'DISETUJUI'
                            ? 'bg-emerald-100 text-emerald-900'
                            : leave.status === 'DITOLAK'
                            ? 'bg-red-100 text-red-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}>
                          {leave.status === 'DISETUJUI' ? 'Izin Disetujui (ACC)' : leave.status === 'DITOLAK' ? 'Izin Ditolak' : 'Menunggu ACC Admin'}
                        </span>

                        {leave.status === 'DISETUJUI' && (
                          <button
                            type="button"
                            onClick={() => setSelectedLeaveForPdf(leave)}
                            className="tactile-3d-btn-accent text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 font-bold shadow-xs cursor-pointer"
                            title="Pratinjau & Cetak Surat Izin Resmi Kepala BPAIK"
                          >
                            <Printer className="w-3 h-3 text-slate-950" />
                            <span className="hidden sm:inline">Surat Izin (PDF)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================================
            TAB 2: JADWAL KEGIATAN & KALENDER 1 BULAN
        ======================================================== */}
        {activeTab === 'jadwal' && (() => {
          const year = calendarMonth.getFullYear();
          const month = calendarMonth.getMonth();
          const monthNames = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
          ];
          const currentMonthName = monthNames[month];

          // 1-Month grid calculation
          const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 Sun, 1 Mon ...
          const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // 0 Mon .. 6 Sun
          const totalDays = new Date(year, month + 1, 0).getDate();

          const calendarCells: { dayNum: number | null; dateStr: string | null; eventsList: BPAIKEvent[] }[] = [];
          for (let i = 0; i < startOffset; i++) {
            calendarCells.push({ dayNum: null, dateStr: null, eventsList: [] });
          }
          for (let d = 1; d <= totalDays; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const matched = events.filter(e => e.date === dateStr);
            calendarCells.push({ dayNum: d, dateStr, eventsList: matched });
          }

          const displayedEvents = calendarSelectedDate 
            ? events.filter(e => e.date === calendarSelectedDate)
            : events;

          const handlePrevMonth = () => {
            setCalendarMonth(new Date(year, month - 1, 1));
            setCalendarSelectedDate(null);
          };

          const handleNextMonth = () => {
            setCalendarMonth(new Date(year, month + 1, 1));
            setCalendarSelectedDate(null);
          };

          const todayStr = new Date().toISOString().split('T')[0];

          return (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base sm:text-xl font-bold font-islamic text-slate-900">
                    Jadwal & Kalender Kegiatan BPAIK
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    Kalender 1 bulan dengan penanda kegiatan BPAIK UNISA. Klik tanggal untuk memfilter agenda.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {calendarSelectedDate && (
                    <button
                      type="button"
                      onClick={() => setCalendarSelectedDate(null)}
                      className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Tampilkan Semua
                    </button>
                  )}
                  <span className="text-xs text-emerald-800 font-mono font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    {events.length} Agenda
                  </span>
                </div>
              </div>

              {/* 1-Month Calendar Card with BPAIK indicators */}
              <div className="tactile-3d-card p-4 sm:p-5 border border-slate-200">
                {/* Month Navigator Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#0f613c]" />
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 font-islamic">
                      {currentMonthName} {year}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors"
                      title="Bulan Sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCalendarMonth(new Date());
                        setCalendarSelectedDate(null);
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    >
                      Bulan Ini
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors"
                      title="Bulan Selanjutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Day of Week Headers */}
                <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider mb-1">
                  <span>Sen</span>
                  <span>Sel</span>
                  <span>Rab</span>
                  <span>Kam</span>
                  <span>Jum</span>
                  <span className="text-amber-700">Sab</span>
                  <span className="text-red-700">Ahd</span>
                </div>

                {/* Calendar Days 7-column Grid */}
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
                  {calendarCells.map((cell, idx) => {
                    if (!cell.dayNum || !cell.dateStr) {
                      return <div key={`empty-${idx}`} className="h-11 sm:h-13 rounded-lg bg-slate-50/50" />;
                    }

                    const hasEvent = cell.eventsList.length > 0;
                    const isToday = cell.dateStr === todayStr;
                    const isSelected = cell.dateStr === calendarSelectedDate;

                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        onClick={() => {
                          setCalendarSelectedDate(isSelected ? null : cell.dateStr);
                        }}
                        className={`h-11 sm:h-13 p-1 rounded-xl flex flex-col items-center justify-between transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-[#0f613c] text-white shadow-md ring-2 ring-amber-400'
                            : hasEvent
                            ? 'bg-emerald-50 text-emerald-950 border border-emerald-300 hover:bg-emerald-100 font-bold'
                            : isToday
                            ? 'bg-amber-50 text-amber-950 border border-amber-300 font-bold'
                            : 'bg-white hover:bg-slate-50 border border-slate-100 text-slate-700'
                        }`}
                      >
                        <span className={`text-[10px] sm:text-xs font-semibold ${isSelected ? 'text-white' : ''}`}>
                          {cell.dayNum}
                        </span>

                        {hasEvent && (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse ring-1 ring-white" />
                            <span className={`text-[7.5px] font-mono leading-none font-bold px-1 py-0.2 rounded ${
                              isSelected ? 'bg-amber-400 text-slate-950' : 'bg-emerald-700 text-white'
                            }`}>
                              BPAIK
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between text-[10px] sm:text-[11px] text-slate-500 gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                      <span>Ada Kegiatan BPAIK</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span>Hari Ini</span>
                    </div>
                  </div>
                  <span className="italic text-slate-400">
                    {calendarSelectedDate ? `Menampilkan tanggal: ${calendarSelectedDate}` : 'Klik tanggal untuk filter'}
                  </span>
                </div>
              </div>

              {/* Agenda Cards List */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 font-islamic flex items-center justify-between">
                  <span>Daftar Kegiatan {calendarSelectedDate ? `(${calendarSelectedDate})` : 'Mendatang'}</span>
                  <span className="text-[11px] text-slate-500 font-mono font-normal">
                    {displayedEvents.length} Kegiatan
                  </span>
                </h4>

                {displayedEvents.length === 0 ? (
                  <div className="tactile-3d-card p-6 text-center text-slate-400 border border-slate-200 text-xs">
                    <Calendar className="w-8 h-8 mx-auto text-slate-300 mb-1.5" />
                    <p className="font-bold text-slate-700">Tidak ada agenda pada tanggal ini</p>
                    <button
                      type="button"
                      onClick={() => setCalendarSelectedDate(null)}
                      className="mt-2 text-[11px] text-[#0f613c] font-bold underline cursor-pointer"
                    >
                      Tampilkan semua jadwal
                    </button>
                  </div>
                ) : (
                  displayedEvents.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEventForDetail(ev)}
                      className="tactile-3d-card p-3.5 sm:p-4.5 border border-slate-200 hover:border-emerald-400 cursor-pointer transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                            BPAIK UNISA
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{ev.date}</span>
                        </div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#0f613c] transition-colors leading-snug">
                          {ev.title}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatEventDateRange(ev)}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-bold text-emerald-700 group-hover:translate-x-0.5 transition-transform hidden sm:inline">
                          Detail
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0f613c] transition-colors" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })()}

        {/* ========================================================
            TAB 3: KARTU DIGITAL PESERTA
            - Format portrait 260px x 400px
            - KOP 1:5 dari tinggi kartu (~80px)
            - Foto 2x3 shifted upwards, uncompressed & proporsional
            - Compact, padat, tanpa space kosong berlebih
        ======================================================== */}
        {activeTab === 'kartu' && (
          <div className="space-y-4 flex flex-col items-center">
            <div className="text-center">
              <h2 className="text-base sm:text-lg font-bold font-islamic text-slate-900">
                kartu digital peserta kegiatan BPAIK
              </h2>
              <p className="text-[11px] text-slate-500">
                Kartu identitas resmi portrait dengan rasio KOP 1:5 dan foto 2x3 proporsional
              </p>
            </div>

            {/* PHYSICAL KTP/PORTRAIT CARD (Strictly matching official reference) */}
            <div 
              id="kartu-digital-peserta"
              className="w-[280px] sm:w-[300px] h-[450px] sm:h-[470px] bg-white rounded-3xl border-2 border-[#063921] shadow-xl overflow-hidden relative break-inside-avoid flex flex-col justify-between select-none"
            >
              {/* 1. HEADER: Deep Forest Green (#073922) */}
              <div className="bg-[#073922] text-white p-3.5 flex items-center gap-2.5 shrink-0">
                <div className="w-11 h-11 rounded-full bg-white p-1 shrink-0 flex items-center justify-center shadow-xs">
                  <img
                    src="/images/logoBPAIK.png"
                    alt="Logo UNISA"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <h4 className="text-[11px] font-black tracking-wider uppercase text-[#F4C542] font-serif leading-tight">
                    UNIVERSITAS 'AISYIYAH<br />BANDUNG
                  </h4>
                  <p className="text-[8.5px] text-white/95 font-medium tracking-normal mt-0.5 leading-tight">
                    Badan Pengembangan Al-Islam &<br />Kemuhammadiyahan
                  </p>
                </div>
              </div>

              {/* Solid Gold Accent Divider Line */}
              <div className="w-full h-[2.5px] bg-[#F4C542] shrink-0" />

              {/* Sub-header Bar: Light Mint with green dot */}
              <div className="bg-[#eaf5ee] px-3.5 py-1 flex items-center justify-between border-b border-[#c8e5d6] text-[8.5px] font-bold text-[#093d26] tracking-wider font-mono shrink-0">
                <span className="truncate">KARTU DIGITAL PESERTA BPAIK</span>
                <div className="flex items-center gap-1 text-[#0f613c] font-black shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                  <span>AKTIF</span>
                </div>
              </div>

              {/* 2. BODY: Foto 2x3 Proporsional (strictly NOT gepeng) & Identitas */}
              <div className="p-3.5 flex-1 flex flex-col items-center justify-between text-center bg-white">
                {/* Foto Profil strictly 2:3 Aspect Ratio (w: 84px, h: 126px) - NEVER STRETCHED / GEPENG */}
                <div className="w-[84px] h-[126px] aspect-[2/3] rounded-2xl border-2 border-[#0f613c] bg-[#eaf5ee] overflow-hidden shadow-xs shrink-0 flex items-center justify-center mt-0.5">
                  {user.avatarUrl ? (
                    <img 
                      src={user.avatarUrl} 
                      alt={user.name} 
                      className="w-full h-full object-cover object-top" 
                    />
                  ) : (
                    <div className="w-full h-full bg-[#0f613c] text-white flex flex-col items-center justify-center p-1 text-center">
                      <span className="text-xl font-black font-islamic">
                        {user.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </span>
                      <span className="text-[7.5px] text-[#F4C542] mt-0.5 font-bold font-mono">2:3</span>
                    </div>
                  )}
                </div>

                {/* Nama User, NPP & Jabatan */}
                <div className="w-full my-1 space-y-0.5">
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 font-serif leading-tight line-clamp-2 px-1">
                    {user.name}
                  </h3>
                  <p className="text-[10px] text-[#0d6b46] font-mono font-black tracking-wide">
                    {user.npp || 'NPP. -'}
                  </p>
                  <p className="text-[9.5px] text-slate-500 font-medium truncate px-1">
                    {user.jabatan || 'Peserta Pembinaan'}
                  </p>
                </div>

                {/* 3. SCANNABLE QR CODE IN ROUNDED WHITE BOX */}
                <div className="w-24 h-24 shrink-0 rounded-2xl border border-slate-300 bg-white p-1.5 shadow-2xs flex items-center justify-center">
                  {cardQrDataUrl ? (
                    <img src={cardQrDataUrl} alt="QR Cadangan" className="w-full h-full object-contain" />
                  ) : (
                    <QrCode className="w-8 h-8 text-[#0f613c]" />
                  )}
                </div>
              </div>

              {/* 4. FOOTER */}
              <div className="bg-slate-50 px-3.5 py-1.5 border-t border-slate-200 flex items-center justify-between text-[8px] text-slate-500 font-mono shrink-0">
                <div className="flex items-center gap-1 text-[#0f613c] font-bold">
                  <ShieldCheck className="w-3 h-3 text-[#0f613c]" />
                  <span className="truncate max-w-[140px]">{user.qrUniqueCode || user.npp || user.id}</span>
                </div>
                <span className="italic text-slate-400 font-serif">Portal BPAIK</span>
              </div>
            </div>

            {/* ACTION BUTTONS (Print preview & direct PDF & JPG download) */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={isDownloadingCardPdf}
                onClick={handleDownloadCardPdf}
                className="tactile-3d-btn-accent px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-60"
                title="Unduh langsung file PDF kartu digital"
              >
                {isDownloadingCardPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-slate-950" />
                    <span>Unduh PDF (.pdf)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="tactile-3d-btn-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm border border-slate-300"
                title="Cetak kartu dengan driver printer device"
              >
                <Printer className="w-3.5 h-3.5 text-slate-700" />
                <span>Cetak Kartu (Print)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCardJpg}
                className="tactile-3d-btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-[#F4C542]" />
                <span>Unduh JPG</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: PROFIL PRIBADI
        ======================================================== */}
        {activeTab === 'profil' && (
          <div className="max-w-xl mx-auto space-y-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-islamic text-slate-900">
                Profil Pribadi Peserta
              </h2>
              <p className="text-xs text-slate-500">
                Perbarui data diri, nomor kontak WhatsApp, serta foto profil resmi (ukuran 2x3 maksimal 200KB).
              </p>
            </div>

            {profileSaveSuccess && (
              <div className="tactile-3d-card p-3 bg-emerald-50 border-emerald-300 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">Profil pribadi Anda berhasil diperbarui!</span>
              </div>
            )}

            {photoError && (
              <div className="tactile-3d-card p-3 bg-red-50 border-red-300 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{photoError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="tactile-3d-card p-4 sm:p-6 border border-slate-200 space-y-4">
              {/* Foto Profil 2x3 Upload */}
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-[60px] h-[90px] rounded-lg bg-slate-100 border-2 border-emerald-500 overflow-hidden shrink-0 flex items-center justify-center relative group">
                  {profileForm.avatarUrl ? (
                    <img src={profileForm.avatarUrl} alt="Foto 2x3" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-8 h-8 text-slate-400" />
                  )}
                </div>

                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Foto Profil (Ukuran 2x3, Maks. 200KB)
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoUpload}
                    className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-[#0f613c] hover:file:bg-emerald-100 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Disarankan foto formal latar belakang biru/merah untuk kartu digital.
                  </p>
                </div>
              </div>

              {/* Nama Lengkap */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap & Gelar
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={e => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {/* Email Pribadi (Bukan Email Kampus) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Pribadi (Bukan Email Kampus)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="contoh: nama.pribadi@gmail.com"
                    value={profileForm.email}
                    onChange={e => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              {/* Jabatan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jabatan
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="contoh: Dosen Farmasi / Staff Akademik"
                    value={profileForm.jabatan}
                    onChange={e => setProfileForm(prev => ({ ...prev, jabatan: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              {/* No. WhatsApp */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  No. WhatsApp Aktif
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="081234567890"
                    value={profileForm.whatsapp}
                    onChange={e => setProfileForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              {/* NPP */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Pokok Pegawai (NPP)
                </label>
                <input
                  type="text"
                  value={profileForm.npp}
                  onChange={e => setProfileForm(prev => ({ ...prev, npp: e.target.value }))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 font-mono"
                />
              </div>

              {/* 3D Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-full py-2.5 px-4 tactile-3d-btn-primary rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Check className="w-4 h-4 text-[#F4C542]" />
                  <span>{isSavingProfile ? 'Menyimpan...' : 'Simpan Perubahan Profil'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

      </main>

      {/* POPUP DETAIL KEGIATAN */}
      {selectedEventForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="tactile-3d-card w-full max-w-lg bg-white p-5 sm:p-6 border border-slate-200 max-h-[90vh] flex flex-col justify-between animate-in zoom-in-95 duration-150">
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    Detail Kegiatan BPAIK
                  </span>
                  <h3 className="text-base sm:text-lg font-bold font-islamic text-slate-900 mt-1">
                    {selectedEventForDetail.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedEventForDetail(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs text-slate-600 mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="font-semibold">{formatEventDateRange(selectedEventForDetail)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="truncate">{selectedEventForDetail.location}</span>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Deskripsi Kegiatan:
                </h4>
                <div className="text-xs text-slate-600 leading-relaxed max-h-48 overflow-y-auto p-3 bg-slate-50/70 rounded-xl border border-slate-100 whitespace-pre-wrap">
                  {selectedEventForDetail.description || 'Tidak ada deskripsi rinci untuk kegiatan ini.'}
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => handleCalendarReminder(selectedEventForDetail)}
                className="flex-1 py-2.5 px-3 tactile-3d-btn-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CalendarPlus className="w-4 h-4 text-[#0f613c]" />
                <span>Ingatkan Saya</span>
              </button>

              <button
                type="button"
                onClick={() => setEventForLeave(selectedEventForDetail)}
                className="flex-1 py-2.5 px-3 tactile-3d-btn-accent rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-4 h-4 text-slate-900" />
                <span>Izin Tidak Hadir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP AJUKAN IZIN */}
      {eventForLeave && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="tactile-3d-card w-full max-w-md bg-white p-5 sm:p-6 border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold font-islamic text-slate-900">
                  Pengajuan Izin Kegiatan
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {eventForLeave.title}
                </p>
              </div>
              <button
                onClick={() => setEventForLeave(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {leaveSuccessMsg ? (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{leaveSuccessMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitLeave} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alasan Izin Tidak Mengikuti Kegiatan:
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Tuliskan alasan izin (misal: tugas kedinasan, sakit, atau urusan penting keluarga)..."
                    value={leaveReason}
                    onChange={e => setLeaveReason(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div className="text-[10px] text-slate-500 bg-amber-50 p-2 rounded-lg border border-amber-200">
                  *Pengajuan izin berstatus <strong>Menunggu ACC</strong> dan harus disetujui oleh Admin BPAIK sebelum tercatat resmi.
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEventForLeave(null)}
                    className="px-3 py-2 text-xs text-slate-500 font-bold hover:bg-slate-100 rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingLeave}
                    className="tactile-3d-btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-[#F4C542]" />
                    <span>{isSubmittingLeave ? 'Mengirim...' : 'Ajukan Izin'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL SURAT IZIN TIDAK HADIR RESMI (PDF) */}
      {selectedLeaveForPdf && (
        <SuratIzinPdfModal
          leave={selectedLeaveForPdf}
          onClose={() => setSelectedLeaveForPdf(null)}
        />
      )}

      {/* FOOTER AT THE VERY BOTTOM */}
      <Footer />

    </div>
  );
};
