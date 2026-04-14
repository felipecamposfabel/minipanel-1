import { Router, Request, Response } from 'express';
import pool from '../db.js';

const router = Router();

const ALLOWED_AGGREGATIONS = new Set(['avg', 'sum', 'min', 'max']);
const SAFE_IDENTIFIER_RE = /^[a-zA-Z0-9_]+$/;

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
  const aggregationRaw = req.query['aggregation'];
  const propertyRaw = req.query['property'];
  const breakdownRaw = req.query['breakdown'];

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

  // Validate aggregation
  let aggregation: string | undefined;
  if (typeof aggregationRaw === 'string' && aggregationRaw) {
    const lower = aggregationRaw.toLowerCase();
    if (!ALLOWED_AGGREGATIONS.has(lower)) {
      res.status(400).json({ error: `Invalid aggregation. Allowed: avg, sum, min, max` });
      return;
    }
    aggregation = lower;
  }

  // Validate property name (for aggregation)
  let property: string | undefined;
  if (typeof propertyRaw === 'string' && propertyRaw) {
    if (!SAFE_IDENTIFIER_RE.test(propertyRaw)) {
      res.status(400).json({ error: 'Invalid property name. Only alphanumeric and underscore characters allowed.' });
      return;
    }
    property = propertyRaw;
  }

  // Validate breakdown property name
  let breakdown: string | undefined;
  if (typeof breakdownRaw === 'string' && breakdownRaw) {
    if (!SAFE_IDENTIFIER_RE.test(breakdownRaw)) {
      res.status(400).json({ error: 'Invalid breakdown name. Only alphanumeric and underscore characters allowed.' });
      return;
    }
    breakdown = breakdownRaw;
  }

  // --- Breakdown query ---
  if (breakdown) {
    const breakdownCol = breakdown;
    const sql = `
      WITH ranked AS (
        SELECT
          date_trunc($1, e.timestamp AT TIME ZONE 'UTC') AS period,
          COALESCE(e.properties->>'${breakdownCol}', 'null') AS breakdown_value,
          COUNT(*) AS cnt
        FROM events e
        WHERE e.event_name = $2
          AND e.timestamp >= $3
          AND e.timestamp < $4
        GROUP BY period, breakdown_value
      ),
      top_values AS (
        SELECT breakdown_value, SUM(cnt) AS total
        FROM ranked
        GROUP BY breakdown_value
        ORDER BY total DESC
        LIMIT 10
      )
      SELECT
        r.period,
        CASE WHEN t.breakdown_value IS NOT NULL THEN r.breakdown_value ELSE 'other' END AS breakdown_value,
        SUM(r.cnt) AS value
      FROM ranked r
      LEFT JOIN top_values t ON r.breakdown_value = t.breakdown_value
      GROUP BY r.period, CASE WHEN t.breakdown_value IS NOT NULL THEN r.breakdown_value ELSE 'other' END
      ORDER BY r.period
    `;

    const result = await pool.query<{ period: Date; breakdown_value: string; value: string }>(
      sql,
      [granularity, event, start, end],
    );

    const data = result.rows.map((row) => ({
      period: row.period instanceof Date ? row.period.toISOString() : String(row.period),
      value: Number(row.value),
      breakdown: row.breakdown_value,
    }));

    // Collect ordered breakdown_values (preserving order of first appearance, "other" last)
    const seen = new Set<string>();
    const breakdown_values: string[] = [];
    for (const row of data) {
      if (row.breakdown !== 'other' && !seen.has(row.breakdown)) {
        seen.add(row.breakdown);
        breakdown_values.push(row.breakdown);
      }
    }
    if (data.some((r) => r.breakdown === 'other')) {
      breakdown_values.push('other');
    }

    res.json({ data, breakdown_values });
    return;
  }

  // --- Numeric aggregation query ---
  if (aggregation && property) {
    const aggFn = aggregation.toUpperCase();
    const sql = `
      SELECT
        date_trunc($1, e.timestamp AT TIME ZONE 'UTC') AS period,
        ${aggFn}(CAST(e.properties->>'${property}' AS NUMERIC)) AS value
      FROM events e
      WHERE e.event_name = $2
        AND e.timestamp >= $3
        AND e.timestamp < $4
      GROUP BY period
      ORDER BY period
    `;

    const result = await pool.query<{ period: Date; value: string }>(
      sql,
      [granularity, event, start, end],
    );

    const data = result.rows.map((row) => ({
      period: row.period instanceof Date ? row.period.toISOString() : String(row.period),
      value: Number(row.value),
    }));

    res.json({ data });
    return;
  }

  // --- Standard count / unique_users queries ---
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
