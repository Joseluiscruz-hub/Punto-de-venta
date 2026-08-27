ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS cash_in numeric(14,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS cash_movements (
  id uuid PRIMARY KEY,
  external_id text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  register_id uuid NOT NULL REFERENCES registers(id),
  shift_id uuid NOT NULL REFERENCES shifts(id),
  user_id uuid NOT NULL REFERENCES users(id),
  type text NOT NULL CHECK (type IN ('CASH_IN', 'CASH_OUT')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_id)
);

CREATE INDEX IF NOT EXISTS cash_movements_shift_created_idx
  ON cash_movements (shift_id, created_at DESC);
