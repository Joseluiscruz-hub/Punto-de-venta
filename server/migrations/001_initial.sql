CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'PREMIUM' CHECK (plan IN ('BASIC', 'PRO', 'PREMIUM')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  code text NOT NULL,
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'America/Mexico_City',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS registers (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  code text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  username text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'CASHIER')),
  pin_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, username)
);

CREATE TABLE IF NOT EXISTS user_store_access (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  is_default boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, store_id)
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  barcode text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  cost numeric(14,2) NOT NULL CHECK (cost >= 0),
  price numeric(14,2) NOT NULL CHECK (price >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, barcode)
);

CREATE TABLE IF NOT EXISTS inventory (
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  product_id uuid NOT NULL REFERENCES products(id),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock integer NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, product_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  email text,
  phone text,
  tax_id text,
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  total_spent numeric(14,2) NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  last_visit timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  register_id uuid NOT NULL REFERENCES registers(id),
  user_id uuid NOT NULL REFERENCES users(id),
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  initial_cash numeric(14,2) NOT NULL CHECK (initial_cash >= 0),
  expected_cash numeric(14,2) NOT NULL CHECK (expected_cash >= 0),
  actual_cash numeric(14,2),
  difference numeric(14,2),
  status text NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
  sales_cash numeric(14,2) NOT NULL DEFAULT 0,
  sales_card numeric(14,2) NOT NULL DEFAULT 0,
  cash_out numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_shift_per_register
  ON shifts (register_id) WHERE status = 'OPEN';

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY,
  external_id text,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  register_id uuid NOT NULL REFERENCES registers(id),
  shift_id uuid REFERENCES shifts(id),
  cashier_id uuid NOT NULL REFERENCES users(id),
  customer_id uuid REFERENCES customers(id),
  datetime timestamptz NOT NULL DEFAULT now(),
  total numeric(14,2) NOT NULL CHECK (total >= 0),
  payment_method text NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'TRANSFER', 'MIXED')),
  amount_tendered numeric(14,2) NOT NULL CHECK (amount_tendered >= 0),
  change_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  items_count integer NOT NULL CHECK (items_count > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_external_id_unique
  ON sales (tenant_id, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  price numeric(14,2) NOT NULL CHECK (price >= 0),
  cost numeric(14,2) NOT NULL CHECK (cost >= 0),
  subtotal numeric(14,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  product_id uuid NOT NULL REFERENCES products(id),
  user_id uuid NOT NULL REFERENCES users(id),
  sale_id uuid REFERENCES sales(id),
  type text NOT NULL CHECK (type IN ('SALE', 'PURCHASE', 'ADJUSTMENT', 'RETURN', 'CASH_IN', 'CASH_OUT')),
  quantity integer NOT NULL,
  date timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_sessions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  actor_user_id uuid REFERENCES users(id),
  store_id uuid REFERENCES stores(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_tenant_name_idx ON products (tenant_id, name);
CREATE INDEX IF NOT EXISTS customers_tenant_name_idx ON customers (tenant_id, name);
CREATE INDEX IF NOT EXISTS sales_store_datetime_idx ON sales (store_id, datetime DESC);
CREATE INDEX IF NOT EXISTS stock_movements_store_date_idx ON stock_movements (store_id, date DESC);
CREATE INDEX IF NOT EXISTS audit_events_tenant_created_idx ON audit_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS refresh_sessions_user_idx ON refresh_sessions (user_id, expires_at);
