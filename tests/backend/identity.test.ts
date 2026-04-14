// REQ-101
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mockQuery is available when the factory runs (vi.mock is hoisted)
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }))
vi.mock('../../server/db.js', () => ({
  default: { query: mockQuery }
}))

import { upsertIdentity } from '../../server/identity.js'

describe('upsertIdentity — BR-101', () => {
  beforeEach(() => mockQuery.mockClear())

  it('calls pool.query with device_id and user_id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 })
    await upsertIdentity('device_1', 'user_1')
    expect(mockQuery).toHaveBeenCalledOnce()
    const [sql, params] = mockQuery.mock.calls[0]
    expect(params).toContain('device_1')
    expect(params).toContain('user_1')
    expect(sql).toMatch(/INSERT.*identity_map/i)
    expect(sql).toMatch(/ON CONFLICT/i)
  })
})
