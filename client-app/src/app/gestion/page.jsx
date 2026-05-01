"use client";

import { useState } from 'react';

export default function GestionCita() {
  const [appointmentId, setAppointmentId] = useState('');
  const [appointment, setAppointment] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados para reprogramación
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  const searchAppointment = async (e) => {
    e?.preventDefault();
    if (!appointmentId) return;
    
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch(`http://localhost:8080/api/appointments/${appointmentId}`);
      if (res.ok) {
        const data = await res.json();
        setAppointment(data);
        setIsRescheduling(false);
      } else {
        const err = await res.json();
        setError(err.error || 'Cita no encontrada');
        setAppointment(null);
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('¿Estás seguro de que deseas cancelar esta cita?')) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:8080/api/appointments/${appointmentId}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelación solicitada por el cliente desde portal de gestión' })
      });
      
      if (res.ok) {
        setSuccess('Cita cancelada exitosamente.');
        await searchAppointment(); // Recargar datos
      } else {
        const err = await res.json();
        setError(err.error || 'Error al cancelar la cita');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!newDate || !newTime) {
      setError('Por favor selecciona una nueva fecha y hora');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      // Combinar fecha y hora local para enviar como ISO
      const [year, month, day] = newDate.split('-');
      const [hourStr, minStr] = newTime.split(':');
      const start = new Date(year, month - 1, day, parseInt(hourStr), parseInt(minStr));
      const end = new Date(start.getTime() + (appointment.duration_minutes * 60000));

      const res = await fetch(`http://localhost:8080/api/appointments/${appointmentId}/reschedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          newStartTime: start.toISOString(), 
          newEndTime: end.toISOString() 
        })
      });
      
      if (res.ok) {
        setSuccess('Cita reprogramada exitosamente.');
        setIsRescheduling(false);
        await searchAppointment(); // Recargar datos
      } else {
        const err = await res.json();
        setError(err.error || 'Error al reprogramar. Es posible que el horario no esté disponible.');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-6 sm:p-12 font-sans text-white flex flex-col items-center">
      <header className="mb-10 text-center w-full max-w-2xl">
        <h1 className="text-4xl font-serif font-bold text-gradient mb-2">Gestionar mi Cita</h1>
        <p className="text-white/50">Consulta, reprograma o cancela tu turno en QuickFade</p>
      </header>

      <div className="w-full max-w-2xl bg-brand-dark2 border border-white/10 rounded-3xl p-8 shadow-2xl relative">
        <form onSubmit={searchAppointment} className="flex gap-4 mb-8">
          <input 
            type="number" 
            placeholder="Ingresa tu ID de Cita (Ej: 12)" 
            value={appointmentId}
            onChange={(e) => setAppointmentId(e.target.value)}
            className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-gold transition-colors"
          />
          <button 
            type="submit" 
            disabled={isLoading || !appointmentId}
            className="bg-brand-gold text-black font-bold px-6 py-3 rounded-xl hover:bg-white transition-colors disabled:opacity-50"
          >
            Buscar
          </button>
        </form>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl text-sm">
            {success}
          </div>
        )}

        {appointment && (
          <div className="animate-fade-in">
            <div className="border border-white/5 rounded-2xl bg-[#131313] p-6 mb-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-brand-gold mb-1">{appointment.service_name}</h2>
                  <p className="text-white/60">con <span className="text-white font-medium">{appointment.provider_name}</span></p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  appointment.status === 'confirmed' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                  appointment.status === 'cancelled' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                  'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                }`}>
                  {appointment.status === 'confirmed' ? 'Confirmada' : appointment.status === 'cancelled' ? 'Cancelada' : appointment.status}
                </div>
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-white/5 pb-3">
                  <span className="text-white/40">Cliente</span>
                  <span className="font-medium">{appointment.customer_name}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-3">
                  <span className="text-white/40">Fecha y Hora</span>
                  <span className="font-medium capitalize">{formatDate(appointment.start_time_utc)}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-white/40">Precio</span>
                  <span className="font-medium">${appointment.price}</span>
                </div>
              </div>
            </div>

            {appointment.status === 'confirmed' && !isRescheduling && (
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsRescheduling(true)}
                  className="flex-1 bg-white/5 border border-white/10 text-white font-medium py-3 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Reprogramar
                </button>
                <button 
                  onClick={handleCancel}
                  className="flex-1 bg-red-500/10 border border-red-500/30 text-red-400 font-medium py-3 rounded-xl hover:bg-red-500/20 transition-colors"
                >
                  Cancelar Cita
                </button>
              </div>
            )}

            {isRescheduling && (
              <div className="border border-brand-gold/30 rounded-2xl bg-brand-gold/5 p-6 animate-fade-in">
                <h3 className="font-serif font-bold text-lg mb-4 text-brand-gold">Selecciona nuevo horario</h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs text-white/50 mb-1 uppercase tracking-wider">Nueva Fecha</label>
                    <input 
                      type="date" 
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 focus:border-brand-gold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1 uppercase tracking-wider">Nueva Hora</label>
                    <input 
                      type="time" 
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 focus:border-brand-gold outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={handleReschedule}
                    disabled={isLoading}
                    className="flex-1 bg-brand-gold text-black font-bold py-2 rounded-lg hover:bg-white transition-colors"
                  >
                    Confirmar Cambio
                  </button>
                  <button 
                    onClick={() => setIsRescheduling(false)}
                    className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
                  >
                    Volver
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="mt-8 text-center">
        <a href="/" className="text-brand-gold text-sm hover:underline font-medium">← Volver a Reservar</a>
      </div>
    </div>
  );
}
