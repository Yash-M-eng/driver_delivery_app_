import "react-native-gesture-handler";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import DeliveriesScreen from "./src/screens/DeliveriesScreen";
import EmailConfirmationPendingScreen from "./src/screens/EmailConfirmationPendingScreen";
import LoginScreen from "./src/screens/LoginScreen";
import OptimizedRouteScreen from "./src/screens/OptimizedRouteScreen";
import OtpVerificationScreen from "./src/screens/OtpVerificationScreen";
import PhoneVerificationScreen from "./src/screens/PhoneVerificationScreen";
import { registerForPushNotificationsAsync } from "./src/services/notifications";
import { supabase } from "./src/services/supabase";
import { Delivery, RootStackParamList } from "./src/types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// TEMP: Force app to start on Deliveries list.
// Set to `true` only for local UI testing.
const FORCE_DELIVERIES_SCREEN = false;

export default function App() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsPhoneVerification, setNeedsPhoneVerification] = useState(false);
  const hasPendingDeliveriesNavigationRef = useRef(false);

  const routeFromNotificationIfNeeded = useCallback(async (response: Notifications.NotificationResponse | null) => {
    const target = response?.notification.request.content.data?.screen;
    if (target !== "Deliveries") {
      return;
    }

    if (navigationRef.isReady()) {
      navigationRef.navigate("Deliveries");
      hasPendingDeliveriesNavigationRef.current = false;
      return;
    }

    hasPendingDeliveriesNavigationRef.current = true;
  }, []);

  useEffect(() => {
    let responseSub: Notifications.Subscription | undefined;

    const setupListeners = async () => {
      if (Constants.appOwnership === "expo" && Platform.OS === "android") {
        return;
      }

      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      await routeFromNotificationIfNeeded(lastResponse);

      responseSub = Notifications.addNotificationResponseReceivedListener(
        (response: Notifications.NotificationResponse) => {
          void routeFromNotificationIfNeeded(response);
        },
      );
    };

    void setupListeners();

    return () => {
      responseSub?.remove();
    };
  }, [routeFromNotificationIfNeeded]);

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentUser = session?.user;
      setIsAuthenticated(Boolean(currentUser));
      setNeedsPhoneVerification(Boolean(currentUser) && !Boolean(currentUser?.phone_confirmed_at));

      setSessionLoading(false);
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user;
      setIsAuthenticated(Boolean(currentUser));
      setNeedsPhoneVerification(Boolean(currentUser) && !Boolean(currentUser?.phone_confirmed_at));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (sessionLoading || !isAuthenticated || needsPhoneVerification) {
      return;
    }

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (user?.phone_confirmed_at) {
        await registerForPushNotificationsAsync(user.id);
      }
    })();
  }, [sessionLoading, isAuthenticated, needsPhoneVerification]);

  if (sessionLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (hasPendingDeliveriesNavigationRef.current) {
          navigationRef.navigate("Deliveries");
          hasPendingDeliveriesNavigationRef.current = false;
        }
      }}
    >
      <StatusBar style="dark" />
      <Stack.Navigator>
        {FORCE_DELIVERIES_SCREEN ? (
          <>
            <Stack.Screen name="Deliveries" options={{ title: "My Deliveries" }}>
              {(props) => <DeliveriesScreen {...props} />}
            </Stack.Screen>
            <Stack.Screen
              name="OptimizedRoute"
              options={{ title: "Optimized Route" }}
              initialParams={{ deliveries: [] as Delivery[] }}
            >
              {(props) => <OptimizedRouteScreen {...props} />}
            </Stack.Screen>
          </>
        ) : !isAuthenticated ? (
          <>
            <Stack.Screen name="Login" options={{ headerShown: false }}>
              {(props) => <LoginScreen {...props} />}
            </Stack.Screen>
            <Stack.Screen
              name="EmailConfirmationPending"
              options={{
                title: "Confirm Email",
                headerBackVisible: false,
                gestureEnabled: false,
              }}
            >
              {(props) => <EmailConfirmationPendingScreen {...props} />}
            </Stack.Screen>
          </>
        ) : needsPhoneVerification ? (
          <>
            <Stack.Screen name="PhoneVerification" options={{ title: "Verify Mobile Number" }}>
              {(props) => <PhoneVerificationScreen {...props} />}
            </Stack.Screen>
            <Stack.Screen name="OtpVerification" options={{ title: "Enter OTP" }}>
              {(props) => <OtpVerificationScreen {...props} onVerified={() => setNeedsPhoneVerification(false)} />}
            </Stack.Screen>
          </>
        ) : (
          <>
            <Stack.Screen name="Deliveries" options={{ title: "My Deliveries" }}>
              {(props) => <DeliveriesScreen {...props} />}
            </Stack.Screen>
            <Stack.Screen
              name="OptimizedRoute"
              options={{ title: "Optimized Route" }}
              initialParams={{ deliveries: [] as Delivery[] }}
            >
              {(props) => <OptimizedRouteScreen {...props} />}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
