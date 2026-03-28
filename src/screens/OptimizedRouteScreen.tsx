import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { optimizeRoute } from "../services/routeOptimization";
import { supabase } from "../services/supabase";
import { Delivery, OptimizedRouteScreenProps } from "../types";

type Coordinate = { latitude: number; longitude: number };
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function OptimizedRouteScreen({ route }: OptimizedRouteScreenProps) {
  const mapRef = useRef<MapView | null>(null);
  const [driverLocation, setDriverLocation] = useState<Coordinate | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [remainingStops, setRemainingStops] = useState<Delivery[]>(route.params.deliveries ?? []);
  const [optimizedStops, setOptimizedStops] = useState<Delivery[]>([]);
  const [selectedStop, setSelectedStop] = useState<Delivery | null>(null);
  const [directionsAvailable, setDirectionsAvailable] = useState(true);

  const fetchStops = async (currentDriverId: string) => {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .eq("driver_id", currentDriverId)
      .neq("status", "delivered")
      .order("created_at", { ascending: false });

    if (error) {
      Alert.alert("Unable to load stops", error.message);
    }
    if (!error && data) {
      setRemainingStops(data as Delivery[]);
    }
  };

  const mapRegion = useMemo(() => {
    const firstStop = remainingStops[0];
    const latitude = driverLocation?.latitude ?? firstStop?.latitude ?? 37.78825;
    const longitude = driverLocation?.longitude ?? firstStop?.longitude ?? -122.4324;

    return {
      latitude,
      longitude,
      latitudeDelta: 0.2,
      longitudeDelta: 0.2,
    };
  }, [driverLocation, remainingStops]);

  const recomputeRoute = useCallback(async () => {
    if (!driverLocation) {
      return;
    }
    const pending = remainingStops.filter((item) => item.status !== "delivered");
    const optimized = await optimizeRoute(driverLocation, pending);
    setOptimizedStops(optimized);
  }, [driverLocation, remainingStops]);

  useEffect(() => {
    const init = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location denied", "Location access is required to optimize routes.");
        return;
      }
      const current = await Location.getCurrentPositionAsync({});
      setDriverLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 25,
          timeInterval: 15000,
        },
        (pos) => {
          setDriverLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
      );

      return () => {
        sub.remove();
      };
    };
    let cleanup: undefined | (() => void);
    void init().then((fn) => {
      cleanup = fn;
    });
    return () => {
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      setDriverId(user.id);
      await fetchStops(user.id);
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!driverId) {
      return;
    }

    const channel = supabase
      .channel(`deliveries-optimized-route-${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliveries",
          filter: `driver_id=eq.${driverId}`,
        },
        async () => {
          await fetchStops(driverId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [driverId]);

  useEffect(() => {
    void recomputeRoute();
  }, [recomputeRoute]);

  useEffect(() => {
    const coords = [
      ...(driverLocation ? [driverLocation] : []),
      ...optimizedStops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
    ];

    if (coords.length < 2) {
      return;
    }

    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  }, [driverLocation, optimizedStops]);

  const markDelivered = async (deliveryId: string) => {
    const { error } = await supabase.from("deliveries").update({ status: "delivered" }).eq("id", deliveryId);
    if (error) {
      Alert.alert("Unable to update delivery", error.message);
      return;
    }

    // Optimistically remove it; realtime + refetch will keep us in sync.
    setRemainingStops((prev) => prev.filter((stop) => stop.id !== deliveryId));
  };

  const handleStopPress = async (stop: Delivery) => {
    let currentLocation = driverLocation;
    if (!currentLocation) {
      try {
        const current = await Location.getCurrentPositionAsync({});
        currentLocation = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        setDriverLocation(currentLocation);
      } catch {
        // If location can't be fetched now, avoid interrupting with alert.
        return;
      }
    }
    setDirectionsAvailable(true);
    setSelectedStop(stop);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        showsUserLocation
      >
        {optimizedStops.map((stop, index) => (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            title={stop.address}
            description={`Stop ${index + 1} • Order ${stop.order_id} • ${stop.customer_name}`}
          />
        ))}
        {driverLocation && selectedStop && GOOGLE_MAPS_API_KEY && directionsAvailable ? (
          <MapViewDirections
            origin={driverLocation}
            destination={{ latitude: selectedStop.latitude, longitude: selectedStop.longitude }}
            apikey={GOOGLE_MAPS_API_KEY}
            strokeWidth={5}
            strokeColor="#2563EB"
            mode="DRIVING"
            optimizeWaypoints
            timePrecision="now"
            onReady={(result) => {
              mapRef.current?.fitToCoordinates(result.coordinates, {
                edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
                animated: true,
              });
            }}
            onError={() => {
              // Common in dev when Google Directions billing is not enabled.
              setDirectionsAvailable(false);
            }}
          />
        ) : null}
        {driverLocation && selectedStop && !directionsAvailable ? (
          <Polyline
            coordinates={[
              { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
              { latitude: selectedStop.latitude, longitude: selectedStop.longitude },
            ]}
            strokeWidth={5}
            strokeColor="#2563EB"
            lineDashPattern={[10, 8]}
          />
        ) : null}
      </MapView>

      <View style={styles.listWrapper}>
        <Text style={styles.heading}>Optimized Stops</Text>
        {!directionsAvailable ? (
          <Text style={styles.routeNotice}>
            Live turn-by-turn route unavailable (Google billing not enabled). Showing straight-line fallback.
          </Text>
        ) : null}
        <FlatList
          data={optimizedStops}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>No pending stops.</Text>}
          renderItem={({ item, index }) => (
            <TouchableOpacity style={styles.stopCard} onPress={() => void handleStopPress(item)}>
              <Text style={styles.stopTitle}>
                #{index + 1} - Order {item.order_id}
              </Text>
              <Text style={styles.stopSubtitle}>{item.customer_name}</Text>
              <Text style={styles.stopAddress}>{item.address}</Text>
              <Pressable
                style={styles.deliveredButton}
                onPress={(event) => {
                  event.stopPropagation();
                  void markDelivered(item.id);
                }}
              >
                <Text style={styles.deliveredText}>Mark as Delivered</Text>
              </Pressable>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  map: { height: "45%", width: "100%" },
  listWrapper: { flex: 1, padding: 12 },
  heading: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    color: "#0F172A",
  },
  empty: {
    marginTop: 24,
    textAlign: "center",
    color: "#475569",
  },
  stopCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  stopTitle: {
    fontWeight: "700",
    color: "#0F172A",
  },
  stopSubtitle: {
    marginTop: 4,
    color: "#1E293B",
  },
  stopAddress: {
    marginTop: 4,
    color: "#334155",
  },
  deliveredButton: {
    marginTop: 10,
    backgroundColor: "#16A34A",
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 8,
  },
  deliveredText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  routeNotice: {
    marginBottom: 8,
    color: "#B45309",
    fontSize: 12,
  },
});
