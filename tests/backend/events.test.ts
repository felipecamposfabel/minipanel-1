// REQ-100
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the pool to avoid needing a real DB
vi.mock('../../server/db.js', () => ({
  default: {
    query: vi.fn().mockResolvedValue({ rows: [{ id: 'test-id', event_name: 'page_viewed', device_id: 'device_1', user_id: null, timestamp: new Date().toISOString(), properties: {} }] })
  }
}))
vi.mock('../../server/identity.js', () => ({
  upsertIdentity: vi.fn().mockResolvedValue(undefined)
}))

import express from 'express'
import request from 'supertest'
import eventsRouter from '../../server/routes/events.js'

const app = express()
app.use(express.json())
app.use('/api/events', eventsRouter)

describe('POST /api/events — BR-100', () => {
  it('returns 400 when event_name is missing', async () => {
    const res = await request(app).post('/api/events').send({ device_id: 'dev_1' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/event_name/i)
  })

  it('returns 400 when both device_id and user_id are missing', async () => {
    const res = await request(app).post('/api/events').send({ event_name: 'page_viewed' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/device_id|user_id/i)
  })

  it('returns 201 with valid device_id event', async () => {
    const res = await request(app).post('/api/events').send({ event_name: 'page_viewed', device_id: 'dev_1' })
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
  })

  it('returns 201 with valid user_id event', async () => {
    const res = await request(app).post('/api/events').send({ event_name: 'signup_completed', user_id: 'user_1' })
    expect(res.status).toBe(201)
  })

  it('accepts custom timestamp', async () => {
    const ts = '2024-01-15T10:00:00.000Z'
    const res = await request(app).post('/api/events').send({ event_name: 'page_viewed', device_id: 'dev_1', timestamp: ts })
    expect(res.status).toBe(201)
  })

  it('accepts arbitrary properties', async () => {
    const res = await request(app).post('/api/events').send({ event_name: 'page_viewed', device_id: 'dev_1', properties: { page: '/dashboard', duration: 30 } })
    expect(res.status).toBe(201)
  })
})
