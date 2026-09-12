ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS invoice_status text NOT NULL DEFAULT 'NONE'
    CHECK (invoice_status IN ('NONE', 'PENDING_GLOBAL', 'STAMPED', 'ERROR', 'CREDIT_NOTE')),
  ADD COLUMN IF NOT EXISTS invoice_id text,
  ADD COLUMN IF NOT EXISTS invoice_uuid text,
  ADD COLUMN IF NOT EXISTS invoice_error text,
  ADD COLUMN IF NOT EXISTS global_period text;

CREATE INDEX IF NOT EXISTS sales_invoice_status_idx
  ON sales (tenant_id, invoice_status, global_period);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  store_id uuid REFERENCES stores(id),
  sale_id uuid REFERENCES sales(id),
  kind text NOT NULL CHECK (kind IN ('SALE', 'GLOBAL', 'CREDIT_NOTE')),
  status text NOT NULL CHECK (status IN ('NONE', 'PENDING_GLOBAL', 'STAMPED', 'ERROR', 'CREDIT_NOTE')),
  facturapi_id text,
  uuid text,
  global_period text,
  error text,
  total numeric(14,2) NOT NULL DEFAULT 0,
  payment_form text,
  related_invoice_id uuid REFERENCES invoices(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_tenant_created_idx
  ON invoices (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS invoices_sale_id_idx
  ON invoices (sale_id);
