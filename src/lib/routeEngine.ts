import { Client, TeamSchedule, TravelSegment, DaySummary } from './types';
import { parseTime, minutesToTime } from './timeUtils';
import { routeCache } from './routeCache';

/**
 * Calculate travel between two points using Google Maps DirectionsService.
 * Optionally accepts a departureTime for traffic-aware estimates.
 */
export async function calculateTravel(
  directionsService: google.maps.DirectionsService,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  departureTime?: Date
): Promise<{ durationMinutes: number; distanceKm: number; durationText: string; distanceText: string } | null> {
  // Check cache first
  const cacheKey = `${origin.lat},${origin.lng}->${destination.lat},${destination.lng}`;
  const cached = routeCache.get(cacheKey);
  if (cached) return cached;

  return new Promise((resolve) => {
    const request: google.maps.DirectionsRequest = {
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      ...(departureTime ? { drivingOptions: { departureTime, trafficModel: google.maps.TrafficModel.BEST_GUESS } } : {}),
    };

    directionsService.route(request, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK && result) {
        const leg = result.routes[0]?.legs[0];
        if (leg) {
          // Use duration_in_traffic if available (traffic-aware), otherwise standard duration
          const durationSeconds = leg.duration_in_traffic?.value || leg.duration?.value || 0;
          const travelResult = {
            durationMinutes: Math.ceil(durationSeconds / 60),
            distanceKm: parseFloat(((leg.distance?.value || 0) / 1000).toFixed(1)),
            durationText: leg.duration_in_traffic?.text || leg.duration?.text || '',
            distanceText: leg.distance?.text || '',
          };
          // Store in cache
          routeCache.set(cacheKey, travelResult);
          resolve(travelResult);
          return;
        }
      }
      resolve(null);
    });
  });
}

/**
 * Calculate all travel segments for a team's schedule.
 * Uses the team's dayStartTime + calculated schedule to pass departure times
 * for traffic-aware estimates.
 */
export async function calculateAllTravel(
  directionsService: google.maps.DirectionsService,
  team: TeamSchedule,
  onUpdate: (segment: TravelSegment) => void
): Promise<void> {
  if (!team.baseAddress || team.clients.length === 0) return;

  const stops: { id: string; lat: number; lng: number }[] = [
    { id: 'base', lat: team.baseAddress.lat, lng: team.baseAddress.lng },
    ...team.clients.map((c) => ({
      id: c.id,
      lat: c.location.lat,
      lng: c.location.lng,
    })),
    { id: 'base-return', lat: team.baseAddress.lat, lng: team.baseAddress.lng },
  ];

  // Build departure times for traffic-aware routing
  const today = new Date();
  const [startH, startM] = team.dayStartTime.split(':').map(Number);
  let currentMinutes = startH * 60 + startM;

  // Calculate each leg sequentially to avoid rate limits
  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];

    // Build departure time for this leg
    const departureTime = new Date(today);
    departureTime.setHours(Math.floor(currentMinutes / 60) % 24, currentMinutes % 60, 0, 0);

    // Send calculating state
    onUpdate({
      fromId: from.id,
      toId: to.id,
      durationMinutes: 0,
      distanceKm: 0,
      durationText: '',
      distanceText: '',
      isCalculating: true,
    });

    const result = await calculateTravel(
      directionsService,
      { lat: from.lat, lng: from.lng },
      { lat: to.lat, lng: to.lng },
      departureTime
    );

    if (result) {
      onUpdate({
        fromId: from.id,
        toId: to.id,
        durationMinutes: result.durationMinutes,
        distanceKm: result.distanceKm,
        durationText: result.durationText,
        distanceText: result.distanceText,
        isCalculating: false,
      });

      // Advance current time by travel + job duration (for next leg's departure time)
      currentMinutes += result.durationMinutes;
      // If this stop is a client (not base-return), add job duration
      if (i < team.clients.length) {
        const client = team.clients[i];
        const effectiveDuration = client.jobDurationMinutes / (client.staffCount || 1);
        currentMinutes += effectiveDuration;
      }
    }

    // Small delay between requests to avoid rate limiting
    if (i < stops.length - 2) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

/**
 * Calculate client start/end times based on travel segments and breaks.
 * Staff count affects the schedule: job duration is split by staff count
 * for timeline purposes (e.g. 4.5h with 3 staff = 1.5h on the timeline).
 *
 * Respects fixedStartTime: when a client has a locked start time, the
 * schedule jumps to that time and subsequent clients recalculate from there.
 */
export function calculateScheduleTimes(
  team: TeamSchedule
): Client[] {
  if (!team.baseAddress || team.clients.length === 0) return team.clients;

  let currentTime = parseTime(team.dayStartTime);
  const updatedClients: Client[] = [];

  for (let i = 0; i < team.clients.length; i++) {
    const client = team.clients[i];
    const prevId = i === 0 ? 'base' : team.clients[i - 1].id;
    const segmentKey = `${prevId}->${client.id}`;
    const segment = team.travelSegments.get(segmentKey);

    // Add travel time
    if (segment && !segment.isCalculating) {
      currentTime += segment.durationMinutes;
    }

    // Check for breaks before this client
    if (i > 0) {
      const breakAfterPrev = team.breaks.find(
        (b) => b.afterClientId === team.clients[i - 1].id
      );
      if (breakAfterPrev) {
        currentTime += breakAfterPrev.durationMinutes;
      }
    }

    // If this client has a fixed start time, use it instead of the calculated time
    let startTime: string;
    if (client.fixedStartTime) {
      const fixedMinutes = parseTime(client.fixedStartTime);
      startTime = client.fixedStartTime;
      currentTime = fixedMinutes; // Reset the timeline to the fixed time
    } else {
      startTime = minutesToTime(currentTime);
    }

    // Duration on the timeline = total duration / staff count
    const effectiveDuration = client.jobDurationMinutes / (client.staffCount || 1);
    currentTime += effectiveDuration;
    const endTime = minutesToTime(currentTime);

    updatedClients.push({
      ...client,
      startTime,
      endTime,
    });
  }

  return updatedClients;
}

