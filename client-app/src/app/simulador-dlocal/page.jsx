"use client";

import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

function SimuladorContenido() {
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get('id');
  const amount = searchParams.get('amount');
  const currency = searchParams.get('currency');
  const [isPaying, setIsPaying] = useState(false);

  const handlePagar = async () => {
    setIsPaying(true);
    try {
      await fetch(`${API_URL}/api/webhooks/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PAID',
          appointment_id: appointmentId,
          transaction_id: 'tx_simulada_' + Date.now()
        })
      });

      // Efecto dramático de éxito antes de redirigir
      setTimeout(() => {
        window.location.href = `/gestion?success=true&id=${appointmentId}`;
      }, 1500);
    } catch (err) {
      console.error(err);
      alert('Error simulando el webhook');
      setIsPaying(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-slate-900 overflow-hidden font-sans">
      {/* Fondos dinámicos (Mesh Gradient simulado) */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-50 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] bg-cyan-500 rounded-full mix-blend-multiply filter blur-[128px] opacity-40 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-[600px] h-[600px] bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-30 animate-blob animation-delay-4000"></div>

      {/* Tarjeta Glassmorphism */}
      <div className="relative w-full max-w-md bg-white/10 backdrop-blur-2xl border border-white/20 p-8 rounded-3xl shadow-2xl overflow-hidden z-10">
        
        {/* Cabecera / Logo simulado */}
        <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">dLocal <span className="text-cyan-400">Go</span></h1>
              <p className="text-xs text-indigo-200 uppercase tracking-widest font-semibold">Entorno Sandbox</p>
            </div>
          </div>
          <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide border border-emerald-500/30">
            Prueba
          </span>
        </div>
        
        {/* Resumen de cobro */}
        <div className="bg-slate-800/50 rounded-2xl p-6 mb-8 border border-white/5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <p className="text-sm text-indigo-200 font-medium mb-1">Abono Anticipo (50%)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white tracking-tight">{amount}</span>
            <span className="text-lg font-bold text-cyan-400">{currency}</span>
          </div>
          <div className="mt-3 flex items-start gap-2">
            <svg className="w-4 h-4 text-indigo-300 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-indigo-300 leading-tight">El 50% restante se paga directamente en el establecimiento físico tras finalizar el servicio.</p>
          </div>
        </div>

        {/* Formulario de Tarjeta Simulada */}
        <div className="space-y-5 mb-8">
          <div>
            <label className="block text-xs font-semibold text-indigo-200 mb-2 uppercase tracking-wide">Número de Tarjeta</label>
            <div className="relative">
              <input disabled type="text" value="•••• •••• •••• 4242" 
                className="w-full bg-slate-900/50 border border-white/10 text-white rounded-xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all cursor-not-allowed placeholder-slate-500 font-mono text-lg" 
              />
              <svg className="w-6 h-6 absolute left-4 top-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <div className="absolute right-4 top-3.5 flex gap-1">
                <div className="w-8 h-5 bg-red-500 rounded-sm opacity-80"></div>
                <div className="w-8 h-5 bg-orange-400 rounded-sm opacity-80 -ml-4 mix-blend-multiply"></div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-5">
            <div className="w-1/2">
              <label className="block text-xs font-semibold text-indigo-200 mb-2 uppercase tracking-wide">Vencimiento</label>
              <input disabled type="text" value="12/30" 
                className="w-full bg-slate-900/50 border border-white/10 text-white rounded-xl py-3.5 px-4 cursor-not-allowed font-mono text-lg text-center" 
              />
            </div>
            <div className="w-1/2">
              <label className="block text-xs font-semibold text-indigo-200 mb-2 uppercase tracking-wide">CVC</label>
              <input disabled type="password" value="123" 
                className="w-full bg-slate-900/50 border border-white/10 text-white rounded-xl py-3.5 px-4 cursor-not-allowed font-mono text-lg text-center" 
              />
            </div>
          </div>
        </div>

        {/* Botón Principal */}
        <button 
          onClick={handlePagar}
          disabled={isPaying}
          className={`w-full relative overflow-hidden group py-4 rounded-xl font-bold text-lg text-white shadow-[0_0_40px_-10px_rgba(6,182,212,0.5)] transition-all duration-300 transform ${isPaying ? 'scale-95 cursor-wait' : 'hover:-translate-y-1 hover:shadow-[0_0_60px_-15px_rgba(6,182,212,0.7)] active:scale-95'}`}
        >
          {/* Capas de gradiente para el botón */}
          <div className={`absolute inset-0 transition-opacity duration-300 ${isPaying ? 'bg-slate-700' : 'bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 bg-[length:200%_100%] animate-gradient'}`}></div>
          
          <div className="relative flex items-center justify-center gap-2">
            {isPaying ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Procesando Pago Seguro...</span>
              </>
            ) : (
              <>
                <span>Pagar {amount} {currency}</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </div>
        </button>

        {/* Sellos de confianza */}
        <div className="mt-8 flex items-center justify-center gap-4 text-xs font-medium text-slate-400">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>SSL Encrypted</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-slate-600"></div>
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Powered by dLocal</span>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function SimuladorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-pulse text-cyan-400 font-bold text-xl tracking-widest uppercase">Cargando Pasarela...</div>
      </div>
    }>
      <SimuladorContenido />
    </Suspense>
  );
}
