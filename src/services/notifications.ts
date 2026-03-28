import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

/** Must match Android channel in registerForPushNotificationsAsync and Edge Function `channelId`. */
export const DELIVERY_NOTIFICATION_CHANNEL_ID = "myNotificationChannel";

export async function registerForPushNotificationsAsync(driverId: string): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  // Expo Go on Android (SDK 53+) does not support remote push; skip token registration.
  if (Constants.appOwnership === "expo" && Platform.OS === "android") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(DELIVERY_NOTIFICATION_CHANNEL_ID, {
      name: "Delivery updates",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return null;
  }

  let token: string;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn("[push] Project ID not found; set expo.extra.eas.projectId in app.json");
      return null;
    }
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (e) {
    console.warn("[push] getExpoPushTokenAsync failed", e);
    return null;
  }

  await supabase.from("driver_profiles").upsert(
    {
      user_id: driverId,
      push_token: token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return token;
}
