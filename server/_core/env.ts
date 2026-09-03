export const ENV = {
  supabaseUrl: process.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseDbUrl: process.env.SUPABASE_DB_URL ?? "",
  vapidPublicKey: process.env.VITE_VAPID_PUBLIC_KEY ?? "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  vapidSubject: process.env.VAPID_SUBJECT ?? "",
  aiApiUrl: process.env.OPENAI_BASE_URL ?? "",
  aiApiKey: process.env.OPENAI_API_KEY ?? process.env.OPENROUTER_API_KEY ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
