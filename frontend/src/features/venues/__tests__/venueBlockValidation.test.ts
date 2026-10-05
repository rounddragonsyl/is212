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
