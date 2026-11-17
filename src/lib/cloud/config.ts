/** Supabase project details, set as environment variables at build time (Vercel: Project Settings, Environment Variables). */
export const CLOUD_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
export const CLOUD_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export function cloudConfigured(): boolean {
  return /^https:\/\/.+/.test(CLOUD_URL) && CLOUD_KEY.length > 20;
}

export const TABLE = 'user_data';
export const BUCKET = 'images';
