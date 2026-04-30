import './globals.css';

export const metadata = {
  title: 'Reserva Rápida | Sistema de Turnos',
  description: 'Agiliza tus citas. Rápido, seguro y sin complicaciones.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
