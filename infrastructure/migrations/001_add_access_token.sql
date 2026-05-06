-- Migración para bases de datos existentes: añade la columna access_token a appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS access_token VARCHAR(40);
CREATE INDEX IF NOT EXISTS idx_appointments_token ON appointments(access_token);
