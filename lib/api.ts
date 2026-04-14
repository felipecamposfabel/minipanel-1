const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ---- Types ----

export interface ExploreEvent {
  id: string;
  event_name: string;
  device_id: string | null;
  user_id: string | null;
  resolved_user_id: string | null;
  properties: Record<string, unknown>;
  timestamp: string;
}

export interface TrendPoint {
  period: string;
  value: number;
  breakdown?: string;
}

export interface TrendParams {
  event: string;
  start?: string;
  end?: string;
  granularity?: 'day' | 'week';
  measure?: 'count' | 'unique_users';
  aggregation?: 'sum' | 'avg' | 'min' | 'max';
  property?: string;
  breakdown?: string;
}

export interface TrendResponse {
  data: TrendPoint[];
  breakdown_values?: string[];
}

export interface FunnelBody {
  steps: string[];
  start: string;
  end: string;
}

export interface FunnelStepResult {
  name: string;
  count: number;
  conversion: number | null;
}

export interface FunnelResult {
  steps: FunnelStepResult[];
  overall_conversion: number;
}

export interface User {
  id: string;
  type: 'user' | 'device';
  devices: string[];
  first_seen: string;
  last_seen: string;
  event_count: number;
}

export interface ProfileEvent {
  id: string;
  event_name: string;
  timestamp: string;
  properties: Record<string, unknown>;
  device_id: string | null;
  user_id: string | null;
}

export interface UserProfile extends User {
  events: ProfileEvent[];
}

// ---- Helpers ----

type QueryParams = Record<string, string | number | undefined>;

function buildQuery(params: QueryParams): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  ) as [string, string | number][];
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

async function get<T>(path: string, params: QueryParams = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}${buildQuery(params)}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

// ---- API functions ----

export function fetchEventNames(): Promise<string[]> {
  return get<{ names: string[] }>('/api/events/names').then((r) => r.names);
}

export function fetchEventProperties(
  eventName: string,
): Promise<Array<{ key: string; type: 'string' | 'number' }>> {
  return get<Array<{ key: string; type: 'string' | 'number' }>>('/api/events/properties', {
    event_name: eventName,
  });
}

export function fetchExplore(params: {
  event_name?: string;
  page?: number;
  limit?: number;
}): Promise<{ events: ExploreEvent[]; total: number }> {
  return get<{ events: ExploreEvent[]; total: number }>('/api/explore', params);
}

export function fetchTrends(params: TrendParams): Promise<TrendResponse> {
  const { event, start, end, granularity, measure, aggregation, property, breakdown } = params;
  return get<TrendResponse>('/api/trends', {
    event,
    start,
    end,
    granularity,
    measure,
    aggregation,
    property,
    breakdown,
  });
}

export function fetchFunnel(body: FunnelBody): Promise<FunnelResult> {
  return post<FunnelResult>('/api/funnels', body);
}

export function fetchUsers(params: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ users: User[]; total: number }> {
  return get<{ users: User[]; total: number }>('/api/users', params);
}

export function fetchUser(id: string, type: 'user' | 'device'): Promise<UserProfile> {
  return get<UserProfile>(`/api/users/${encodeURIComponent(id)}`, { type });
}

export function seedData(): Promise<{ events: number; users: number; devices: number }> {
  return post<{ events: number; users: number; devices: number }>('/api/seed', {});
}
