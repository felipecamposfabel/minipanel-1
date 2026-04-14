import pool from './db.js';

export async function upsertIdentity(deviceId: string, userId: string): Promise<void> {
  // Only update updated_at if the user_id matches — enforces one device → one user.
  // If the device already maps to a different user, the WHERE clause won't match and
  // zero rows will be updated (no throw, just a silent skip + warning below).
  const result = await pool.query(
    `INSERT INTO identity_map (device_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (device_id) DO UPDATE
       SET updated_at = NOW()
       WHERE identity_map.user_id = $2`,
    [deviceId, userId],
  );

  if (result.rowCount === 0) {
    // Conflict with a different user_id — keep existing mapping.
    console.warn(
      `[identity] device_id "${deviceId}" already mapped to a different user_id; ` +
        `skipping update for user_id "${userId}"`,
    );
  }
}
