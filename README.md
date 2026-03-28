# Driver Delivery App (Expo + Supabase)

React Native delivery driver app built with Expo. Includes:

- Email/password login (Supabase Auth)
- Required phone OTP verification before app access
- Realtime deliveries list from Supabase Postgres
- Optimized route screen with map + dynamic rerouting
- Push notification when a **new row** is inserted into `public.deliveries` (via Supabase Database Webhook → Edge Function → Expo Push)

## Tech Stack

- Expo / React Native
- React Navigation
- Supabase Auth + Postgres + Realtime + Edge Functions
- Expo Notifications (Expo Push)
- React Native Maps

## 1) Prerequisites

- Node 20+
- Expo CLI (via `npx expo`)
- Supabase project
- (Optional but recommended) Google Maps Distance Matrix API key for traffic-aware route scoring

## 2) Environment variables

**Do not commit real credentials.** The repo includes `.env.example` only; copy it to `.env` locally (`.env` is gitignored).

| Variable | Required | Where it is used |
|----------|----------|------------------|
| `SUPABASE_URL` | Yes* | `app.config.js` → `extra` → Supabase client |
| `SUPABASE_ANON_KEY` | Yes* | Same (anon / publishable key from the dashboard) |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | No | Maps / directions / route scoring |

\*You can use `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` instead if you prefer; `SUPABASE_*` names match the Supabase dashboard labels.

**Never** put `SUPABASE_SERVICE_ROLE_KEY` in `.env` for this app. The service role is for server-side code only (Edge Functions get it automatically on Supabase hosting).

Setup:

```bash
cp .env.example .env
```

Edit `.env` with values from **Supabase → Project Settings → API** (Project URL + anon public key).

`app.config.js` reads `.env` at startup and passes URL/key into `expo.extra` so the client can use dashboard-style names without exposing them as raw `EXPO_PUBLIC_*` globals (though either style works).

For **EAS Build**, configure the same variables as [EAS secrets](https://docs.expo.dev/build-reference/variables/) or in your CI so `app.config.js` sees them during the build.

## 3) Install & app config

```bash
npm install
```

Update `app.json` / `app.config.js` output as needed:

- `expo.extra.eas.projectId` — your [EAS project ID](https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid) (required for `getExpoPushTokenAsync`).

**Android (FCM)** for push on real devices: follow [FCM credentials (Expo)](https://docs.expo.dev/push-notifications/fcm-credentials/). Place `google-services.json` in the project root (gitignored) and under `android/app/` for local Gradle builds; add FCM credentials in the Expo dashboard for EAS builds.

## 4) Supabase database (migrations)

Schema lives in `supabase/migrations/`. Apply them in **filename order** (Supabase CLI: `supabase db push`, or run each file in the SQL editor).

Relevant files:

| Migration | Purpose |
|-----------|---------|
| `20260327155000_create_driver_profiles.sql` | Driver profile + RLS + `push_token` |
| `20260327155100_create_deliveries.sql` | **`deliveries` table** (`delivery_status` enum, RLS, indexes) |
| `20260328120000_drop_driver_profiles_push_token.sql` | Historical: drops `push_token` if you use that path |
| `20260328140000_driver_profiles_push_token_if_missing.sql` | Restores `push_token` column if missing |

### Seed example (`driver_id` = real `auth.users.id`)

```sql
insert into public.deliveries (order_id, customer_name, address, latitude, longitude, status, driver_id)
values
('ORD-1001', 'Jane Miller', '123 Main St, Toronto', 43.65107, -79.347015, 'pending', 'YOUR_DRIVER_USER_UUID');
```

## 5) Push: deploy function + webhook

1. Deploy:

```bash
supabase functions deploy new-delivery-notify
```

2. **Database → Webhooks**: table `public.deliveries`, event **Insert**, POST to  
   `https://<PROJECT_REF>.functions.supabase.co/new-delivery-notify`, **include row data**.

Hosted functions receive `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically; do not set those via `supabase secrets` (reserved names).

Driver must use a **dev/production build** (not Expo Go on Android for remote push), complete phone verification, and allow notifications so `driver_profiles.push_token` is set.

## 6) Trigger a test notification

**A — Webhook path (realistic)**  
After the webhook is configured, insert a row (SQL or app) with a valid `driver_id` and a saved `push_token`:

```sql
insert into public.deliveries (order_id, customer_name, address, latitude, longitude, status, driver_id)
values
('ORD-TEST', 'Test Customer', '1 Test St', 43.65, -79.38, 'pending', 'YOUR_DRIVER_AUTH_USER_UUID');
```

**B — Curl the Edge Function (no DB insert)**  
Replace `PROJECT_REF` and `DRIVER_UUID` (must match a user with `push_token` set):

```bash
curl -sS -X POST "https://PROJECT_REF.functions.supabase.co/new-delivery-notify" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "record": {
      "id": "00000000-0000-0000-0000-000000000001",
      "order_id": "ORD-CURL-1",
      "customer_name": "Curl Test",
      "address": "123 Test St",
      "driver_id": "DRIVER_UUID"
    }
  }'
```

Expect `{"ok":true,"sent":true}` or a JSON error (`no_push_token`, etc.). Check **Edge Functions → Logs** if needed.

## 7) Run app

```bash
npm run start
```

## 8) Build APK

```bash
npx eas build -p android --profile preview
```

## Notes

- Route optimization uses Google Distance Matrix when `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is set; otherwise a distance heuristic.
- Opening a push notification navigates to **Deliveries** when `data.screen` is `Deliveries`.

### If `.env` was ever committed

Remove it from git history, add `.env` to `.gitignore` (already in this repo), **rotate** the Supabase anon key and any other exposed secrets in the dashboard.
