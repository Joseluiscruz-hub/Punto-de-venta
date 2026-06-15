import '@fastify/jwt';

export type ApiRole = 'ADMIN' | 'MANAGER' | 'CASHIER';

export interface AuthClaims {
  sub: string;
  tenantId: string;
  role: ApiRole;
  username: string;
  name: string;
  storeId: string;
  registerId: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthClaims;
    user: AuthClaims;
  }
}
