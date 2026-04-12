import { Client, TeamSchedule, TravelSegment, DaySummary } from './types';
import { parseTime, minutesToTime, addMinutesToTime } from './timeUtils';

/**
 * Calculate travel between two points using Google Maps DirectionsService
 */
export async function calculateTravel(
  directionsService: google.maps.DirectionsService,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ durationMinutes: number; distanceKm: number; durationText: string; distanceText: string } | null> {
  return new Promise((resolve) => {
    directionsService.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          const leg = result.routes[0]?.legs[0];
          if (leg) {
            resolve({
              durationMinutes: Math.ceil((leg.duration?.value || 0) / 60),
              distanceKm: parseFloat(((leg.distance?.value || 0) / 1000).toFixed(1)),
              durationText: leg.duration?.text || '',
              distanceText: leg.distance?.text || '',
            });
            return;
          }
        }
        resolve(null);
      }
    );
  });
}

/**
 * Calculate all travel segments for a team's schedule
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

  // Calculate each leg sequentially to avoid rate limits
  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];

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
      { lat: to.lat, lng: to.lng }
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
    }

    // Small delay between requests to avoid rate limiting
    if (i < stops.length - 2) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

/**
 * Calculate client start/end times based on travel segments and breaks
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

    const startTime = minutesToTime(currentTime);
    currentTime += client.jobDurationMinutes;
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

  const totalWorkMinutes = totalJobMinutes + totalTravelMinutes + totalBreakMinutes;

  return {
    totalJobMinutes,
    totalTravelMinutes,
    totalDistanceKm,
    totalWorkMinutes,
    wageAmount: (totalWorkMinutes / 60) * team.hourlyRate,
    fuelCost: (totalDistanceKm / 100) * team.fuelEfficiency * team.fuelPrice,
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
 * Export schedule as CSV
 */
export function exportScheduleCSV(team: TeamSchedule, summary: DaySummary): string {
  const headers = ['Stop', 'Client', 'Address', 'Start', 'End', 'Duration', 'Travel To (min)', 'Distance To (km)'];
  const rows: string[][] = [];

  rows.push(['0', 'Base', team.baseAddress?.address || '', team.dayStartTime, '', '', '', '']);

  team.clients.forEach((client, i) => {
    const prevId = i === 0 ? 'base' : team.clients[i - 1].id;
    const segKey = `${prevId}->${client.id}`;
    const seg = team.travelSegments.get(segKey);

    rows.push([
      String(i + 1),
      client.name,
      client.location.address,
      client.startTime || '',
      client.endTime || '',
      `${client.jobDurationMinutes} min`,
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
      '',
      '',
      returnSeg ? String(returnSeg.durationMinutes) : '',
      returnSeg ? String(returnSeg.distanceKm) : '',
    ]);
  }

  // Summary row
  rows.push([]);
  rows.push(['Summary']);
  rows.push(['Total Clients', String(summary.clientCount)]);
  rows.push(['Total Job Time', `${summary.totalJobMinutes} min`]);
  rows.push(['Total Travel Time', `${summary.totalTravelMinutes} min`]);
  rows.push(['Total Distance', `${summary.totalDistanceKm.toFixed(1)} km`]);
  rows.push(['Total Work Time', `${summary.totalWorkMinutes} min`]);
  rows.push(['Wage ($${team.hourlyRate}/hr)', `$${summary.wageAmount.toFixed(2)}`]);

  const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
  return csvContent;
}
