const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ---- Types ----

export interface ExploreEvent {
  id: string;
  event_name: string;
  distinct_id: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface TrendParams {
  event_name: string;
  from?: string;
  to?: string;
  interval?: 'day' | 'week' | 'month';
}

export interface FunnelStep {
  event_name: string;
}

export interface FunnelBody {
  steps: FunnelStep[];
  from?: string;
  to?: string;
}

export interface FunnelStepResult {
  event_name: string;
  count: number;
  conversion_rate: number;
}

export interface FunnelResult {
  steps: FunnelStepResult[];
}

export interface User {
  distinct_id: string;
  type: 'user' | 'device';
  first_seen: string;
  last_seen: string;
  event_count: number;
}

export interface UserProfile extends User {
  properties: Record<string, unknown>;
  recent_events: ExploreEvent[];
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
  return get<string[]>('/api/events/names');
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

export function fetchTrends(params: TrendParams): Promise<{ data: TrendPoint[] }> {
  const { event_name, from, to, interval } = params;
  return get<{ data: TrendPoint[] }>('/api/trends', { event_name, from, to, interval });
}

export function fetchFunnel(body: FunnelBody): Promise<FunnelResult> {
  return post<FunnelResult>('/api/funnel', body);
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
