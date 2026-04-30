"use client";

import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch('http://localhost:8080/api/analytics');
        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch (error) {
        console.error("Error al cargar analíticas", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAnalytics();
    // Refrescar cada 10 segundos para ver cambios en vivo
    const interval = setInterval(fetchAnalytics, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-6 sm:p-12 font-sans text-white">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gradient mb-1">Panel de Control</h1>
          <p className="text-white/50 text-sm">Monitoreo en tiempo real de QuickFade</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-brand-green animate-pulse"></div>
          <span className="text-sm font-mono text-brand-green tracking-widest uppercase">En vivo</span>
        </div>
      </header>

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-brand-dark2 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-brand-gold/50 transition-colors">
          <div className="absolute -right-6 -top-6 text-7xl opacity-5 group-hover:opacity-10 transition-opacity">💰</div>
          <p className="text-white/50 text-sm font-medium mb-1">Ingresos Totales (Proyectados)</p>
          <h3 className="text-3xl font-bold text-white">{formatMoney(data?.metrics.totalRevenue || 0)}</h3>
        </div>

        <div className="bg-brand-dark2 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-brand-gold/50 transition-colors">
          <div className="absolute -right-6 -top-6 text-7xl opacity-5 group-hover:opacity-10 transition-opacity">📅</div>
          <p className="text-white/50 text-sm font-medium mb-1">Citas Agendadas</p>
          <h3 className="text-3xl font-bold text-white">{data?.metrics.totalAppointments || 0}</h3>
        </div>

        <div className="bg-brand-dark2 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-brand-gold/50 transition-colors">
          <div className="absolute -right-6 -top-6 text-7xl opacity-5 group-hover:opacity-10 transition-opacity">👥</div>
          <p className="text-white/50 text-sm font-medium mb-1">Total de Clientes</p>
          <h3 className="text-3xl font-bold text-white">{data?.metrics.totalCustomers || 0}</h3>
        </div>

        <div className="bg-gradient-to-br from-brand-dark2 to-[#2A2000] border border-brand-gold/30 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 text-7xl opacity-10 group-hover:opacity-20 transition-opacity">👑</div>
          <p className="text-brand-gold/80 text-sm font-medium mb-1">Clientes Leales (Premio)</p>
          <h3 className="text-3xl font-bold text-brand-gold">{data?.metrics.loyalCustomers || 0}</h3>
        </div>
      </div>

      {/* Tabla de Citas Recientes */}
      <div className="bg-brand-dark2 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-xl font-bold font-serif">Citas Recientes</h2>
          <button onClick={() => window.location.reload()} className="text-xs border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">Refrescar</button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1A1A1A] text-white/40 text-xs uppercase tracking-wider">
                <th className="p-4 font-medium">ID</th>
                <th className="p-4 font-medium">Cliente</th>
                <th className="p-4 font-medium">Servicio</th>
                <th className="p-4 font-medium">Especialista</th>
                <th className="p-4 font-medium">Fecha y Hora</th>
                <th className="p-4 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {data?.recentAppointments?.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-white/30">No hay citas registradas aún.</td>
                </tr>
              ) : (
                data?.recentAppointments?.map(app => (
                  <tr key={app.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 font-mono text-white/50 text-xs">#{app.id}</td>
                    <td className="p-4 font-bold">{app.customer_name}</td>
                    <td className="p-4 text-white/80">{app.service_name}</td>
                    <td className="p-4">
                      <span className="bg-white/5 px-2 py-1 rounded-md text-xs">{app.provider_name}</span>
                    </td>
                    <td className="p-4 text-brand-gold">{formatDate(app.start_time)}</td>
                    <td className="p-4 text-right font-medium">{formatMoney(app.price)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
