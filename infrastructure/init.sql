-- Script de inicialización de la Base de Datos (PostgreSQL)

CREATE TABLE countries (
    code VARCHAR(2) PRIMARY KEY,  -- CO, FR, DE, JP, US
    name VARCHAR(50) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    currency_symbol VARCHAR(5) NOT NULL,
    phone_prefix VARCHAR(5) NOT NULL,
    default_locale VARCHAR(10) NOT NULL,
    timezone VARCHAR(50) NOT NULL
);

CREATE TABLE businesses (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(2) REFERENCES countries(code),
    name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id),
    name VARCHAR(100) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    requires_deposit BOOLEAN DEFAULT true,
    deposit_percentage INTEGER DEFAULT 50,
    is_popular BOOLEAN DEFAULT false,
    icon VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE providers (
    id SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id),
    name VARCHAR(100) NOT NULL,
    initials VARCHAR(5),
    rating DECIMAL(2,1) DEFAULT 5.0,
    review_count INTEGER DEFAULT 0,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE provider_services (
    provider_id INTEGER REFERENCES providers(id),
    service_id INTEGER REFERENCES services(id),
    PRIMARY KEY (provider_id, service_id)
);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100),
    preferred_locale VARCHAR(10) DEFAULT 'es',
    visit_count INTEGER DEFAULT 0,
    has_free_appointment BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    business_id INTEGER REFERENCES businesses(id),
    service_id INTEGER REFERENCES services(id),
    provider_id INTEGER REFERENCES providers(id),
    customer_id INTEGER REFERENCES customers(id),
    
    -- LA REGLA DE ORO DEL TIEMPO EN SISTEMAS DISTRIBUIDOS:
    -- 'TIMESTAMP WITH TIME ZONE' asegura que PostgreSQL sepa que esto es UTC.
    start_time_utc TIMESTAMP WITH TIME ZONE NOT NULL, 
    end_time_utc TIMESTAMP WITH TIME ZONE NOT NULL,
    
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'confirmed', 'cancelled'
    payment_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'deposit_paid', 'fully_paid', 'free_loyalty'
    deposit_amount DECIMAL(10, 2) DEFAULT 0,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar la velocidad de búsqueda
CREATE INDEX idx_appointments_business_time ON appointments(business_id, start_time_utc);

-- DATOS DE PRUEBA INICIALES (Mapeado al HTML)
INSERT INTO countries (code, name, currency, currency_symbol, phone_prefix, default_locale, timezone) VALUES
('CO', 'Colombia', 'COP', '$', '+57', 'es', 'America/Bogota'),
('FR', 'France', 'EUR', '€', '+33', 'fr', 'Europe/Paris'),
('DE', 'Deutschland', 'EUR', '€', '+49', 'de', 'Europe/Berlin'),
('JP', 'Japan', 'JPY', '¥', '+81', 'ja', 'Asia/Tokyo'),
('US', 'USA', 'USD', '$', '+1', 'en', 'America/New_York');

INSERT INTO businesses (country_code, name, phone_number) VALUES
('CO', 'QuickFade Bogotá', '+573001234567'),
('FR', 'QuickFade Paris', '+33123456789'),
('DE', 'QuickFade Berlin', '+49123456789'),
('JP', 'QuickFade Tokyo', '+81123456789'),
('US', 'QuickFade NY', '+11234567890');

-- Insertar servicios para Colombia (business_id = 1)
INSERT INTO services (business_id, name, icon, duration_minutes, price, is_popular) VALUES
(1, 'Corte de Cabello', '✂️', 30, 35000, true),
(1, 'Corte + Barba', '🪒', 50, 55000, false),
(1, 'Tinte / Color', '🎨', 90, 120000, false),
(1, 'Tratamiento Capilar', '💆', 45, 80000, true);

-- Insertar proveedores para Colombia
INSERT INTO providers (business_id, name, initials, rating, review_count) VALUES
(1, 'Carlos Mendoza', 'CM', 4.9, 342),
(1, 'Andrés Ruiz', 'AR', 4.8, 215),
(1, 'Felipe Torres', 'FT', 4.7, 189);

-- Asociar todos los proveedores con todos los servicios en Colombia
INSERT INTO provider_services (provider_id, service_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4),
(2, 1), (2, 2), (2, 3), (2, 4),
(3, 1), (3, 2), (3, 3), (3, 4);

