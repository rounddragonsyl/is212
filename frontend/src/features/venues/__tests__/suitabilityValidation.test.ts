import { describe, expect, test } from 'vitest'
import { evaluateVenueSuitability } from '../suitabilityValidation'
import type { VenueProfile } from '../suitabilityTypes'

const LABELS: Record<string, string> = { theatre: 'Theatre', classroom: 'Classroom', boardroom: 'Boardroom' }
const layoutLabel = (code: string) => LABELS[code] ?? code

function venue(overrides: Partial<VenueProfile> = {}): VenueProfile {
  return {
    id: 'v1',
    name: 'Hall A',
    location: 'Level 1',
    status: 'active',
    layouts: [{ layout: 'theatre', capacity: 100 }, { layout: 'classroom', capacity: 40 }],
    accessibility: ['wheelchair_access'],
    facility: { projector: true, microphone: 2 },
    ...overrides,
  }
}

function assess(overrides: Partial<Parameters<typeof evaluateVenueSuitability>[0]> = {}) {
  return evaluateVenueSuitability({
    venue: venue(),
    expectedAttendance: 60,
    requirements: { layout: null, accessibility: [], facilities: [] },
    layoutLabel,
    ...overrides,
  })
}

describe('AC-018.1 — identify suitable venues', () => {
  test('AC-018.1.9: a venue that meets every requirement is suitable, with no reasons', () => {
    const result = assess({
      requirements: { layout: 'theatre', accessibility: ['wheelchair_access'], facilities: ['projector'] },
    })
    expect(result.verdict).toBe('suitable')
    expect(result.reasons).toEqual([])
  })
})