/**
 * Calculate daily summary for a team
 */
export function calculateDaySummary(team: TeamSchedule): DaySummary {
  let totalTravelMinutes = 0;
  let totalDistanceKm = 0;

  team.travelSegments.forEach((segment) => {
    if (!segment.isCalculating) {
      totalTravelMinutes += segment.durationMinutes;
      totalDistanceKm += segment.distanceKm;
    }
  });

  const totalJobMinutes = team.clients.reduce(
    (sum, c) => sum + c.jobDurationMinutes,
    0
  );

  const totalBreakMinutes = team.breaks.reduce(
    (sum, b) => sum + b.durationMinutes,
    0
  );

  // Effective work minutes (job time split by staff count for each job)
  const effectiveJobMinutes = team.clients.reduce(
    (sum, c) => sum + c.jobDurationMinutes / (c.staffCount || 1),
    0
  );

  const totalWorkMinutes = effectiveJobMinutes + totalTravelMinutes + totalBreakMinutes;

  return {
    totalJobMinutes,
    totalTravelMinutes,
    totalDistanceKm,
    totalWorkMinutes,
    wageAmount: (totalWorkMinutes / 60) * team.hourlyRate,
    fuelCost: (totalDistanceKm / 100) * team.fuelEfficiency * team.fuelPrice,
    perKmCost: totalDistanceKm * team.perKmRate,
    clientCount: team.clients.length,
  };
}

/**
 * Get waypoints for rendering directions on the map
 */
export function getRouteWaypoints(
  team: TeamSchedule
): { origin: google.maps.LatLngLiteral; destination: google.maps.LatLngLiteral; waypoints: google.maps.DirectionsWaypoint[] } | null {
  if (!team.baseAddress || team.clients.length === 0) return null;

  const origin = { lat: team.baseAddress.lat, lng: team.baseAddress.lng };
  const destination = { lat: team.baseAddress.lat, lng: team.baseAddress.lng };

  const waypoints: google.maps.DirectionsWaypoint[] = team.clients.map((c) => ({
    location: { lat: c.location.lat, lng: c.location.lng },
    stopover: true,
  }));

  return { origin, destination, waypoints };
}

/**
 * Export schedule as CSV — includes staff count and per-km allowance
 */
export function exportScheduleCSV(team: TeamSchedule, summary: DaySummary): string {
  const headers = ['Stop', 'Client', 'Address', 'Start', 'End', 'Duration', 'Staff', 'Effective Duration', 'Travel To (min)', 'Distance To (km)'];
  const rows: string[][] = [];

  rows.push(['0', 'Base', team.baseAddress?.address || '', team.dayStartTime, '', '', '', '', '', '']);

  team.clients.forEach((client, i) => {
    const prevId = i === 0 ? 'base' : team.clients[i - 1].id;
    const segKey = `${prevId}->${client.id}`;
    const seg = team.travelSegments.get(segKey);
    const effective = client.jobDurationMinutes / (client.staffCount || 1);

    rows.push([
      String(i + 1),
      client.name,
      client.location.address,
      client.startTime || '',
      client.endTime || '',
      `${client.jobDurationMinutes} min`,
      String(client.staffCount || 1),
      `${effective.toFixed(0)} min`,
      seg ? String(seg.durationMinutes) : '',
      seg ? String(seg.distanceKm) : '',
    ]);
  });

  // Return to base segment
  if (team.clients.length > 0) {
    const lastClient = team.clients[team.clients.length - 1];
    const returnKey = `${lastClient.id}->base-return`;
    const returnSeg = team.travelSegments.get(returnKey);
    rows.push([
      String(team.clients.length + 1),
      'Return to Base',
      team.baseAddress?.address || '',
      lastClient.endTime || '',
      '', '', '', '',
      returnSeg ? String(returnSeg.durationMinutes) : '',
      returnSeg ? String(returnSeg.distanceKm) : '',
    ]);
  }

  // Summary
  rows.push([]);
  rows.push(['Summary']);
  rows.push(['Total Clients', String(summary.clientCount)]);
  rows.push(['Total Job Time', `${summary.totalJobMinutes} min`]);
  rows.push(['Total Travel Time', `${summary.totalTravelMinutes} min`]);
  rows.push(['Total Distance', `${summary.totalDistanceKm.toFixed(1)} km`]);
  rows.push(['Total Work Time', `${summary.totalWorkMinutes.toFixed(0)} min`]);
  rows.push(['Total Work Hours (decimal)', `${(summary.totalWorkMinutes / 60).toFixed(2)} hours`]);
  rows.push([`Wage ($${team.hourlyRate}/hr)`, `$${summary.wageAmount.toFixed(2)}`]);
  rows.push(['Fuel Cost', `$${summary.fuelCost.toFixed(2)}`]);
  if (team.perKmRate > 0) {
    rows.push([`Per-KM Allowance ($${team.perKmRate}/km)`, `$${summary.perKmCost.toFixed(2)}`]);
  }

  const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
  return csvContent;
}
