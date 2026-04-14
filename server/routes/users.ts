import { Router, Request, Response } from 'express';
import pool from '../db.js';

const router = Router();

interface UserRow {
  id: string;
  type: 'user' | 'device';
  devices: string[];
  first_seen: string | null;
  last_seen: string | null;
  event_count: string;
}

interface CountRow {
  count: string;
}

interface EventRow {
  id: string;
  event_name: string;
  timestamp: string;
  properties: Record<string, unknown>;
  device_id: string | null;
  user_id: string | null;
}

// GET /api/users?search=&page=1&limit=50
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const search =
    typeof req.query['search'] === 'string' && req.query['search'] !== ''
      ? req.query['search']
      : null;

  const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
  const limit = Math.min(
    200,
    Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10) || 50),
  );
  const offset = (page - 1) * limit;

  // Two-step approach: get identified users then device-only users
  const [usersResult, countResult] = await Promise.all([
    pool.query<UserRow>(
      `WITH resolved_users AS (
        -- Identified users (from identity_map)
        SELECT
          user_id AS id,
          'user'::text AS type,
          array_agg(DISTINCT device_id) AS devices
        FROM identity_map
        GROUP BY user_id
        UNION ALL
        -- Never-identified: devices with no entry in identity_map and no user_id in events
        SELECT
          e.device_id AS id,
          'device'::text AS type,
          ARRAY[e.device_id] AS devices
        FROM events e
        WHERE e.device_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM identity_map im WHERE im.device_id = e.device_id)
          AND e.user_id IS NULL
        GROUP BY e.device_id
      )
      SELECT
        u.id,
        u.type,
        u.devices,
        MIN(e.timestamp) AS first_seen,
        MAX(e.timestamp) AS last_seen,
        COUNT(e.id) AS event_count
      FROM resolved_users u
      LEFT JOIN events e ON (
        (u.type = 'user' AND (e.user_id = u.id OR e.device_id = ANY(u.devices)))
        OR (u.type = 'device' AND e.device_id = u.id)
      )
      WHERE ($1::text IS NULL OR u.id ILIKE '%' || $1 || '%')
      GROUP BY u.id, u.type, u.devices
      ORDER BY last_seen DESC NULLS LAST
      LIMIT $2 OFFSET $3`,
      [search, limit, offset],
    ),
    pool.query<CountRow>(
      `WITH resolved_users AS (
        SELECT user_id AS id FROM identity_map GROUP BY user_id
        UNION ALL
        SELECT e.device_id AS id
        FROM events e
        WHERE e.device_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM identity_map im WHERE im.device_id = e.device_id)
          AND e.user_id IS NULL
        GROUP BY e.device_id
      )
      SELECT COUNT(*) FROM resolved_users
      WHERE ($1::text IS NULL OR id ILIKE '%' || $1 || '%')`,
      [search],
    ),
  ]);

  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

  res.json({
    users: usersResult.rows.map((row) => ({
      id: row.id,
      type: row.type,
      devices: row.devices,
      first_seen: row.first_seen,
      last_seen: row.last_seen,
      event_count: parseInt(row.event_count, 10),
    })),
    total,
  });
});

// GET /api/users/:id?type=user|device
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = req.params['id'];
  const type = req.query['type'] === 'device' ? 'device' : 'user';

  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  let devices: string[] = [];

  if (type === 'user') {
    // Get all linked device_ids from identity_map
    const identityResult = await pool.query<{ device_id: string }>(
      `SELECT device_id FROM identity_map WHERE user_id = $1`,
      [id],
    );
    devices = identityResult.rows.map((r) => r.device_id);
  } else {
    devices = [id];
  }

  // Fetch stats and events in parallel
  const statsQuery =
    type === 'user'
      ? pool.query<{ first_seen: string | null; last_seen: string | null; event_count: string }>(
          `SELECT
            MIN(timestamp) AS first_seen,
            MAX(timestamp) AS last_seen,
            COUNT(id) AS event_count
           FROM events
           WHERE user_id = $1 OR device_id = ANY($2::text[])`,
          [id, devices],
        )
      : pool.query<{ first_seen: string | null; last_seen: string | null; event_count: string }>(
          `SELECT
            MIN(timestamp) AS first_seen,
            MAX(timestamp) AS last_seen,
            COUNT(id) AS event_count
           FROM events
           WHERE device_id = $1`,
          [id],
        );

  const eventsQuery =
    type === 'user'
      ? pool.query<EventRow>(
          `SELECT id, event_name, timestamp, properties, device_id, user_id
           FROM events
           WHERE user_id = $1 OR device_id = ANY($2::text[])
           ORDER BY timestamp DESC
           LIMIT 200`,
          [id, devices],
        )
      : pool.query<EventRow>(
          `SELECT id, event_name, timestamp, properties, device_id, user_id
           FROM events
           WHERE device_id = $1
           ORDER BY timestamp DESC
           LIMIT 200`,
          [id],
        );

  const [statsResult, eventsResult] = await Promise.all([statsQuery, eventsQuery]);

  const stats = statsResult.rows[0];

  if (!stats || parseInt(stats.event_count, 10) === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id,
    type,
    devices,
    first_seen: stats.first_seen,
    last_seen: stats.last_seen,
    event_count: parseInt(stats.event_count, 10),
    events: eventsResult.rows,
  });
});

export default router;
