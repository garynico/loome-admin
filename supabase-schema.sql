-- Run this in Supabase SQL Editor to set up the database schema
--
-- NOTE: this file reflects the schema as actually used by the app code
-- (src/types/index.ts and the API routes under src/app/api). It was
-- reconstructed from usage, not exported from a live database — if you're
-- migrating an existing project, diff against your real schema before running.

-- Customers
CREATE TABLE customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female')),
  notes TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Services (admin-defined treatments)
CREATE TABLE services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  gender_target TEXT NOT NULL DEFAULT 'all' CHECK (gender_target IN ('male', 'female', 'all')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Packages (bundles of N sessions of a service, sold at a fixed price)
CREATE TABLE packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  sessions INTEGER NOT NULL,
  price INTEGER NOT NULL,
  gender_target TEXT NOT NULL DEFAULT 'all' CHECK (gender_target IN ('male', 'female', 'all')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer package purchases (snapshot of the package at time of purchase,
-- so later edits to `packages` don't retroactively change what was sold)
CREATE TABLE customer_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
  package_name TEXT NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  sessions_total INTEGER NOT NULL,
  sessions_used INTEGER NOT NULL DEFAULT 0,
  paid_price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Bookings
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  service_ids UUID[] DEFAULT '{}',
  custom_price INTEGER,
  dp_amount INTEGER NOT NULL DEFAULT 0,
  customer_package_id UUID REFERENCES customer_packages(id) ON DELETE SET NULL,
  date DATE,
  time TIME,
  duration_minutes INTEGER,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_bookings_date ON bookings(date);
CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_customer_package_id ON bookings(customer_package_id);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customer_packages_customer_id ON customer_packages(customer_id);
CREATE INDEX idx_packages_service_id ON packages(service_id);

-- Disable RLS for internal admin tool (all access goes through the
-- service_role key on the server, never the anon key from the browser)
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;

-- Atomically adjust a customer_package's session count.
-- Called by the booking API whenever a booking is created/cancelled/
-- reconfirmed/deleted/reassigned against a package (delta = +1 to consume
-- a session, -1 to give one back). Clamped to [0, sessions_total] and
-- flips status to 'completed' once all sessions are used (and back to
-- 'active' if a session is returned to a completed package).
CREATE OR REPLACE FUNCTION adjust_package_sessions(pkg_id UUID, delta INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE customer_packages
  SET
    sessions_used = LEAST(GREATEST(sessions_used + delta, 0), sessions_total),
    status = CASE
      WHEN status = 'cancelled' THEN status
      WHEN LEAST(GREATEST(sessions_used + delta, 0), sessions_total) >= sessions_total THEN 'completed'
      ELSE 'active'
    END
  WHERE id = pkg_id;
END;
$$ LANGUAGE plpgsql;
