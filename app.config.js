const appJson = require("./app.json");

/**
 * Loads env at config time (Expo reads `.env` when evaluating this file).
 * `SUPABASE_*` keys match the Supabase dashboard; they are passed to the app via `extra`
 * because only `EXPO_PUBLIC_*` is inlined into JS by Metro by default.
 */
module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra ?? {}),
      supabaseUrl:
        process.env.SUPABASE_URL?.trim() ||
        process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
        "",
      supabaseAnonKey:
        process.env.SUPABASE_ANON_KEY?.trim() ||
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
        process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ||
        "",
    },
  },
};
