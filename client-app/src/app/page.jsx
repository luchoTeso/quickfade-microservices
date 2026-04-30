"use client";

import { useState, useEffect } from 'react';

// --- CONFIGURACIÓN DE PAÍSES (i18n Básico y Textos Originales) ---
const COUNTRIES = {
  CO: {
    name: 'Colombia', lang: 'es', currency: 'COP', symbol: '$', phone: '+57',
    i18n: {
      urgency: '⚡ Alta demanda — Solo quedan {slots} turnos hoy',
      heroTitle: 'Agenda tu Turno<br/>en Segundos',
      heroSub: 'Reserva online 24/7. Sin esperas. Confirmación inmediata. Tu tiempo vale demasiado.',
      p1Title: '¿Qué servicio necesitas?', p1Sub: 'Selecciona el servicio para ver disponibilidad en tiempo real',
      p2Title: 'Elige tu Especialista', p2Sub: 'Todos verificados y calificados por clientes reales',
      p3Title: 'Selecciona Fecha y Hora', p3Sub: 'Los turnos se bloquean en tiempo real',
      p3bSub: 'Horarios disponibles',
      p4Title: 'Tus Datos', p4Sub: 'Recibirás confirmación inmediata por WhatsApp',
      p5Title: 'Confirma tu Reserva', p5Sub: 'Revisa los detalles antes de confirmar',
      lblName: 'Nombre completo', lblPhone: 'Teléfono / WhatsApp', lblEmail: 'Correo Electrónico',
      trust1: 'Datos 100% seguros', trust2: 'Cita #7 es GRATIS 🎁',
      btnConfirm: '🎯 Pagar Anticipo y Agendar',
      confirmNote: 'Al confirmar pagas el 50% de reserva. Tu turno quedará bloqueado inmediatamente.',
      successTitle: '¡Turno Confirmado!', successSub: 'Te enviamos confirmación por WhatsApp y correo electrónico.',
      btnNew: '+ Agendar Otro Turno',
      sl1:'Servicio', sl2:'Especialista', sl3:'Fecha & Hora', sl4:'Datos', sl5:'Confirmar',
      months: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
      days: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
      summaryService:'Servicio', summaryProvider:'Especialista', summaryDate:'Fecha',
      summaryTime:'Hora', summaryPrice:'Total', summaryName:'Cliente', summaryDeposit:'Anticipo (50%)', summaryLocalPay:'Pago en local',
      btnNext1:'Elegir Especialista →',btnNext2:'Ver Horarios →',btnNext3:'Continuar →',btnNext4:'Revisar Reserva →',btnBack:'← Atrás',
      toastMsg: 'acaba de agendar una cita', popular: '🔥 Popular'
    }
  },
  FR: {
    name: 'France', lang: 'fr', currency: 'EUR', symbol: '€', phone: '+33',
    i18n: {
      urgency: '⚡ Forte demande — Plus que {slots} créneaux aujourd\'hui',
      heroTitle: 'Réservez votre Rendez-vous<br/>en Quelques Secondes',
      heroSub: 'Réservation en ligne 24h/7j. Sans attente. Confirmation immédiate. Votre temps est précieux.',
      p1Title: 'Quel service souhaitez-vous ?', p1Sub: 'Sélectionnez un service pour voir les disponibilités',
      p2Title: 'Choisissez votre Spécialiste', p2Sub: 'Tous vérifiés et notés par de vrais clients',
      p3Title: 'Choisissez la Date et l\'Heure', p3Sub: 'Les créneaux sont bloqués en temps réel',
      p3bSub: 'Horaires disponibles',
      p4Title: 'Vos Coordonnées', p4Sub: 'Vous recevrez une confirmation immédiate par SMS',
      p5Title: 'Confirmez votre Réservation', p5Sub: 'Vérifiez les détails avant de confirmer',
      lblName: 'Nom complet', lblPhone: 'Téléphone / WhatsApp', lblEmail: 'Adresse e-mail',
      trust1: 'Données 100% sécurisées', trust2: '7ème rendez-vous GRATUIT 🎁',
      btnConfirm: '🎯 Payer l\'Acompte et Réserver',
      confirmNote: 'En confirmant, vous payez 50% d\'acompte. Votre créneau sera bloqué.',
      successTitle: 'Rendez-vous Confirmé !', successSub: 'Confirmation envoyée par SMS et e-mail.',
      btnNew: '+ Prendre un autre Rendez-vous',
      sl1:'Service', sl2:'Spécialiste', sl3:'Date & Heure', sl4:'Données', sl5:'Confirmer',
      months: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
      days: ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'],
      summaryService:'Service', summaryProvider:'Spécialiste', summaryDate:'Date',
      summaryTime:'Heure', summaryPrice:'Total', summaryName:'Client', summaryDeposit:'Acompte (50%)', summaryLocalPay:'Paiement sur place',
      btnNext1:'Choisir un Spécialiste →',btnNext2:'Voir les Horaires →',btnNext3:'Continuer →',btnNext4:'Vérifier la Réservation →',btnBack:'← Retour',
      toastMsg: 'vient de réserver un créneau', popular: '🔥 Populaire'
    }
  },
  DE: {
    name: 'Deutschland', lang: 'de', currency: 'EUR', symbol: '€', phone: '+49',
    i18n: {
      urgency: '⚡ Hohe Nachfrage — Nur noch {slots} Termine heute',
      heroTitle: 'Termin buchen<br/>in Sekunden',
      heroSub: 'Online buchen 24/7. Keine Wartezeit. Sofortige Bestätigung. Ihre Zeit ist wertvoll.',
      p1Title: 'Welchen Service wünschen Sie?', p1Sub: 'Wählen Sie einen Service, um Verfügbarkeit in Echtzeit zu sehen',
      p2Title: 'Wählen Sie Ihren Spezialisten', p2Sub: 'Alle geprüft und von echten Kunden bewertet',
      p3Title: 'Datum und Uhrzeit wählen', p3Sub: 'Termine werden in Echtzeit gesperrt',
      p3bSub: 'Verfügbare Zeiten',
      p4Title: 'Ihre Daten', p4Sub: 'Sie erhalten sofort eine Bestätigung per SMS',
      p5Title: 'Buchung bestätigen', p5Sub: 'Überprüfen Sie die Details vor der Bestätigung',
      lblName: 'Vollständiger Name', lblPhone: 'Telefon / WhatsApp', lblEmail: 'E-Mail-Adresse',
      trust1: '100% sichere Daten', trust2: '7. Termin GRATIS 🎁',
      btnConfirm: '🎯 Anzahlung zahlen & Buchen',
      confirmNote: 'Mit der Bestätigung zahlen Sie 50% an. Ihr Termin wird sofort gesperrt.',
      successTitle: 'Termin Bestätigt!', successSub: 'Bestätigung per SMS und E-Mail gesendet.',
      btnNew: '+ Weiteren Termin buchen',
      sl1:'Service', sl2:'Spezialist', sl3:'Datum & Zeit', sl4:'Daten', sl5:'Bestätigen',
      months: ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'],
      days: ['So','Mo','Di','Mi','Do','Fr','Sa'],
      summaryService:'Service', summaryProvider:'Spezialist', summaryDate:'Datum',
      summaryTime:'Uhrzeit', summaryPrice:'Gesamt', summaryName:'Kunde', summaryDeposit:'Anzahlung (50%)', summaryLocalPay:'Zahlung vor Ort',
      btnNext1:'Spezialisten wählen →',btnNext2:'Termine sehen →',btnNext3:'Weiter →',btnNext4:'Buchung prüfen →',btnBack:'← Zurück',
      toastMsg: 'hat gerade einen Termin gebucht', popular: '🔥 Beliebt'
    }
  },
  JP: {
    name: '日本', lang: 'ja', currency: 'JPY', symbol: '¥', phone: '+81',
    i18n: {
      urgency: '⚡ 高需要 — 本日残り {slots} 枠のみ',
      heroTitle: '数秒で予約完了<br/>今すぐ予約する',
      heroSub: '24時間365日オンライン予約。待ち時間ゼロ。即時確認。あなたの時間を大切に。',
      p1Title: 'ご希望のサービスは？', p1Sub: 'サービスを選択してリアルタイムの空き状況をご確認ください',
      p2Title: '担当者を選んでください', p2Sub: '実際のお客様による評価で選ばれたプロフェッショナル',
      p3Title: '日時を選択してください', p3Sub: '予約枠はリアルタイムでブロックされます',
      p3bSub: '空き時間',
      p4Title: 'お客様情報', p4Sub: 'SMSにて即時確認メッセージをお送りします',
      p5Title: '予約内容の確認', p5Sub: '確認前に詳細をご確認ください',
      lblName: 'お名前', lblPhone: '電話番号 / WhatsApp', lblEmail: 'メールアドレス',
      trust1: '個人情報は100%安全', trust2: '7回目の来店で無料 🎁',
      btnConfirm: '🎯 デポジットを支払って予約',
      confirmNote: '確定すると50%のデポジットが決済されます。予約枠はすぐにブロックされます。',
      successTitle: '予約が確定しました！', successSub: 'SMSとメールに確認書をお送りしました。',
      btnNew: '+ 別の予約をする',
      sl1:'サービス', sl2:'担当者', sl3:'日時', sl4:'情報', sl5:'確認',
      months: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
      days: ['日','月','火','水','木','金','土'],
      summaryService:'サービス', summaryProvider:'担当者', summaryDate:'日付',
      summaryTime:'時間', summaryPrice:'合計', summaryName:'お客様', summaryDeposit:'デポジット (50%)', summaryLocalPay:'現地支払い',
      btnNext1:'担当者を選ぶ →',btnNext2:'時間を見る →',btnNext3:'次へ →',btnNext4:'予約を確認する →',btnBack:'← 戻る',
      toastMsg: 'が予約しました', popular: '🔥 人気'
    }
  },
  US: {
    name: 'USA', lang: 'en', currency: 'USD', symbol: '$', phone: '+1',
    i18n: {
      urgency: '⚡ High Demand — Only {slots} slots left today',
      heroTitle: 'Book Your Appointment<br/>in Seconds',
      heroSub: 'Book online 24/7. No waiting. Instant confirmation. Because your time matters.',
      p1Title: 'What service do you need?', p1Sub: 'Select a service to see real-time availability',
      p2Title: 'Choose your Specialist', p2Sub: 'All verified and rated by real customers',
      p3Title: 'Select Date & Time', p3Sub: 'Slots are blocked in real time',
      p3bSub: 'Available times',
      p4Title: 'Your Information', p4Sub: 'You\'ll receive an instant confirmation via SMS',
      p5Title: 'Confirm your Booking', p5Sub: 'Review the details before confirming',
      lblName: 'Full Name', lblPhone: 'Phone / WhatsApp', lblEmail: 'Email Address',
      trust1: '100% Secure Data', trust2: '7th Appointment FREE 🎁',
      btnConfirm: '🎯 Pay Deposit & Book',
      confirmNote: 'By confirming you pay a 50% deposit. Your slot will be locked immediately.',
      successTitle: 'Appointment Confirmed!', successSub: 'We\'ve sent a confirmation via SMS and email.',
      btnNew: '+ Book Another Appointment',
      sl1:'Service', sl2:'Specialist', sl3:'Date & Time', sl4:'Details', sl5:'Confirm',
      months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      days: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
      summaryService:'Service', summaryProvider:'Specialist', summaryDate:'Date',
      summaryTime:'Time', summaryPrice:'Total', summaryName:'Customer', summaryDeposit:'Deposit (50%)', summaryLocalPay:'Pay at Location',
      btnNext1:'Choose Specialist →',btnNext2:'See Availability →',btnNext3:'Continue →',btnNext4:'Review Booking →',btnBack:'← Back',
      toastMsg: 'just booked an appointment', popular: '🔥 Popular'
    }
  }
};

