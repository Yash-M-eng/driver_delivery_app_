import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../services/supabase";
import { EmailConfirmationPendingScreenProps } from "../types";

export default function EmailConfirmationPendingScreen({ route }: EmailConfirmationPendingScreenProps) {
  const { email, password } = route.params;
  const [checking, setChecking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maskedEmail = useMemo(() => {
    const at = email.indexOf("@");
    if (at <= 1) return email;
    return `${email.slice(0, 2)}***${email.slice(at)}`;
  }, [email]);

  const trySignIn = async () => {
    try {
      setChecking(true);
      setLastError(null);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLastError(error.message);
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void trySignIn();

    intervalRef.current = setInterval(() => {
      void trySignIn();
    }, 4000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Confirm your email</Text>
      <Text style={styles.body}>
        We sent a confirmation link to {maskedEmail}. Please open your email app and confirm your email address.
      </Text>
      <Text style={styles.note}>Do not close this screen. We’ll automatically continue once your email is confirmed.</Text>

      <View style={styles.statusRow}>
        <ActivityIndicator />
        <Text style={styles.statusText}>{checking ? "Checking confirmation..." : "Waiting for confirmation..."}</Text>
      </View>

      {lastError ? <Text style={styles.errorText}>{lastError}</Text> : null}

      <Pressable style={styles.button} onPress={trySignIn} disabled={checking}>
        <Text style={styles.buttonText}>{checking ? "Checking..." : "I confirmed the email"}</Text>
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
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },
  body: {
    color: "#334155",
    fontSize: 15,
    marginBottom: 8,
    lineHeight: 20,
  },
  note: {
    color: "#475569",
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  statusText: {
    color: "#0F172A",
    fontWeight: "600",
  },
  errorText: {
    color: "#B91C1C",
    marginBottom: 12,
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
    fontWeight: "700",
  },
});
