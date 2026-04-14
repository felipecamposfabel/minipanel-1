import { Router, Request, Response } from 'express';
import pool from '../db.js';

const router = Router();

interface ExploreRow {
  id: string;
  event_name: string;
  device_id: string | null;
  user_id: string | null;
  resolved_user_id: string | null;
  timestamp: string;
  properties: Record<string, unknown>;
}

interface CountRow {
  count: string;
}

// GET /api/explore?event_name=&page=1&limit=50
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const eventName =
    typeof req.query['event_name'] === 'string' && req.query['event_name'] !== ''
      ? req.query['event_name']
      : null;

  const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
  const limit = Math.min(
    200,
    Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10) || 50),
  );
  const offset = (page - 1) * limit;

  const [eventsResult, countResult] = await Promise.all([
    pool.query<ExploreRow>(
      `SELECT
        e.id,
        e.event_name,
        e.device_id,
        e.user_id,
        COALESCE(e.user_id, im.user_id) AS resolved_user_id,
        e.timestamp,
        e.properties
       FROM events e
       LEFT JOIN identity_map im ON e.device_id = im.device_id
       WHERE ($1::text IS NULL OR e.event_name = $1)
       ORDER BY e.timestamp DESC
       LIMIT $2 OFFSET $3`,
      [eventName, limit, offset],
    ),
    pool.query<CountRow>(
      `SELECT COUNT(*) FROM events e
       WHERE ($1::text IS NULL OR e.event_name = $1)`,
      [eventName],
    ),
  ]);

  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

  res.json({ events: eventsResult.rows, total });
});

export default router;
