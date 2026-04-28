export interface Location {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

export interface Client {
  id: string;
  name: string;
  location: Location;
  jobDurationMinutes: number;
  staffCount: number;       // 1, 2, 3+ — per-job staff assignment
  isLocked: boolean;        // exclude from route optimisation
  startTime?: string;       // "09:00" format
  endTime?: string;         // "10:30" format
  fixedStartTime?: string;  // locked start time (e.g. "09:00") — schedule recalculates around this
  notes?: string;
  savedClientId?: string;   // reference to saved client in DB
}

export interface TravelSegment {
  fromId: string; // 'base' or client id
  toId: string;   // client id or 'base-return'
  durationMinutes: number;
  distanceKm: number;
  durationText: string;
  distanceText: string;
  isCalculating: boolean;
}

export interface ScheduleBreak {
  id: string;
  afterClientId: string; // insert break after this client
  durationMinutes: number;
  label: string; // e.g. "Lunch"
}

export interface TeamSchedule {
  id: string;
  name: string;
  color: TeamColor;
  baseAddress: Location | null;
  clients: Client[];
  travelSegments: Map<string, TravelSegment>; // key: `${fromId}->${toId}`
  dayStartTime: string; // "09:00"
  breaks: ScheduleBreak[];
  hourlyRate: number;
  fuelEfficiency: number; // L/100km
  fuelPrice: number;      // $/L
  perKmRate: number;      // $/km allowance
}

export interface TeamColor {
  name: string;
  primary: string;    // e.g. "#4F46E5"
  light: string;      // e.g. "#EEF2FF"
  border: string;     // e.g. "#C7D2FE"
  text: string;       // e.g. "#3730A3"
  marker: string;     // for map markers
}

export interface DaySummary {
  totalJobMinutes: number;
  totalTravelMinutes: number;
  totalDistanceKm: number;
  totalWorkMinutes: number; // job + travel + breaks
  wageAmount: number;
  fuelCost: number;
  perKmCost: number;
  clientCount: number;
}

export const TEAM_COLORS: TeamColor[] = [
  {
    name: 'Indigo',
    primary: '#4F46E5',
    light: '#EEF2FF',
    border: '#C7D2FE',
    text: '#3730A3',
    marker: '#4F46E5',
  },
  {
    name: 'Emerald',
    primary: '#059669',
    light: '#ECFDF5',
    border: '#A7F3D0',
    text: '#065F46',
    marker: '#059669',
  },
  {
    name: 'Amber',
    primary: '#D97706',
    light: '#FFFBEB',
    border: '#FDE68A',
    text: '#92400E',
    marker: '#D97706',
  },
  {
    name: 'Rose',
    primary: '#E11D48',
    light: '#FFF1F2',
    border: '#FECDD3',
    text: '#9F1239',
    marker: '#E11D48',
  },
  {
    name: 'Cyan',
    primary: '#0891B2',
    light: '#ECFEFF',
    border: '#A5F3FC',
    text: '#155E75',
    marker: '#0891B2',
  },
];

export type ScheduleAction =
  | { type: 'SET_ACTIVE_TEAM'; teamId: string }
  | { type: 'SET_BASE_ADDRESS'; teamId: string; location: Location }
  | { type: 'ADD_CLIENT'; teamId: string; client: Client }
  | { type: 'REMOVE_CLIENT'; teamId: string; clientId: string }
  | { type: 'UPDATE_CLIENT'; teamId: string; clientId: string; updates: Partial<Client> }
  | { type: 'REORDER_CLIENTS'; teamId: string; fromIndex: number; toIndex: number }
  | { type: 'SET_START_TIME'; teamId: string; time: string }
  | { type: 'SET_HOURLY_RATE'; teamId: string; rate: number }
  | { type: 'SET_FUEL_SETTINGS'; teamId: string; fuelEfficiency: number; fuelPrice: number }
  | { type: 'SET_PER_KM_RATE'; teamId: string; rate: number }
  | { type: 'ADD_TEAM' }
  | { type: 'REMOVE_TEAM'; teamId: string }
  | { type: 'UPDATE_TRAVEL'; teamId: string; segment: TravelSegment }
  | { type: 'ADD_BREAK'; teamId: string; afterClientId: string; breakItem: ScheduleBreak }
  | { type: 'REMOVE_BREAK'; teamId: string; breakId: string }
  | { type: 'CLEAR_TRAVEL'; teamId: string }
  | { type: 'SET_CLIENT_TIMES'; teamId: string; clients: Client[] }
  | { type: 'SET_CLIENTS_ORDER'; teamId: string; clients: Client[] }
  | { type: 'SET_FIXED_START_TIME'; teamId: string; clientId: string; time: string | undefined }
  | { type: 'LOAD_STATE'; teams: TeamSchedule[]; activeTeamId: string; selectedDate: string };

export interface AppState {
  teams: TeamSchedule[];
  activeTeamId: string;
  selectedDate: string; // ISO date string
}
