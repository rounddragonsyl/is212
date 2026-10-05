import { describe, expect, test } from 'vitest'
import { BLOCK_VALIDATION_MESSAGES, validateVenueBlock } from '../venueBlockValidation'
import type { VenueBlockInput } from '../venueBlockTypes'

const valid: VenueBlockInput = {
  venueId: 'v1',
  startsOn: '2040-03-10',
  endsOn: '2040-03-10',
  slots: ['AM'],
  reason: 'Repairs',
}

describe('AC-012.3 — a reason is required', () => {
  test('AC-012.3.4: a reason of only spaces is refused with a message for the field', () => {
    expect(validateVenueBlock({ ...valid, reason: '   ' })).toEqual({
      ok: false,
      errors: { reason: BLOCK_VALIDATION_MESSAGES.reasonRequired },
    })
  })

  test('AC-012.3.5: a valid block is passed on with its reason trimmed', () => {
    expect(validateVenueBlock({ ...valid, reason: '  Repairs  ' })).toEqual({ ok: true, value: valid })
  })
})

describe('AC-012.2 — one date or a range', () => {
  test('AC-012.2.12: a missing first day is refused', () => {
    expect(validateVenueBlock({ ...valid, startsOn: '' })).toEqual({
      ok: false,
      errors: { startsOn: BLOCK_VALIDATION_MESSAGES.startRequired },
    })
  })

  test('AC-012.2.13: a missing last day is refused', () => {
    expect(validateVenueBlock({ ...valid, endsOn: '' })).toEqual({
      ok: false,
      errors: { endsOn: BLOCK_VALIDATION_MESSAGES.endRequired },
    })
  })

  test('AC-012.2.14: a day that does not exist, such as 30 February, is refused', () => {
    expect(validateVenueBlock({ ...valid, startsOn: '2040-02-30', endsOn: '2040-03-01' })).toEqual({
      ok: false,
      errors: { startsOn: BLOCK_VALIDATION_MESSAGES.invalidDate },
    })
  })

  test('AC-012.2.15: a block ending before it starts is refused', () => {
    expect(validateVenueBlock({ ...valid, startsOn: '2040-03-11', endsOn: '2040-03-10' })).toEqual({
      ok: false,
      errors: { endsOn: BLOCK_VALIDATION_MESSAGES.endBeforeStart },
    })
  })

  test('AC-012.2.16: a block of exactly 366 days is accepted', () => {
    expect(validateVenueBlock({ ...valid, startsOn: '2042-01-01', endsOn: '2043-01-01' }).ok).toBe(true)
  })

  test('AC-012.2.17: a block of 367 days is refused', () => {
    expect(validateVenueBlock({ ...valid, startsOn: '2042-01-01', endsOn: '2043-01-02' })).toEqual({
      ok: false,
      errors: { endsOn: BLOCK_VALIDATION_MESSAGES.tooLong },
    })
  })
})
