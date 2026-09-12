import Facturapi from 'facturapi';
import { config } from '../config.js';

export type PaymentMethodCode = 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED';

/** ClaveProdServ genérica de abarrotes (catálogo SAT). */
export const DEFAULT_PRODUCT_KEY = '50121500';
export const DEFAULT_UNIT_KEY = 'H87';
export const GLOBAL_RFC = 'XAXX010101000';
export const GLOBAL_LEGAL_NAME = 'PUBLICO EN GENERAL';
export const GLOBAL_TAX_SYSTEM = '616';

export type FacturapiInvoiceResult = {
  id: string;
  uuid?: string | null;
  status?: string;
};

export type FacturapiLike = {
  invoices: {
    create: (payload: Record<string, unknown>) => Promise<FacturapiInvoiceResult>;
  };
};

let testClient: FacturapiLike | null = null;

export function setFacturapiClientForTests(client: FacturapiLike | null) {
  testClient = client;
}

export function isFacturapiConfigured() {
  return Boolean(config.FACTURAPI_SECRET_KEY?.trim());
}

export function getFacturapiClient(): FacturapiLike | null {
  if (testClient) return testClient;
  const key = config.FACTURAPI_SECRET_KEY?.trim();
  if (!key) return null;
  return new Facturapi(key) as unknown as FacturapiLike;
}

/** RFC mexicano (persona física 13 / moral 12), sin genéricos de público en general. */
export function isValidCustomerRfc(taxId?: string | null): boolean {
  if (!taxId) return false;
  const rfc = taxId.trim().toUpperCase();
  if (rfc === GLOBAL_RFC || rfc === 'XEXX010101000') return false;
  return /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc);
}

export function inferTaxSystem(rfc: string): string {
  const clean = rfc.trim().toUpperCase();
  return clean.length === 12 ? '601' : '612';
}

export function mapPaymentForm(method: PaymentMethodCode): string {
  switch (method) {
    case 'CASH':
      return '01';
    case 'CARD':
      return '04';
    case 'TRANSFER':
      return '03';
    case 'MIXED':
      return '99';
    default:
      return '99';
  }
}

export function currentGlobalPeriod(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function periodParts(period: string): { year: number; months: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!match) throw new Error(`Periodo invalido: ${period}`);
  return { year: Number(match[1]), months: match[2]! };
}

export function getInvoiceUrls(facturapiId: string) {
  return {
    pdfUrl: `https://www.facturapi.io/v2/invoices/${facturapiId}/pdf`,
    xmlUrl: `https://www.facturapi.io/v2/invoices/${facturapiId}/xml`,
  };
}

export type SaleLineForInvoice = {
  name: string;
  quantity: number;
  price: number;
};

export function buildSaleItemsPayload(lines: SaleLineForInvoice[]) {
  return lines.map((line) => ({
    quantity: line.quantity,
    product: {
      description: line.name.slice(0, 1000),
      product_key: DEFAULT_PRODUCT_KEY,
      unit_key: DEFAULT_UNIT_KEY,
      price: line.price,
      tax_included: true,
      taxes: [{ type: 'IVA', rate: 0.16 }],
    },
  }));
}

export async function createIncomeInvoice(input: {
  customer: {
    legal_name: string;
    tax_id: string;
    tax_system: string;
    email?: string;
    zip: string;
  };
  items: SaleLineForInvoice[];
  paymentMethod: PaymentMethodCode;
  use?: string;
  externalId?: string;
  global?: { periodicity: string; months: string; year: number };
}) {
  const client = getFacturapiClient();
  if (!client) throw new Error('FACTURAPI_SECRET_KEY no configurada');

  const payload: Record<string, unknown> = {
    customer: {
      legal_name: input.customer.legal_name,
      tax_id: input.customer.tax_id,
      tax_system: input.customer.tax_system,
      email: input.customer.email,
      address: { zip: input.customer.zip },
    },
    items: buildSaleItemsPayload(input.items),
    use: input.use ?? (input.global ? 'S01' : 'G01'),
    payment_form: mapPaymentForm(input.paymentMethod),
    payment_method: 'PUE',
    external_id: input.externalId,
  };
  if (input.global) payload.global = input.global;

  return client.invoices.create(payload);
}

export async function createCreditNoteInvoice(input: {
  customer: {
    legal_name: string;
    tax_id: string;
    tax_system: string;
    email?: string;
    zip: string;
  };
  items: SaleLineForInvoice[];
  paymentMethod: PaymentMethodCode;
  relatedUuid: string;
  externalId?: string;
}) {
  const client = getFacturapiClient();
  if (!client) throw new Error('FACTURAPI_SECRET_KEY no configurada');

  return client.invoices.create({
    type: 'E',
    customer: {
      legal_name: input.customer.legal_name,
      tax_id: input.customer.tax_id,
      tax_system: input.customer.tax_system,
      email: input.customer.email,
      address: { zip: input.customer.zip },
    },
    items: buildSaleItemsPayload(input.items),
    use: 'G02',
    payment_form: mapPaymentForm(input.paymentMethod),
    payment_method: 'PUE',
    related_documents: [
      {
        relationship: '01',
        documents: [input.relatedUuid],
      },
    ],
    external_id: input.externalId,
  });
}
