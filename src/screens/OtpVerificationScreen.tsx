import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../services/supabase";
import { OtpVerificationScreenProps } from "../types";

type Props = OtpVerificationScreenProps & {
  onVerified: () => void;
};

export default function OtpVerificationScreen({ route, onVerified }: Props) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const phoneNumber = route.params.phoneNumber;

  const verifyOtp = async () => {
    try {
      setLoading(true);
      console.log("Verification .........", {
        phone: phoneNumber,
        token: otp.trim(),
        type: "phone_change",
      });
      const { error } = await supabase.auth.verifyOtp({
        phone: phoneNumber,
        token: otp.trim(),
        type: "phone_change",
      });

      if (error) {
        
        Alert.alert("Verification failed", error.message);
        return;
      }

      onVerified();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter OTP</Text>
      <Text style={styles.subtitle}>Code sent to {phoneNumber}</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter OTP"
        keyboardType="number-pad"
        value={otp}
        onChangeText={setOtp}
      />
      <Pressable style={styles.button} onPress={verifyOtp} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Verifying..." : "Verify OTP"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#F8FAFC",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 10,
    color: "#0F172A",
  },
  subtitle: {
    marginBottom: 16,
    color: "#475569",
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  button: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
