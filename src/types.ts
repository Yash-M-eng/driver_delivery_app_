import { NativeStackScreenProps } from "@react-navigation/native-stack";

export type DeliveryStatus = "pending" | "out_for_delivery" | "delivered";

export type Delivery = {
  id: string;
  order_id: string;
  customer_name: string;
  address: string;
  latitude: number;
  longitude: number;
  status: DeliveryStatus;
  driver_id: string;
  created_at: string;
};

export type RootStackParamList = {
  Login: undefined;
  EmailConfirmationPending: {
    email: string;
    password: string;
  };
  PhoneVerification: undefined;
  OtpVerification: {
    phoneNumber: string;
  };
  Deliveries: undefined;
  OptimizedRoute: {
    deliveries: Delivery[];
  };
};

export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, "Login">;
export type EmailConfirmationPendingScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "EmailConfirmationPending"
>;
export type PhoneVerificationScreenProps = NativeStackScreenProps<RootStackParamList, "PhoneVerification">;
export type OtpVerificationScreenProps = NativeStackScreenProps<RootStackParamList, "OtpVerification">;
export type DeliveriesScreenProps = NativeStackScreenProps<RootStackParamList, "Deliveries">;
export type OptimizedRouteScreenProps = NativeStackScreenProps<RootStackParamList, "OptimizedRoute">;