const toastMessages = {
  CO: [
    { name:'Alejandra M.', city:'Bogotá' },
    { name:'Carlos R.', city:'Medellín' },
    { name:'Diana P.', city:'Cali' },
  ],
  FR: [
    { name:'Sophie L.', city:'Paris' },
    { name:'Julien M.', city:'Lyon' },
    { name:'Camille B.', city:'Marseille' },
  ],
  DE: [
    { name:'Anna K.', city:'Berlin' },
    { name:'Lukas S.', city:'München' },
    { name:'Emma W.', city:'Hamburg' },
  ],
  JP: [
    { name:'佐藤 花子', city:'東京' },
    { name:'田中 太郎', city:'大阪' },
    { name:'山田 美咲', city:'福岡' },
  ],
  US: [
    { name:'Emily R.', city:'New York' },
    { name:'Jake T.', city:'Los Angeles' },
    { name:'Sarah M.', city:'Chicago' },
  ]
};

export default function Home() {
  const [country, setCountry] = useState('CO');
  const [step, setStep] = useState(1);
  const [services, setServices] = useState([]);
  const [providers, setProviders] = useState([]);
  
  // Estado del Wizard
  const [selectedService, setSelectedService] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [availableTimes, setAvailableTimes] = useState([]);
  const [clientData, setClientData] = useState({ name: '', phone: '', email: '' });
  const [customerId, setCustomerId] = useState(null);
  const [hasLoyaltyReward, setHasLoyaltyReward] = useState(false);
  const [formErrors, setFormErrors] = useState({ name: false, phone: false, email: false });
  
  // Estado UI extra
  const [isLoading, setIsLoading] = useState(false);
  const [slotsLeft, setSlotsLeft] = useState(3);
  const [toast, setToast] = useState(null);
  const [uiError, setUiError] = useState(null); // Nuevo estado para errores elegantes
  const [bookingId, setBookingId] = useState(null);

  // Calendario
  const [calDate, setCalDate] = useState(new Date());

  const t = COUNTRIES[country].i18n;

  const formatPrice = (p) => {
    const c = COUNTRIES[country];
    if (c.currency === 'COP') return `${c.symbol} ${p.toLocaleString('es-CO')}`;
    if (c.currency === 'EUR' || c.currency === 'USD') return `${c.symbol}${Number(p).toFixed(2)}`;
    if (c.currency === 'JPY') return `${c.symbol}${p.toLocaleString('ja-JP')}`;
    return `${c.symbol}${p}`;
  };

  // Cargar servicios cuando cambia el país
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await fetch(`http://localhost:8080/api/services/${country}`);
        if (res.ok) {
          const data = await res.json();
          setServices(data);
          if (data.length > 0) {
            fetchProviders(data[0].business_id);
          }
        }
      } catch (error) {
        console.error("Error cargando servicios:", error);
      }
    };
    
    // Resetear estado al cambiar de país
    setStep(1);
    setSelectedService(null);
    setSelectedProvider(null);
    setSelectedDate(null);
    setSelectedTime(null);
    
    fetchServices();
  }, [country]);

  const fetchProviders = async (businessId) => {
    try {
      const res = await fetch(`http://localhost:8080/api/providers/${businessId}`);
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
      }
    } catch (error) {
      console.error("Error cargando proveedores:", error);
    }
  };

  // Simulación de Toasts (Neuromarketing) dinámicos por país
  useEffect(() => {
    const msgs = toastMessages[country] || toastMessages['CO'];
    const interval = setInterval(() => {
      const randomData = msgs[Math.floor(Math.random() * msgs.length)];
      setToast(`${randomData.name} ${COUNTRIES[country].i18n.toastMsg} ${randomData.city}`);
      setTimeout(() => setToast(null), 4000);
    }, 12000);
    return () => clearInterval(interval);
  }, [country]);

  // Obtener disponibilidad real
  useEffect(() => {
    if (selectedDate && selectedProvider) {
      const fetchAvailability = async () => {
        try {
          const res = await fetch(`http://localhost:8080/api/availability?providerId=${selectedProvider.id}&date=${selectedDate}`);
          if (res.ok) {
            const data = await res.json();
            setAvailableTimes(data.availableSlots);
          }
        } catch (error) {
          console.error("Error al obtener disponibilidad:", error);
        }
      };
      fetchAvailability();
    }
  }, [selectedDate, selectedProvider]);

  const handleNextStep = async () => {
    if (step === 1 && !selectedService) return;
    if (step === 2 && !selectedProvider) return;
    if (step === 3 && (!selectedDate || !selectedTime)) return;
    if (step === 4 && (!clientData.name || !clientData.phone || !clientData.email)) return;
    
    // Si estamos en el paso de elegir fecha y hora, bloqueamos en Redis
    if (step === 3) {
      setIsLoading(true);
      try {
        const res = await fetch('http://localhost:8080/api/lock-slot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId: selectedProvider.id, date: selectedDate, time: selectedTime })
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          setUiError(errorData.error);
          setSelectedTime(null);
          setIsLoading(false);
          // Refrescar disponibilidad
          setAvailableTimes(prev => prev.filter(t => t !== selectedTime));
          return; // No avanzar de paso
        }
      } catch (error) {
        console.error("Error al bloquear el slot:", error);
        setUiError("Error de conexión al intentar reservar el turno.");
        setIsLoading(false);
        return; // IMPORTANTE: No avanzar si hubo un error de red
      }
      setIsLoading(false);
    }

    // Paso 4: Buscar o crear cliente y revisar fidelización
    if (step === 4) {
      let hasError = false;
      const errors = { name: false, phone: false, email: false };
      let errorMsg = "Faltan campos obligatorios o tienen errores:\n";

      if (clientData.name.trim().length < 3) {
        errors.name = true;
        hasError = true;
        errorMsg += "\n• Nombre: Ingresa mínimo 3 letras.";
      }
      if (clientData.phone.length < 8) {
        errors.phone = true;
        hasError = true;
        errorMsg += "\n• Teléfono: Número demasiado corto.";
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(clientData.email)) {
        errors.email = true;
        hasError = true;
        errorMsg += "\n• Correo: Ingresa un email válido (ej: ana@gmail.com).";
      }

      setFormErrors(errors);

      if (hasError) {
        setUiError(errorMsg);
        return;
      }
      
      const fullPhone = COUNTRIES[country].phone + clientData.phone;

      setIsLoading(true);
      try {
        const res = await fetch('http://localhost:8080/api/customers/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: clientData.name.trim(),
            phone_number: fullPhone,
            email: clientData.email.toLowerCase().trim(),
            preferred_locale: country.toLowerCase()
          })
        });
        if (res.ok) {
          const cData = await res.json();
          setCustomerId(cData.id);
          setHasLoyaltyReward(cData.has_free_appointment);
        }
      } catch (error) {
        console.error("Error al buscar cliente:", error);
      }
      setIsLoading(false);
    }

    setStep(step + 1);
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    
    const [year, month, day] = selectedDate.split('-');
    const [hourStr, minStr] = selectedTime.split(':');
    const start = new Date(year, month - 1, day, parseInt(hourStr), parseInt(minStr));
    const end = new Date(start.getTime() + selectedService.duration_minutes * 60000);
    
    const payload = {
      business_id: selectedService.business_id,
      service_id: selectedService.id,
      provider_id: selectedProvider.id,
      customer_id: customerId || 1,
      startTime: start.toISOString(),
      endTime: end.toISOString()
    };

    try {
      const res = await fetch('http://localhost:8080/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const data = await res.json();
        setBookingId(data.appointment.id);
        setSlotsLeft(prev => Math.max(0, prev - 1));
        setStep(6);
      } else {
        const errorData = await res.json();
        setUiError(`Error al confirmar: ${errorData.error || 'Intenta de nuevo'}`);
      }
    } catch (error) {
      console.error(error);
      setUiError("Error de conexión con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex gap-0 mb-9 relative">
      {[t.sl1, t.sl2, t.sl3, t.sl4, t.sl5].map((label, idx) => {
        const num = idx + 1;
        const isActive = step === num;
        const isDone = step > num;
        return (
          <div key={num} className="flex-1 text-center relative px-1 z-10">
            {idx < 4 && (
              <div className="absolute top-4 left-1/2 w-full h-[2px] bg-white/10 -z-10" />
            )}
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mx-auto mb-2 text-xs font-bold transition-all duration-300
              ${isActive ? 'bg-brand-gold border-brand-gold text-brand-dark' : 
                isDone ? 'bg-brand-green border-brand-green text-white' : 
                'bg-brand-dark4 border-white/10 text-white/30'}`}>
              {isDone ? '✓' : num}
            </div>
            <div className={`text-[11px] ${isActive ? 'text-brand-gold' : isDone ? 'text-brand-green' : 'text-white/30'}`}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderCalendar = () => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`e-${i}`} className="p-2" />);
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    for (let d = 1; d <= daysInMonth; d++) {
      const current = new Date(year, month, d);
      const isPast = current < today;
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isSelected = selectedDate === dateStr;
      
      days.push(
        <div key={d} 
          onClick={() => !isPast && setSelectedDate(dateStr)}
          className={`aspect-square flex items-center justify-center rounded-lg text-sm transition-all border-[1.5px] border-transparent
            ${isPast ? 'text-white/20 cursor-not-allowed' : 'cursor-pointer hover:bg-brand-gold/15 hover:border-brand-gold'}
            ${isSelected ? 'bg-brand-gold !text-brand-dark font-bold !border-brand-gold' : ''}
          `}>
          {d}
        </div>
      );
    }
    
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => setCalDate(new Date(year, month - 1, 1))} className="w-8 h-8 rounded-lg bg-brand-dark4 hover:bg-brand-gold hover:text-brand-dark transition-colors">‹</button>
          <div className="font-serif font-bold text-lg">{t.months[month]} {year}</div>
          <button onClick={() => setCalDate(new Date(year, month + 1, 1))} className="w-8 h-8 rounded-lg bg-brand-dark4 hover:bg-brand-gold hover:text-brand-dark transition-colors">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-white/30 mb-2">
          {t.days.map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 mb-6">
          {days}
        </div>
      </div>
    );
  };

  const renderTimeSlots = () => {
    if (!selectedDate) return <div className="text-white/30 text-sm">Selecciona una fecha primero</div>;
    
    if (availableTimes.length === 0) {
      return <div className="text-brand-red text-sm mt-4 font-bold">Sin horarios disponibles para este día.</div>;
    }

    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
        {availableTimes.map(time => (
          <div key={time} onClick={() => setSelectedTime(time)}
            className={`py-2 px-1 text-center rounded-lg border-[1.5px] text-sm cursor-pointer transition-colors
              ${selectedTime === time ? 'bg-brand-gold border-brand-gold text-brand-dark font-bold' : 'bg-brand-dark3 border-white/10 hover:border-brand-gold hover:text-brand-gold'}`}>
            {time}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Barra de Países */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0D0D0D]/95 backdrop-blur-md border-b border-brand-gold/20 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="font-serif text-xl font-black text-gradient tracking-wide">QuickFade</div>
        <div className="flex gap-2">
          {Object.entries(COUNTRIES).map(([code, c]) => (
            <button key={code} onClick={() => setCountry(code)}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border text-xs sm:text-sm flex items-center gap-1.5 transition-colors
                ${country === code ? 'border-brand-gold text-brand-gold bg-brand-gold/10' : 'border-white/10 text-white/60 hover:border-brand-gold hover:text-brand-gold'}`}>
              <span className="hidden sm:inline">{c.name}</span>
              <span className="sm:hidden">{code}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className="min-h-screen flex flex-col items-center pt-28 pb-16 px-4 relative z-10">
        
        {/* Urgency Badge */}
        <div className="bg-gradient-to-br from-[#b22222] to-brand-red text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wider mb-6 flex items-center gap-2 animate-pulse-badge">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-blink" />
          {t.urgency.replace('{slots}', slotsLeft)}
        </div>

        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-black text-center leading-tight mb-4 text-gradient-white" dangerouslySetInnerHTML={{__html: t.heroTitle}}></h1>
        <p className="text-white/50 text-center max-w-lg mb-10">{t.heroSub}</p>

        {/* Wizard Card */}
        <div className="w-full max-w-2xl bg-brand-dark2 border border-brand-gold/20 rounded-3xl p-6 sm:p-10 shadow-[0_8px_40px_rgba(0,0,0,0.45),0_0_80px_rgba(201,168,76,0.05)]">
          {step < 6 && renderStepIndicator()}

          {/* PASO 1 */}
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="font-serif text-2xl font-bold mb-1">{t.p1Title}</h2>
              <p className="text-white/40 text-sm mb-6">{t.p1Sub}</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {services.map(s => (
                  <div key={s.id} onClick={() => setSelectedService(s)}
                    className={`bg-brand-dark3 border-[1.5px] rounded-xl p-4 cursor-pointer transition-all relative overflow-hidden
                      ${selectedService?.id === s.id ? 'border-brand-gold bg-brand-gold/10 ring-2 ring-brand-gold/20' : 'border-white/5 hover:border-brand-gold/40 hover:-translate-y-0.5'}`}>
                    {s.is_popular && <span className="absolute top-2 right-2 text-[10px] bg-brand-gold/20 text-brand-gold px-2 py-0.5 rounded-full">{t.popular}</span>}
                    <div className="text-2xl mb-2">{s.icon || '✨'}</div>
                    <div className="font-semibold text-sm mb-1">{s.name}</div>
                    <div className="text-white/40 text-xs">{s.duration_minutes} min</div>
                    <div className="text-brand-gold font-bold mt-2">{formatPrice(s.price)}</div>
                  </div>
                ))}
              </div>
              <button onClick={handleNextStep} className="w-full py-4 bg-gradient-to-br from-brand-gold to-[#A87A20] text-brand-dark font-bold rounded-xl hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(201,168,76,0.4)] transition-all">
                {t.btnNext1}
              </button>
            </div>
          )}

          {/* PASO 2 */}
          {step === 2 && (
            <div className="animate-fade-in">
              <h2 className="font-serif text-2xl font-bold mb-1">{t.p2Title}</h2>
              <p className="text-white/40 text-sm mb-6">{t.p2Sub}</p>
              
              <div className="flex flex-col gap-3 mb-6">
                {providers.map(p => (
                  <div key={p.id} onClick={() => setSelectedProvider(p)}
                    className={`bg-brand-dark3 border-[1.5px] rounded-xl p-4 cursor-pointer transition-all flex items-center gap-4
                      ${selectedProvider?.id === p.id ? 'border-brand-gold bg-brand-gold/10' : 'border-white/5 hover:border-brand-gold/40'}`}>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-gold to-[#8B6914] flex items-center justify-center font-bold text-brand-dark shrink-0">
                      {p.initials}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-0.5">{p.name}</div>
                      <div className="text-xs flex items-center gap-1.5"><span className="text-brand-gold tracking-widest">★★★★★</span> {p.rating} ({p.review_count})</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-4 bg-brand-dark3 border-[1.5px] border-white/10 text-white/50 rounded-xl hover:border-white/20 hover:text-white transition-all">{t.btnBack}</button>
                <button onClick={handleNextStep} className="flex-[2] py-4 bg-gradient-to-br from-brand-gold to-[#A87A20] text-brand-dark font-bold rounded-xl hover:-translate-y-0.5 transition-all">{t.btnNext2}</button>
              </div>
            </div>
          )}

          {/* PASO 3 */}
          {step === 3 && (
            <div className="animate-fade-in">
              <h2 className="font-serif text-2xl font-bold mb-1">{t.p3Title}</h2>
              <p className="text-white/40 text-sm mb-6">{t.p3Sub}</p>
              
              <div className="mb-6">
                {renderCalendar()}
                <div className="mt-6">
                  <div className="text-white/40 text-sm mb-2">{t.p3bSub}</div>
                  {renderTimeSlots()}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-4 bg-brand-dark3 border-[1.5px] border-white/10 text-white/50 rounded-xl hover:border-white/20 hover:text-white transition-all">{t.btnBack}</button>
                <button onClick={handleNextStep} className="flex-[2] py-4 bg-gradient-to-br from-brand-gold to-[#A87A20] text-brand-dark font-bold rounded-xl hover:-translate-y-0.5 transition-all">{t.btnNext3}</button>
              </div>
            </div>
          )}

          {/* PASO 4 */}
          {step === 4 && (
            <div className="animate-fade-in">
              <h2 className="font-serif text-2xl font-bold mb-1">{t.p4Title}</h2>
              <p className="text-white/40 text-sm mb-6">{t.p4Sub}</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="flex flex-col gap-1.5">
                  <label className={`text-xs font-medium ${formErrors.name ? 'text-brand-red' : 'text-white/50'}`}>{t.lblName} *</label>
                  <input type="text" 
                    value={clientData.name} 
                    onChange={e => {
                      setClientData({...clientData, name: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '')});
                      if (formErrors.name) setFormErrors({...formErrors, name: false});
                    }} 
                    className={`bg-brand-dark3 border-[1.5px] ${formErrors.name ? 'border-brand-red' : 'border-white/10'} rounded-xl p-3 outline-none focus:border-brand-gold text-sm transition-colors`} 
                    placeholder="..." />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={`text-xs font-medium ${formErrors.phone ? 'text-brand-red' : 'text-white/50'}`}>{t.lblPhone} *</label>
                  <div className={`flex bg-brand-dark3 border-[1.5px] ${formErrors.phone ? 'border-brand-red' : 'border-white/10'} rounded-xl focus-within:border-brand-gold overflow-hidden transition-colors`}>
                    <div className="bg-brand-dark4 px-3 flex items-center justify-center text-brand-gold text-sm border-r border-white/10 font-bold font-mono">
                      {COUNTRIES[country].phone}
                    </div>
                    <input type="tel" 
                      value={clientData.phone} 
                      onChange={e => {
                        setClientData({...clientData, phone: e.target.value.replace(/\D/g, '').substring(0, 15)});
                        if (formErrors.phone) setFormErrors({...formErrors, phone: false});
                      }} 
                      className="flex-1 bg-transparent p-3 outline-none text-sm font-mono tracking-wider" 
                      placeholder="3000000000" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className={`text-xs font-medium ${formErrors.email ? 'text-brand-red' : 'text-white/50'}`}>{t.lblEmail} *</label>
                  <input type="email" 
                    value={clientData.email} 
                    onChange={e => {
                      setClientData({...clientData, email: e.target.value});
                      if (formErrors.email) setFormErrors({...formErrors, email: false});
                    }} 
                    className={`bg-brand-dark3 border-[1.5px] ${formErrors.email ? 'border-brand-red' : 'border-white/10'} rounded-xl p-3 outline-none focus:border-brand-gold text-sm`} 
                    placeholder="..." />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mb-6 text-xs text-white/40">
                <div className="flex items-center gap-1.5"><span className="text-brand-gold">🔒</span> {t.trust1}</div>
                <div className="flex items-center gap-1.5"><span className="text-brand-gold">✅</span> {t.trust2}</div>
              </div>
              
              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="flex-1 py-4 bg-brand-dark3 border-[1.5px] border-white/10 text-white/50 rounded-xl hover:border-white/20 hover:text-white transition-all">{t.btnBack}</button>
                <button onClick={handleNextStep} className="flex-[2] py-4 bg-gradient-to-br from-brand-gold to-[#A87A20] text-brand-dark font-bold rounded-xl hover:-translate-y-0.5 transition-all">{t.btnNext4}</button>
              </div>
            </div>
          )}

          {/* PASO 5 */}
          {step === 5 && (
            <div className="animate-fade-in">
              <h2 className="font-serif text-2xl font-bold mb-1">{t.p5Title}</h2>
              <p className="text-white/40 text-sm mb-6">{t.p5Sub}</p>
              
              {hasLoyaltyReward && (
                <div className="bg-gradient-to-r from-brand-gold/20 to-[#D4AF37]/10 border border-brand-gold rounded-xl p-4 mb-6 text-center animate-pulse-badge">
                  <div className="text-3xl mb-2 animate-bounce">🎁</div>
                  <h3 className="text-brand-gold font-bold text-lg">¡Felicidades {clientData.name.split(' ')[0]}!</h3>
                  <p className="text-white/80 text-sm">Esta es tu 7ma visita. ¡Tu cita de hoy es totalmente GRATIS!</p>
                </div>
              )}
              
              <div className="bg-brand-dark3 border border-brand-gold/20 rounded-xl p-5 mb-6">
                <div className="flex justify-between py-2 border-b border-white/5 text-sm"><span className="text-white/50">{t.summaryService}</span><span>{selectedService.name}</span></div>
                <div className="flex justify-between py-2 border-b border-white/5 text-sm"><span className="text-white/50">{t.summaryProvider}</span><span>{selectedProvider.name}</span></div>
                <div className="flex justify-between py-2 border-b border-white/5 text-sm"><span className="text-white/50">{t.summaryDate}</span><span>{selectedDate} - {selectedTime}</span></div>
                <div className="flex justify-between py-2 border-b border-white/5 text-sm"><span className="text-white/50">{t.summaryName}</span><span>{clientData.name}</span></div>
                
                <div className="flex justify-between py-2 border-b border-white/5 text-sm font-semibold text-brand-gold">
                  <span className="text-brand-gold/80">{t.summaryDeposit}</span>
                  <span>{hasLoyaltyReward ? <span className="text-brand-green font-bold">¡GRATIS!</span> : formatPrice(selectedService.price * 0.5)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/5 text-sm">
                  <span className="text-white/50">{t.summaryLocalPay}</span>
                  <span>{hasLoyaltyReward ? <span className="line-through text-white/30 mr-2">{formatPrice(selectedService.price * 0.5)}</span> : ''}{hasLoyaltyReward ? <span className="text-brand-green font-bold">$0.00</span> : formatPrice(selectedService.price * 0.5)}</span>
                </div>
                
                <div className="flex justify-between pt-3 font-bold text-white text-base">
                  <span className="text-white/50">{t.summaryPrice}</span>
                  <span>{hasLoyaltyReward ? <span className="text-brand-green font-bold">GRATIS</span> : formatPrice(selectedService.price)}</span>
                </div>
              </div>
              
              <div className="flex gap-3 mb-4">
                <button onClick={() => setStep(4)} disabled={isLoading} className="flex-1 py-4 bg-brand-dark3 border-[1.5px] border-white/10 text-white/50 rounded-xl hover:border-white/20 hover:text-white transition-all disabled:opacity-50">{t.btnBack}</button>
                <button onClick={handleConfirm} disabled={isLoading} className="flex-[2] flex items-center justify-center gap-2 py-4 bg-gradient-to-br from-brand-gold to-[#A87A20] text-brand-dark font-bold rounded-xl hover:-translate-y-0.5 transition-all disabled:opacity-50">
                  {isLoading ? <div className="w-5 h-5 border-2 border-brand-dark border-t-transparent rounded-full animate-spin" /> : t.btnConfirm}
                </button>
              </div>
              <div className="text-center text-[10px] text-white/30">{t.confirmNote}</div>
            </div>
          )}

          {/* PASO 6 */}
          {step === 6 && (
            <div className="animate-fade-in text-center py-6">
              <div className="text-6xl mb-4 animate-[bounce_1s_infinite]">🎉</div>
              <h2 className="font-serif text-3xl font-bold text-brand-gold mb-2">{t.successTitle}</h2>
              <p className="text-white/50 text-sm mb-6">{t.successSub}</p>
              
              <div className="bg-brand-dark3 border border-brand-gold/30 font-mono text-brand-gold text-lg tracking-widest rounded-xl py-3 px-6 mb-8 inline-block">
                ID: #BK-{bookingId}
              </div>
              
              <button onClick={() => setStep(1)} className="w-full py-4 bg-brand-dark3 border-[1.5px] border-white/10 text-white rounded-xl hover:border-white/30 transition-all">
                {t.btnNew}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Modal Elegante de Error (Reemplazo del alert nativo) */}
      {uiError && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0D0D0D]/80 backdrop-blur-sm p-4">
          <div className="bg-[#1A1A1A] border border-brand-red/50 rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-[0_0_40px_rgba(178,34,34,0.3)] text-center transform animate-fade-in-up">
            <div className="w-16 h-16 bg-brand-red/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-brand-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 font-serif">¡Atención!</h3>
            <p className="text-white/70 text-sm mb-6 whitespace-pre-line text-left leading-relaxed">{uiError}</p>
            <button 
              onClick={() => setUiError(null)}
              className="w-full bg-brand-red hover:bg-[#8B0000] text-white font-bold py-3 rounded-xl transition-colors">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* TOAST NEUROMARKETING */}
      <div className={`fixed bottom-8 right-8 z-50 bg-brand-dark2 border border-brand-gold rounded-xl p-4 flex items-center gap-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-500 max-w-sm
        ${toast ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'}`}>
        <div className="text-2xl">🔔</div>
        <div className="text-sm leading-snug">
          <strong className="block text-brand-gold mb-0.5">
            {{CO:'Actividad reciente', FR:'Activité récente', DE:'Letzte Aktivität', JP:'最近のアクティビティ', US:'Recent activity'}[country]}
          </strong>
          {toast}
        </div>
      </div>
    </>
  );
}
