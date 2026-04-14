import { Router, Request, Response } from 'express';
import pool from '../db.js';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad(n: number, width = 3): string {
  return String(n).padStart(width, '0');
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Weighted random pick. weights must sum > 0. */
function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i] as number;
    if (r <= 0) return items[i] as T;
  }
  return items[items.length - 1] as T;
}

const EVENT_TYPES = [
  'page_viewed',
  'button_clicked',
  'signup_started',
  'signup_completed',
  'subscription_renewed',
  'feature_used',
  'session_started',
  'checkout_started',
  'checkout_abandoned',
  'profile_updated',
] as const;

type EventType = (typeof EVENT_TYPES)[number];

const EVENT_WEIGHTS: number[] = [30, 15, 5, 4, 4, 10, 15, 8, 5, 4];

const PAGES = ['/dashboard', '/settings', '/billing', '/reports', '/users'] as const;
const BUTTONS = ['upgrade', 'cancel', 'save', 'export', 'invite'] as const;
const PLANS = ['starter', 'pro', 'enterprise'] as const;
const PLAN_AMOUNTS: Record<string, number> = { starter: 29, pro: 99, enterprise: 299 };
const FEATURES = ['charts', 'exports', 'api', 'webhooks', 'sso'] as const;

function buildProperties(eventType: EventType): Record<string, string | number> {
  switch (eventType) {
    case 'page_viewed':
      return { page: pick([...PAGES]), duration: randInt(5, 300) };
    case 'button_clicked':
      return { button: pick([...BUTTONS]), page: pick([...PAGES]) };
    case 'signup_started':
    case 'signup_completed':
    case 'subscription_renewed':
    case 'checkout_started':
    case 'checkout_abandoned': {
      const plan = pick([...PLANS]);
      return { plan, amount: PLAN_AMOUNTS[plan] as number };
    }
    case 'feature_used':
      return { feature: pick([...FEATURES]), duration: randInt(10, 600) };
    case 'session_started':
    case 'profile_updated':
    default:
      return {};
  }
}

/**
 * Generate a timestamp within a given day.
 * Business hours (9–18 UTC) are 3× more likely than other hours.
 */
function randomTimestampOnDay(dayOffsetFromNow: number): Date {
  const now = Date.now();
  const dayStart = now - dayOffsetFromNow * 86_400_000;
  // Strip to midnight UTC
  const d = new Date(dayStart);
  d.setUTCHours(0, 0, 0, 0);
  const midnight = d.getTime();

  // Build weighted hour distribution
  const hourWeights: number[] = [];
  for (let h = 0; h < 24; h++) {
    hourWeights.push(h >= 9 && h < 18 ? 3 : 1);
  }
  const hour = weightedPick(
    Array.from({ length: 24 }, (_, i) => i),
    hourWeights,
  );
  const minute = randInt(0, 59);
  const second = randInt(0, 59);
  return new Date(midnight + hour * 3_600_000 + minute * 60_000 + second * 1_000);
}

// ---------------------------------------------------------------------------
// User / device catalogue
// ---------------------------------------------------------------------------

interface UserRecord {
  userId: string;
  devices: string[]; // 1 or 2 device IDs
}

function buildCatalogue(): { identified: UserRecord[]; anonDevices: string[] } {
  const identified: UserRecord[] = [];

  // user_001..user_010 — 2 devices each
  for (let i = 1; i <= 10; i++) {
    const userId = `user_${pad(i)}`;
    identified.push({
      userId,
      devices: [`device_${userId}_a`, `device_${userId}_b`],
    });
  }

  // user_011..user_050 — 1 device each
  for (let i = 11; i <= 50; i++) {
    const userId = `user_${pad(i)}`;
    identified.push({ userId, devices: [`device_${userId}`] });
  }

  // device_anon_001..device_anon_020 — never identified
  const anonDevices: string[] = [];
  for (let i = 1; i <= 20; i++) {
    anonDevices.push(`device_anon_${pad(i)}`);
  }

  return { identified, anonDevices };
}

// ---------------------------------------------------------------------------
// Event row type
// ---------------------------------------------------------------------------

interface EventRow {
  event_name: string;
  device_id: string | null;
  user_id: string | null;
  timestamp: Date;
  properties: Record<string, string | number>;
}

// ---------------------------------------------------------------------------
// Event generation
// ---------------------------------------------------------------------------

