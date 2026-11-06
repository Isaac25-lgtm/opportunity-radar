export interface Env {
  DB: D1Database;
  DOCS: KVNamespace;
  ASSETS?: Fetcher;
  ENVIRONMENT: string;
  APP_NAME?: string;
  APP_URL?: string;
  SESSION_SECRET?: string;
  ADMIN_EMAILS?: string;
  EMAIL_PROVIDER?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  AI_PROVIDER?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  PAYMENT_PROVIDER?: string;
  PESAPAL_ENV?: string;
  PESAPAL_CONSUMER_KEY?: string;
  PESAPAL_CONSUMER_SECRET?: string;
  PESAPAL_IPN_ID?: string;
  PESAPAL_IPN_SECRET?: string;
  RELIEFWEB_APPNAME?: string;
}

export type AppUser = {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  status: string;
  timezone: string;
  onboarded_at: string | null;
  created_at: string;
};

export type AppVars = { user: AppUser | null; sessionId: string | null };
export type AppEnv = { Bindings: Env; Variables: AppVars };

export const isProduction = (env: Env) => env.ENVIRONMENT === 'production';
