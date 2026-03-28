import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../services/supabase";
import { LoginScreenProps } from "../types";

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      setLoading(true);
      const normalizedEmail = email.trim().toLowerCase();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!signInError) {
        return;
      }

      if (signInError.message !== "Invalid login credentials") {
        Alert.alert("Login failed", signInError.message);
        return;
      }

      // If sign-in fails, attempt to create the user with the same credentials.
      const { error: signUpError, data: signUpData } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("already registered")) {
          Alert.alert("Login failed", "Account exists, but password is incorrect.");
          return;
        }
        Alert.alert("Sign up failed", signUpError.message);
        return;
      }

      // Best-effort: create a driver profile row immediately.
      if (signUpData.user?.id) {
        await supabase.from("driver_profiles").upsert(
          {
            user_id: signUpData.user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      }

      // Some Supabase setups may not return a session immediately on sign-up.
      // Try signing in so auth state updates and app can route to phone verification.
      if (!signUpData.session) {
        const { error: retrySignInError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (retrySignInError) {
          const msg = retrySignInError.message.toLowerCase();
          const needsEmailConfirm = msg.includes("confirm") || msg.includes("verified") || msg.includes("not confirmed");
          if (needsEmailConfirm) {
            Alert.alert("Account created", "We sent you a confirmation link. Please confirm your email.", [
              {
                text: "OK",
                onPress: () => {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: "EmailConfirmationPending", params: { email: normalizedEmail, password } }],
                  });
                },
              },
            ]);
            return;
          }

          Alert.alert("Account created", retrySignInError.message);
          return;
        }
      }

      Alert.alert("Welcome", "Account created successfully.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Driver Login</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.button} onPress={onLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Please wait..." : "Sign In"}</Text>
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
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 20,
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
