import type {
  Client,
  CreateProductInput,
  LoginResponse,
  ProcessSaleInput,
  ProductView,
  RequestContext,
  Sale,
  Session,
  Shift,
  StockMovementView,
  UpdateProductInput,
} from '../models/types';

const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const sessionKey = 'el-triunfo.enterprise-session.v2';
let accessToken = '';
let refreshPromise: Promise<void> | null = null;

interface ApiErrorBody {
  error?: { message?: string };
  message?: string;
}

async function responseError(response: Response) {
  const body = await response.json().catch(() => ({})) as ApiErrorBody;
  return new Error(body.error?.message ?? body.message ?? `Error HTTP ${response.status}`);
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const response = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      localStorage.removeItem(sessionKey);
      window.dispatchEvent(new Event('el-triunfo:session-expired'));
      throw await responseError(response);
    }
    const session = await response.json() as Session;
    accessToken = session.token;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${apiUrl}${path}`, { ...init, headers, credentials: 'include' });
  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    await refreshAccessToken();
    return request<T>(path, init, false);
  }
  if (!response.ok) throw await responseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function contextHeaders(context: Pick<RequestContext, 'storeId'>) {
  const session = JSON.parse(localStorage.getItem(sessionKey) ?? 'null') as Session | null;
  return {
    'x-store-id': context.storeId,
    ...(session?.register?.id ? { 'x-register-id': session.register.id } : {}),
  };
}

export const remoteBackend = {
  async login(username: string, pin: string): Promise<LoginResponse> {
    const session = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ organization: 'EL-TRIUNFO', username, pin }),
    }, false);
    accessToken = session.token;
    return session;
  },

  async logout() {
    try {
      await request<void>('/auth/logout', { method: 'POST' }, false);
    } finally {
      accessToken = '';
    }
  },

  async getStoreProducts(context: RequestContext): Promise<ProductView[]> {
    return request('/products', { headers: contextHeaders(context) });
  },

  async saveProduct(context: RequestContext, product: CreateProductInput | UpdateProductInput): Promise<ProductView> {
    const isUpdate = 'id' in product && Boolean(product.id);
    return request(isUpdate ? `/products/${product.id}` : '/products', {
      method: isUpdate ? 'PUT' : 'POST',
      headers: contextHeaders(context),
      body: JSON.stringify(product),
    });
  },

  async saveProductsBulk(context: RequestContext, products: CreateProductInput[]): Promise<void> {
    for (const product of products) await this.saveProduct(context, product);
  },

  async deleteProduct(context: RequestContext, productId: string): Promise<void> {
    await request(`/products/${productId}`, { method: 'DELETE', headers: contextHeaders(context) });
  },

  async processSale(context: RequestContext, sale: ProcessSaleInput): Promise<Sale> {
    return request('/sales', {
      method: 'POST',
      headers: contextHeaders(context),
      body: JSON.stringify({
        externalId: sale.externalId,
        items: sale.items.map((item) => ({ id: item.id, quantity: item.quantity })),
        paymentMethod: sale.paymentMethod,
        amountTendered: sale.amountTendered,
        clientId: sale.clientId,
        offlineDate: sale.offlineDate,
      }),
    });
  },

  async getActiveShift(context: RequestContext): Promise<Shift | null> {
    return request('/shifts/active', { headers: contextHeaders(context) });
  },

  async openShift(context: RequestContext, initialCash: number): Promise<Shift> {
    return request('/shifts/open', {
      method: 'POST',
      headers: contextHeaders(context),
      body: JSON.stringify({ initialCash }),
    });
  },

  async closeShift(context: RequestContext, actualCash: number): Promise<Shift> {
    const active = await this.getActiveShift(context);
    if (!active) throw new Error('No hay un turno activo para cerrar');
    return request(`/shifts/${active.id}/close`, {
      method: 'POST',
      headers: contextHeaders(context),
      body: JSON.stringify({ actualCash }),
    });
  },

  async getShifts(context: RequestContext): Promise<Shift[]> {
    return request('/shifts', { headers: contextHeaders(context) });
  },

  async getClients(context: Pick<RequestContext, 'tenantId' | 'storeId'>): Promise<Client[]> {
    return request('/customers', { headers: contextHeaders(context) });
  },

  async saveClient(context: Pick<RequestContext, 'tenantId' | 'storeId'>, client: Partial<Client>): Promise<Client> {
    const isUpdate = Boolean(client.id);
    return request(isUpdate ? `/customers/${client.id}` : '/customers', {
      method: isUpdate ? 'PUT' : 'POST',
      headers: contextHeaders(context),
      body: JSON.stringify(client),
    });
  },

  async deleteClient(context: Pick<RequestContext, 'tenantId' | 'storeId'>, clientId: string): Promise<void> {
    await request(`/customers/${clientId}`, { method: 'DELETE', headers: contextHeaders(context) });
  },

  async getSales(context: Pick<RequestContext, 'tenantId'> & Partial<Pick<RequestContext, 'storeId'>>): Promise<Sale[]> {
    return request('/sales', { headers: context.storeId ? contextHeaders({ storeId: context.storeId }) : undefined });
  },

  async getStockMovements(context: Pick<RequestContext, 'tenantId'> & Partial<Pick<RequestContext, 'storeId'>>): Promise<StockMovementView[]> {
    return request('/stock-movements', { headers: context.storeId ? contextHeaders({ storeId: context.storeId }) : undefined });
  },
};
