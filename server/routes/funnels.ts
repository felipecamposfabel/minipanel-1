import { Router, Request, Response } from 'express';
import pool from '../db.js';

const router = Router();

interface FunnelRequestBody {
  steps: string[];
  start: string;
  end: string;
}

interface StepRow {
  [key: string]: string;
}

function buildFunnelQuery(numSteps: number): { sql: string; paramCount: number } {
  // $1 = start, $2 = end, $3...$N = step event names
  const ctes: string[] = [];

  for (let i = 0; i < numSteps; i++) {
    const stepNum = i + 1;
    const eventParam = `$${i + 3}`;

    if (i === 0) {
      ctes.push(`
step${stepNum}_users AS (
  SELECT DISTINCT COALESCE(e.user_id, im.user_id) AS uid,
    MIN(e.timestamp) AS step_ts
  FROM events e
  LEFT JOIN identity_map im ON e.device_id = im.device_id
  WHERE e.event_name = ${eventParam}
    AND e.timestamp >= $1 AND e.timestamp < $2
    AND COALESCE(e.user_id, im.user_id) IS NOT NULL
  GROUP BY COALESCE(e.user_id, im.user_id)
)`);
    } else {
      const prevStep = i;
      ctes.push(`
step${stepNum}_users AS (
  SELECT DISTINCT COALESCE(e.user_id, im.user_id) AS uid,
    MIN(e.timestamp) AS step_ts
  FROM events e
  LEFT JOIN identity_map im ON e.device_id = im.device_id
  INNER JOIN step${prevStep}_users s ON COALESCE(e.user_id, im.user_id) = s.uid
  WHERE e.event_name = ${eventParam}
    AND e.timestamp >= $1 AND e.timestamp < $2
    AND e.timestamp > s.step_ts
  GROUP BY COALESCE(e.user_id, im.user_id)
)`);
    }
  }

  const selectParts: string[] = [];
  for (let i = 0; i < numSteps; i++) {
    selectParts.push(`(SELECT COUNT(*) FROM step${i + 1}_users) AS step${i + 1}_count`);
  }

  const sql = `WITH ${ctes.join(',\n')}
SELECT ${selectParts.join(', ')}`;

  return { sql, paramCount: numSteps + 2 };
}

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as FunnelRequestBody;
  const { steps, start, end } = body;

  if (!Array.isArray(steps) || steps.length < 2 || steps.length > 5) {
    res.status(400).json({ error: 'steps must be an array of 2–5 event names' });
    return;
  }

  for (const step of steps) {
    if (typeof step !== 'string' || step.trim() === '') {
      res.status(400).json({ error: 'each step must be a non-empty string' });
      return;
    }
  }

  if (!start || !end) {
    res.status(400).json({ error: 'start and end are required' });
    return;
  }

  const { sql } = buildFunnelQuery(steps.length);
  const params: string[] = [start, end, ...steps];

  const result = await pool.query<StepRow>(sql, params);
  const row = result.rows[0];

  const counts: number[] = steps.map((_, i) => Number(row[`step${i + 1}_count`] ?? 0));

  const resultSteps = steps.map((name, i) => {
    const count = counts[i];
    const conversion = i === 0 ? null : counts[i - 1] > 0 ? count / counts[i - 1] : 0;
    return { name, count, conversion };
  });

  const overallConversion = counts[0] > 0 ? counts[counts.length - 1] / counts[0] : 0;

  res.json({ steps: resultSteps, overall_conversion: overallConversion });
});

export default router;
