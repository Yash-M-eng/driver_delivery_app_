import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

type AppExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra = Constants.expoConfig?.extra as AppExtra | undefined;

const supabaseUrl =
  extra?.supabaseUrl?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  "";

const supabaseAnonKey =
  extra?.supabaseAnonKey?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ||
  "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase URL or anon key. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env (see .env.example), or EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