function generateEvents(
  identified: UserRecord[],
  anonDevices: string[],
): { events: EventRow[]; identityRows: Array<{ deviceId: string; userId: string }> } {
  const events: EventRow[] = [];
  const identitySet = new Map<string, string>(); // device_id → user_id

  const now = new Date();

  // Power-user multipliers: first 10 users get 3× events, next 20 get 1.5×, rest 1×
  function eventsForUser(index: number): number {
    if (index < 10) return Math.round(randInt(180, 240) * 3); // ~180-240 base × 3
    if (index < 30) return Math.round(randInt(120, 180) * 1.5);
    return randInt(80, 140);
  }

  for (let idx = 0; idx < identified.length; idx++) {
    const user = identified[idx] as UserRecord;
    const count = eventsForUser(idx);

    for (let e = 0; e < count; e++) {
      // Non-uniform day distribution: recent days get more events (last 7 days = 50% of volume)
      let dayOffset: number;
      if (Math.random() < 0.5) {
        dayOffset = randInt(0, 6);
      } else {
        dayOffset = randInt(7, 29);
      }

      // Weekends get 40% of the weekday rate
      const ts = randomTimestampOnDay(dayOffset);
      const dow = ts.getUTCDay(); // 0=Sun, 6=Sat
      if ((dow === 0 || dow === 6) && Math.random() > 0.4) {
        // skip this event (weekday bias)
        continue;
      }

      const device_id = pick(user.devices);
      const eventType = weightedPick([...EVENT_TYPES], EVENT_WEIGHTS);
      const includeUserId = Math.random() < 0.7;

      const row: EventRow = {
        event_name: eventType,
        device_id,
        user_id: includeUserId ? user.userId : null,
        timestamp: ts,
        properties: buildProperties(eventType),
      };
      events.push(row);

      if (includeUserId) {
        identitySet.set(device_id, user.userId);
      }
    }
  }

  // Anonymous devices — device-only events
  for (const deviceId of anonDevices) {
    const count = randInt(20, 60);
    for (let e = 0; e < count; e++) {
      let dayOffset: number;
      if (Math.random() < 0.5) {
        dayOffset = randInt(0, 6);
      } else {
        dayOffset = randInt(7, 29);
      }
      const ts = randomTimestampOnDay(dayOffset);
      const dow = ts.getUTCDay();
      if ((dow === 0 || dow === 6) && Math.random() > 0.4) continue;

      const eventType = weightedPick([...EVENT_TYPES], EVENT_WEIGHTS);
      events.push({
        event_name: eventType,
        device_id: deviceId,
        user_id: null,
        timestamp: ts,
        properties: buildProperties(eventType),
      });
    }
  }

  // Sort events by timestamp ascending (realistic insertion order)
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Ensure we have at least 10,000 events; top up with identified user events if needed
  while (events.length < 10_000) {
    const user = pick(identified);
    const device_id = pick(user.devices);
    const dayOffset = randInt(0, 29);
    const ts = randomTimestampOnDay(dayOffset);
    const eventType = weightedPick([...EVENT_TYPES], EVENT_WEIGHTS);
    const includeUserId = Math.random() < 0.7;
    events.push({
      event_name: eventType,
      device_id,
      user_id: includeUserId ? user.userId : null,
      timestamp: ts,
      properties: buildProperties(eventType),
    });
    if (includeUserId) identitySet.set(device_id, user.userId);
  }

  // Re-sort after top-up
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const identityRows = Array.from(identitySet.entries()).map(([deviceId, userId]) => ({
    deviceId,
    userId,
  }));

  // Clamp to ~14,000 max to keep response fast, but never below 10,000
  const clamped = events.slice(0, 14_000);

  return { events: clamped, identityRows };
}

// ---------------------------------------------------------------------------
// Batch INSERT helpers
// ---------------------------------------------------------------------------

const BATCH_SIZE = 1000;

async function insertEventsBatch(batch: EventRow[]): Promise<void> {
  if (batch.length === 0) return;

  // Build multi-value INSERT: ($1,$2,$3,$4,$5), ($6,$7,$8,$9,$10), ...
  const values: Array<string | Date | Record<string, string | number> | null> = [];
  const placeholders: string[] = [];

  for (let i = 0; i < batch.length; i++) {
    const row = batch[i] as EventRow;
    const base = i * 5;
    placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
    values.push(row.event_name, row.device_id, row.user_id, row.timestamp, row.properties);
  }

  await pool.query(
    `INSERT INTO events (event_name, device_id, user_id, timestamp, properties) VALUES ${placeholders.join(', ')}`,
    values,
  );
}

async function insertIdentityBatch(
  rows: Array<{ deviceId: string; userId: string }>,
): Promise<void> {
  if (rows.length === 0) return;

  const values: string[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as { deviceId: string; userId: string };
    const base = i * 2;
    placeholders.push(`($${base + 1}, $${base + 2})`);
    values.push(row.deviceId, row.userId);
  }

  await pool.query(
    `INSERT INTO identity_map (device_id, user_id) VALUES ${placeholders.join(', ')}
     ON CONFLICT (device_id) DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = NOW()`,
    values,
  );
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

router.post('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Idempotent: wipe existing data first
    await pool.query('DELETE FROM events');
    await pool.query('DELETE FROM identity_map');

    const { identified, anonDevices } = buildCatalogue();
    const { events, identityRows } = generateEvents(identified, anonDevices);

    // Insert events in batches of BATCH_SIZE
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      await insertEventsBatch(events.slice(i, i + BATCH_SIZE));
    }

    // Insert identity map
    for (let i = 0; i < identityRows.length; i += BATCH_SIZE) {
      await insertIdentityBatch(identityRows.slice(i, i + BATCH_SIZE));
    }

    // Collect distinct device IDs that appear in events
    const deviceIdSet = new Set<string>();
    for (const e of events) {
      if (e.device_id) deviceIdSet.add(e.device_id);
    }

    res.status(200).json({
      events: events.length,
      users: identified.length,
      devices: deviceIdSet.size,
    });
  } catch (err) {
    console.error('[seed] error:', err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
