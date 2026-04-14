import { Router, Request, Response } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/trends
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const event = req.query['event'];

  if (!event || typeof event !== 'string') {
    res.status(400).json({ error: 'event query parameter is required' });
    return;
  }

  const granularityRaw = req.query['granularity'];
  const measureRaw = req.query['measure'];
  const startRaw = req.query['start'];
  const endRaw = req.query['end'];

  const granularity: 'day' | 'week' =
    granularityRaw === 'week' ? 'week' : 'day';

  const measure: 'count' | 'unique_users' =
    measureRaw === 'unique_users' ? 'unique_users' : 'count';

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);

  const start: string =
    typeof startRaw === 'string' && startRaw ? startRaw : defaultStart.toISOString();
  const end: string =
    typeof endRaw === 'string' && endRaw ? endRaw : now.toISOString();

  let result;

  if (measure === 'unique_users') {
    result = await pool.query<{ period: Date; value: string }>(
      `SELECT
        date_trunc($1, e.timestamp AT TIME ZONE 'UTC') AS period,
        COUNT(DISTINCT COALESCE(e.user_id, im.user_id)) AS value
      FROM events e
      LEFT JOIN identity_map im ON e.device_id = im.device_id
      WHERE e.event_name = $2
        AND e.timestamp >= $3
        AND e.timestamp < $4
      GROUP BY period
      ORDER BY period`,
      [granularity, event, start, end],
    );
  } else {
    result = await pool.query<{ period: Date; value: string }>(
      `SELECT
        date_trunc($1, e.timestamp AT TIME ZONE 'UTC') AS period,
        COUNT(*) AS value
      FROM events e
      WHERE e.event_name = $2
        AND e.timestamp >= $3
        AND e.timestamp < $4
      GROUP BY period
      ORDER BY period`,
      [granularity, event, start, end],
    );
  }

  const data = result.rows.map((row) => ({
    period: row.period instanceof Date ? row.period.toISOString() : String(row.period),
    value: Number(row.value),
  }));

  res.json({ data });
});

export default router;
