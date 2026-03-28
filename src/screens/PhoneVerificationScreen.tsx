import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../services/supabase";
import { PhoneVerificationScreenProps } from "../types";

export default function PhoneVerificationScreen({ navigation }: PhoneVerificationScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    try {
      setLoading(true);
      const normalized = phoneNumber.trim();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Not logged in", "Please sign in first, then verify your phone number.");
        return;
      }

      // Attach phone to the currently logged-in user; Supabase will send an SMS OTP.
      const { error } = await supabase.auth.updateUser({ phone: normalized });

      if (error) {
        Alert.alert("Unable to send OTP", error.message);
        return;
      }

      navigation.navigate("OtpVerification", { phoneNumber: normalized });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify your mobile number</Text>
      <TextInput
        style={styles.input}
        placeholder="+1XXXXXXXXXX"
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
      />
      <Pressable style={styles.button} onPress={sendOtp} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Sending..." : "Send OTP"}</Text>
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
    marginBottom: 16,
    color: "#0F172A",
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
