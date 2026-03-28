const appJson = require("./app.json");

/**
 * Loads env at config time (Expo reads `.env` when evaluating this file).
 * `SUPABASE_*` keys match the Supabase dashboard; they are passed to the app via `extra`
 * because only `EXPO_PUBLIC_*` is inlined into JS by Metro by default.
 */
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

module.exports = {
  expo: {
    ...appJson.expo,
    android: {
      ...(appJson.expo.android ?? {}),
      config: {
        ...((appJson.expo.android ?? {}).config ?? {}),
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    ios: {
      ...(appJson.expo.ios ?? {}),
      config: {
        ...((appJson.expo.ios ?? {}).config ?? {}),
        googleMapsApiKey: googleMapsApiKey,
      },
    },
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
