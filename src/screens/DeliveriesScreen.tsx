import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";
import { supabase } from "../services/supabase";
import { getTravelMetricsForDestination } from "../services/routeOptimization";
import { DeliveriesScreenProps, Delivery } from "../types";

type Coordinate = { latitude: number; longitude: number };

export default function DeliveriesScreen({ navigation }: DeliveriesScreenProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<Coordinate | null>(null);

  const pendingDeliveries = useMemo(
    () => deliveries.filter((delivery) => delivery.status !== "delivered"),
    [deliveries],
  );

  const fetchDeliveries = async (currentDriverId: string, showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .eq("driver_id", currentDriverId)
      .order("created_at", { ascending: false });
      console.log("data", data);
    if (!error && data) {
      setDeliveries(data as Delivery[]);
    }
    if (showLoader) {
      setLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setDriverId(user.id);
      await fetchDeliveries(user.id, true);
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    const initLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        return;
      }
      const current = await Location.getCurrentPositionAsync({});
      setDriverLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    };
    void initLocation();
  }, []);

  const onPressDelivery = async (delivery: Delivery) => {
    if (delivery.status !== "pending") {
      return;
    }
    if (!driverLocation) {
      return;
    }

    const metrics = await getTravelMetricsForDestination(driverLocation, {
      latitude: delivery.latitude,
      longitude: delivery.longitude,
    });

    const km = (metrics.distanceMeters / 1000).toFixed(2);
    const mins = Math.max(1, Math.round(metrics.durationSeconds / 60));
    alert(`Order #${delivery.order_id}\nDistance: ${km} km\nETA (traffic-aware): ${mins} min`);
  };

  useEffect(() => {
    if (!driverId) {
      return;
    }

    const channel = supabase
      .channel(`deliveries-driver-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliveries",
          filter: `driver_id=eq.${driverId}`,
        },
        async () => {
          await fetchDeliveries(driverId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [driverId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              if (!driverId) {
                return;
              }
              setRefreshing(true);
              await fetchDeliveries(driverId);
              setRefreshing(false);
            }}
          />
        }
        contentContainerStyle={{ paddingBottom: 90 }}
        ListEmptyComponent={<Text style={styles.empty}>No deliveries assigned yet.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => void onPressDelivery(item)}>
            <Text style={styles.orderId}>Order #{item.order_id}</Text>
            <Text style={styles.name}>{item.customer_name}</Text>
            <Text style={styles.address}>{item.address}</Text>
            <Text style={styles.status}>Status: {item.status}</Text>
          </Pressable>
        )}
      />

      <Pressable
        style={styles.routeButton}
        onPress={() => navigation.navigate("OptimizedRoute", { deliveries: pendingDeliveries })}
      >
        <Text style={styles.routeButtonText}>Open Optimized Route</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  empty: {
    textAlign: "center",
    marginTop: 32,
    color: "#475569",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  orderId: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  name: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  address: {
    marginTop: 4,
    color: "#334155",
  },
  status: {
    marginTop: 8,
    color: "#475569",
    textTransform: "capitalize",
  },
  routeButton: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    backgroundColor: "#0EA5E9",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  routeButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
});
