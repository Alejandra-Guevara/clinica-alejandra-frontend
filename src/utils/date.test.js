import { describe, expect, it } from 'vitest'
import { bogotaDateTime } from './date'

describe('formato de fecha para Colombia', () => {
  it('muestra una fecha legible en español', () => {
    expect(bogotaDateTime('2026-11-13T15:00:00Z')).toMatch(/13\/11\/2026, 10:00/i)
  })
})
