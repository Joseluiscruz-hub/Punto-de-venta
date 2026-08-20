ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS refunds_cash numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS store_credit numeric(14,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS sale_returns (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  sale_id uuid NOT NULL REFERENCES sales(id),
  shift_id uuid NOT NULL REFERENCES shifts(id),
  user_id uuid NOT NULL REFERENCES users(id),
  refund_method text NOT NULL CHECK (refund_method IN ('CASH', 'STORE_CREDIT')),
  total numeric(14,2) NOT NULL CHECK (total >= 0),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_return_items (
  id uuid PRIMARY KEY,
  return_id uuid NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
  sale_item_id uuid NOT NULL REFERENCES sale_items(id),
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  price numeric(14,2) NOT NULL CHECK (price >= 0),
  subtotal numeric(14,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE INDEX IF NOT EXISTS sale_returns_sale_created_idx
  ON sale_returns (sale_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sale_return_items_sale_item_idx
  ON sale_return_items (sale_item_id);
