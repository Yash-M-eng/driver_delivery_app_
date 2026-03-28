import { Delivery } from "../types";

type Coordinate = { latitude: number; longitude: number };

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

type TravelMetrics = { distanceMeters: number; durationSeconds: number };

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const cacheKey = (from: Coordinate, to: Coordinate) =>
  `${round5(from.latitude)},${round5(from.longitude)}->${round5(to.latitude)},${round5(to.longitude)}`;

const travelCache = new Map<string, { value: TravelMetrics; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

const toRad = (value: number): number => (value * Math.PI) / 180;

const haversineDistanceKm = (from: Coordinate, to: Coordinate): number => {
  const earthRadiusKm = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const fallbackMetrics = (from: Coordinate, to: Coordinate): TravelMetrics => {
  const distanceKm = haversineDistanceKm(from, to);
  // Fallback approximation: city driving average.
  const durationSeconds = (distanceKm / 35) * 3600;
  return { distanceMeters: distanceKm * 1000, durationSeconds };
};

const getTravelMetricsBatch = async (from: Coordinate, destinations: Coordinate[]): Promise<TravelMetrics[]> => {
  // First, fill from cache when available.
  const now = Date.now();
  const results: Array<TravelMetrics | null> = destinations.map((to) => {
    const key = cacheKey(from, to);
    const cached = travelCache.get(key);
    return cached && cached.expiresAt > now ? cached.value : null;
  });

  const missingIdx = results
    .map((v, i) => (v ? -1 : i))
    .filter((i) => i !== -1) as number[];

  // If we don't have a key or everything is cached, return early.
  if (!GOOGLE_MAPS_API_KEY || missingIdx.length === 0) {
    return destinations.map((to, i) => results[i] ?? fallbackMetrics(from, to));
  }

  const origins = `${from.latitude},${from.longitude}`;
  const missingDestinations = missingIdx.map((i) => destinations[i]);
  const destinationsParam = missingDestinations.map((d) => `${d.latitude},${d.longitude}`).join("|");

  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}` +
    `&destinations=${encodeURIComponent(destinationsParam)}` +
    `&departure_time=now&traffic_model=best_guess&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await fetch(url);
    const payload = await response.json();
    const elements: any[] = payload?.rows?.[0]?.elements ?? [];

    missingIdx.forEach((originalIndex, j) => {
      const to = destinations[originalIndex];
      const element = elements[j];
      const value: TravelMetrics =
        element && element.status === "OK"
          ? {
              distanceMeters: element.distance?.value ?? 0,
              durationSeconds: element.duration_in_traffic?.value ?? element.duration?.value ?? 0,
            }
          : fallbackMetrics(from, to);

      results[originalIndex] = value;
      travelCache.set(cacheKey(from, to), { value, expiresAt: Date.now() + CACHE_TTL_MS });
    });
  } catch {
    missingIdx.forEach((originalIndex) => {
      const to = destinations[originalIndex];
      const value = fallbackMetrics(from, to);
      results[originalIndex] = value;
      travelCache.set(cacheKey(from, to), { value, expiresAt: Date.now() + CACHE_TTL_MS });
    });
  }

  return results.map((v, i) => v ?? fallbackMetrics(from, destinations[i]));
};

export const getTravelMetricsForDestination = async (
  from: Coordinate,
  to: Coordinate,
): Promise<TravelMetrics> => {
  const [metrics] = await getTravelMetricsBatch(from, [to]);
  return metrics;
};

export const optimizeRoute = async (origin: Coordinate, pendingDeliveries: Delivery[]): Promise<Delivery[]> => {
  const remaining = [...pendingDeliveries];
  const optimized: Delivery[] = [];
  let currentPoint = origin;

  while (remaining.length > 0) {
    const destinations = remaining.map((delivery) => ({ latitude: delivery.latitude, longitude: delivery.longitude }));
    const metricsBatch = await getTravelMetricsBatch(currentPoint, destinations);
    const metrics = remaining.map((delivery, idx) => ({ delivery, ...metricsBatch[idx] }));

    metrics.sort((a, b) => {
      // Travel time is prioritized over pure distance for route ranking.
      const weightedA = a.durationSeconds * 0.8 + a.distanceMeters * 0.2;
      const weightedB = b.durationSeconds * 0.8 + b.distanceMeters * 0.2;
      return weightedA - weightedB;
    });

    const nextStop = metrics[0].delivery;
    optimized.push(nextStop);
    currentPoint = { latitude: nextStop.latitude, longitude: nextStop.longitude };

    const index = remaining.findIndex((entry) => entry.id === nextStop.id);
    remaining.splice(index, 1);
  }

  return optimized;
};
