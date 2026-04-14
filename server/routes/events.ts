import { Router, Request, Response } from 'express';
import pool from '../db.js';
import { upsertIdentity } from '../identity.js';

const router = Router();

// POST / — ingest an event
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { event_name, device_id, user_id, timestamp, properties } = req.body as {
    event_name?: unknown;
    device_id?: unknown;
    user_id?: unknown;
    timestamp?: unknown;
    properties?: unknown;
  };

  if (!event_name || typeof event_name !== 'string') {
    res.status(400).json({ error: 'event_name is required' });
    return;
  }

  if (!device_id && !user_id) {
    res.status(400).json({ error: 'device_id or user_id is required' });
    return;
  }

  const resolvedTimestamp =
    typeof timestamp === 'string' ? timestamp : new Date().toISOString();
  const resolvedProperties =
    properties !== null && typeof properties === 'object' && !Array.isArray(properties)
      ? properties
      : {};
  const resolvedDeviceId = typeof device_id === 'string' ? device_id : null;
  const resolvedUserId = typeof user_id === 'string' ? user_id : null;

  const result = await pool.query<{
    id: string;
    event_name: string;
    device_id: string | null;
    user_id: string | null;
    timestamp: string;
    properties: Record<string, unknown>;
  }>(
    `INSERT INTO events (event_name, device_id, user_id, timestamp, properties)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, event_name, device_id, user_id, timestamp, properties`,
    [event_name, resolvedDeviceId, resolvedUserId, resolvedTimestamp, resolvedProperties],
  );

  const row = result.rows[0];

  // Identity resolution: both ids present → upsert mapping
  if (resolvedDeviceId && resolvedUserId) {
    await upsertIdentity(resolvedDeviceId, resolvedUserId);
  }

  res.status(201).json(row);
});

// GET /names — distinct event names
router.get('/names', async (_req: Request, res: Response): Promise<void> => {
  const result = await pool.query<{ event_name: string }>(
    `SELECT DISTINCT event_name FROM events ORDER BY event_name`,
  );
  res.json({ names: result.rows.map((r) => r.event_name) });
});

// GET /properties?event=<name> — property keys and their detected types
router.get('/properties', async (req: Request, res: Response): Promise<void> => {
  const eventName = req.query['event'];

  if (!eventName || typeof eventName !== 'string') {
    res.status(400).json({ error: 'event query parameter is required' });
    return;
  }

  const result = await pool.query<{ key: string; type: string }>(
    `SELECT DISTINCT key, jsonb_typeof(properties->key) AS type
     FROM events, jsonb_object_keys(properties) AS key
     WHERE event_name = $1
     LIMIT 100`,
    [eventName],
  );

  const properties = result.rows.map((r) => ({
    key: r.key,
    type: r.type === 'number' ? ('number' as const) : ('string' as const),
  }));

  res.json({ properties });
});

export default router;
