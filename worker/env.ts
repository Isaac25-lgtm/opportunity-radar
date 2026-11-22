export interface Env {
  DB: D1Database;
  DOCS: KVNamespace;
  ASSETS?: Fetcher;
  ENVIRONMENT: string;
  APP_NAME?: string;
  APP_URL?: string;
  ADMIN_EMAILS?: string;
  EMAIL_PROVIDER?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
  /** none (default) | python: the separate AI service in ai-service/. */
  AI_PROVIDER?: string;
  AI_SERVICE_URL?: string;
  AI_SERVICE_TOKEN?: string;
  PAYMENT_PROVIDER?: string;
  PESAPAL_ENV?: string;
  PESAPAL_CONSUMER_KEY?: string;
  PESAPAL_CONSUMER_SECRET?: string;
  PESAPAL_IPN_ID?: string;
  PESAPAL_IPN_SECRET?: string;
  RELIEFWEB_APPNAME?: string;
  /** Google sign-in; off until both are set. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
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
