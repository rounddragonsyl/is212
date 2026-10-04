import { describe, expect, test } from 'vitest'
import { evaluateVenueSuitability, normaliseRequirements, sortAssessments } from '../suitabilityValidation'
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
    timing: 'ok',
    occupied: [],
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
  test('AC-018.1.10: the layouts that can hold the expected attendance are listed, smallest first', () => {
    const result = assess({
      venue: venue({ layouts: [
        { layout: 'theatre', capacity: 100 },
        { layout: 'classroom', capacity: 40 },
        { layout: 'boardroom', capacity: 70 },
      ] }),
    })
    expect(result.fittingLayouts).toEqual([
      { layout: 'boardroom', capacity: 70 },
      { layout: 'theatre', capacity: 100 },
    ])
  })  
  test('AC-018.1.11: suitable venues are listed first, then unsuitable, alphabetically within each', () => {
    const beta = assess({ venue: venue({ id: 'b', name: 'Beta' }) })
    const alpha = assess({ venue: venue({ id: 'a', name: 'Alpha' }), expectedAttendance: 150 })
    const gamma = assess({ venue: venue({ id: 'c', name: 'Gamma' }) })
    expect(sortAssessments([alpha, gamma, beta]).map((a) => a.venue.name)).toEqual(['Beta', 'Gamma', 'Alpha'])
  })  
  test('AC-018.1.12: requirements are cleaned before saving: trimmed, no blanks, no repeats, empty layout means none', () => {
    expect(normaliseRequirements({
      layout: '  ',
      accessibility: [' hearing_loop ', '', 'hearing_loop'],
      facilities: ['projector', ' '],
    })).toEqual({ layout: null, accessibility: ['hearing_loop'], facilities: ['projector'] })
  })
})

describe('AC-018.3 — venues that do not meet requirements are marked unsuitable', () => {
  test('AC-018.3.26: with no layout required, a venue whose largest layout is too small is unsuitable', () => {
    const result = assess({ expectedAttendance: 150 })
    expect(result.verdict).toBe('unsuitable')
    expect(result.reasons).toEqual([
      { code: 'capacity', message: 'Holds at most 100 in any layout; 150 attendees are expected.' },
    ])
  })
  test('AC-018.3.27: a venue without the required layout is unsuitable', () => {
    const result = assess({ requirements: { layout: 'boardroom', accessibility: [], facilities: [] } })
    expect(result.verdict).toBe('unsuitable')
    expect(result.reasons).toEqual([{ code: 'layout', message: 'Does not support the Boardroom layout.' }])
  })
  test("AC-018.3.28: capacity is judged for the required layout, not the venue's largest (#112)", () => {
    const result = assess({ requirements: { layout: 'classroom', accessibility: [], facilities: [] } })
    expect(result.verdict).toBe('unsuitable')
    expect(result.reasons).toEqual([
      { code: 'capacity', message: 'Holds 40 in the Classroom layout; 60 attendees are expected.' },
    ])
  })  
  test('AC-018.3.29: missing accessibility features are named', () => {
    const result = assess({
      requirements: { layout: null, accessibility: ['wheelchair_access', 'hearing_loop', 'lift_access'], facilities: [] },
    })
    expect(result.verdict).toBe('unsuitable')
    expect(result.reasons).toEqual([
      { code: 'accessibility', message: 'Missing accessibility: Hearing loop, Lift access.' },
    ])
  })  
  test('AC-018.3.30: missing facilities are named; a count above zero counts as present', () => {
    const result = assess({
      venue: venue({ facility: { projector: true, microphone: 2, stage: 0, wifi: false } }),
      requirements: { layout: null, accessibility: [], facilities: ['projector', 'microphone', 'stage', 'wifi'] },
    })
    expect(result.verdict).toBe('unsuitable')
    expect(result.reasons).toEqual([{ code: 'facility', message: 'Missing facilities: Stage, Wi-Fi.' }])
  })
  test('AC-018.3.31: every reason is listed, not just the first', () => {
    const result = assess({
      expectedAttendance: 150,
      requirements: { layout: null, accessibility: ['hearing_loop'], facilities: ['stage'] },
    })
    expect(result.reasons.map((reason) => reason.code)).toEqual(['capacity', 'accessibility', 'facility'])
  })

  test('AC-018.3.32: when expected attendance is unknown, capacity is not judged', () => {
    const result = assess({ expectedAttendance: null })
    expect(result.verdict).toBe('suitable')
    expect(result.reasons).toEqual([])
  })
})

describe('AC-018.4 — venues taken by bookings or maintenance are blacked out', () => {
  test('AC-018.4.1: a venue blocked by Venue Staff on a slot the booking needs is unavailable, naming the slot', () => {
    const result = assess({ occupied: [{ date: '2041-03-10', slot: 'AM', kind: 'maintenance' }] })
    expect(result.verdict).toBe('unavailable')
    expect(result.reasons).toEqual([{ code: 'blocked', message: 'Blocked by Venue Staff on 10 Mar 2041 (AM).' }])
  })  
  test('AC-018.4.2: a venue already booked for the event or its setup/turnaround slots is unavailable', () => {
    const result = assess({ occupied: [
      { date: '2041-03-09', slot: 'NIGHT', kind: 'buffer' },
      { date: '2041-03-10', slot: 'AM', kind: 'event' },
    ] })
    expect(result.verdict).toBe('unavailable')
    expect(result.reasons).toEqual([
      { code: 'booked', message: 'Already booked on 9 Mar 2041 (Night), 10 Mar 2041 (AM).' },
    ])
  })  
  test('AC-018.4.3: a venue marked under maintenance is unavailable', () => {
    const result = assess({ venue: venue({ status: 'under_maintenance' }) })
    expect(result.verdict).toBe('unavailable')
    expect(result.reasons).toEqual([{ code: 'venue_status', message: 'The venue is under maintenance.' }])
  })  
  test('AC-018.4.4: without event times, availability cannot be checked, so the venue is not offered as free', () => {
    const result = assess({ timing: 'missing' })
    expect(result.verdict).toBe('unavailable')
    expect(result.reasons).toEqual([
      { code: 'timing', message: 'The event has no start and end time, so availability cannot be checked.' },
    ])
  })
})