-- Crear un cliente de prueba
INSERT INTO customers (name, phone_number, email, preferred_locale, visit_count) VALUES
('Juan Cliente', '+573009998877', 'juan@example.com', 'es', 6);

-- =========================================================
-- DATOS PARA FRANCIA (business_id = 2)
-- =========================================================
INSERT INTO services (business_id, name, icon, duration_minutes, price, is_popular) VALUES
(2, 'Coupe de Cheveux', '✂️', 30, 35, true),
(2, 'Coupe + Barbe', '🪒', 50, 55, false),
(2, 'Coloration', '🎨', 90, 95, false),
(2, 'Soin Capillaire', '💆', 45, 65, true);

INSERT INTO providers (business_id, name, initials, rating, review_count) VALUES
(2, 'Jean-Pierre Moreau', 'JP', 4.9, 521),
(2, 'Marc Dubois', 'MD', 4.8, 388),
(2, 'Antoine Lefèvre', 'AL', 4.7, 274);

INSERT INTO provider_services (provider_id, service_id) VALUES
(4, 5), (4, 6), (4, 7), (4, 8),
(5, 5), (5, 6), (5, 7), (5, 8),
(6, 5), (6, 6), (6, 7), (6, 8);

-- =========================================================
-- DATOS PARA ALEMANIA (business_id = 3)
-- =========================================================
INSERT INTO services (business_id, name, icon, duration_minutes, price, is_popular) VALUES
(3, 'Haarschnitt', '✂️', 30, 38, true),
(3, 'Haarschnitt + Bart', '🪒', 50, 58, false),
(3, 'Haarfärbung', '🎨', 90, 98, false),
(3, 'Haarpflege-Behandlung', '💆', 45, 68, true);

INSERT INTO providers (business_id, name, initials, rating, review_count) VALUES
(3, 'Klaus Müller', 'KM', 4.9, 634),
(3, 'Hans Schneider', 'HS', 4.8, 445),
(3, 'Stefan Weber', 'SW', 4.7, 312);

INSERT INTO provider_services (provider_id, service_id) VALUES
(7, 9), (7, 10), (7, 11), (7, 12),
(8, 9), (8, 10), (8, 11), (8, 12),
(9, 9), (9, 10), (9, 11), (9, 12);

-- =========================================================
-- DATOS PARA JAPÓN (business_id = 4)
-- =========================================================
INSERT INTO services (business_id, name, icon, duration_minutes, price, is_popular) VALUES
(4, 'ヘアカット', '✂️', 30, 3800, true),
(4, 'カット＋ひげ剃り', '🪒', 50, 5800, false),
(4, 'カラーリング', '🎨', 90, 9800, false),
(4, 'ヘアトリートメント', '💆', 45, 6800, true);

INSERT INTO providers (business_id, name, initials, rating, review_count) VALUES
(4, '田中 健太', '田', 4.9, 892),
(4, '鈴木 一郎', '鈴', 4.8, 657),
(4, '山本 誠', '山', 4.7, 423);

INSERT INTO provider_services (provider_id, service_id) VALUES
(10, 13), (10, 14), (10, 15), (10, 16),
(11, 13), (11, 14), (11, 15), (11, 16),
(12, 13), (12, 14), (12, 15), (12, 16);

-- =========================================================
-- DATOS PARA USA (business_id = 5)
-- =========================================================
INSERT INTO services (business_id, name, icon, duration_minutes, price, is_popular) VALUES
(5, 'Haircut', '✂️', 30, 45, true),
(5, 'Haircut + Beard', '🪒', 50, 65, false),
(5, 'Hair Coloring', '🎨', 90, 120, false),
(5, 'Hair Treatment', '💆', 45, 85, true);

INSERT INTO providers (business_id, name, initials, rating, review_count) VALUES
(5, 'James Smith', 'JS', 4.9, 754),
(5, 'Michael Johnson', 'MJ', 4.8, 512),
(5, 'Robert Williams', 'RW', 4.7, 342);

INSERT INTO provider_services (provider_id, service_id) VALUES
(13, 17), (13, 18), (13, 19), (13, 20),
(14, 17), (14, 18), (14, 19), (14, 20),
(15, 17), (15, 18), (15, 19), (15, 20);
