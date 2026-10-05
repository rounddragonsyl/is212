import { vi } from 'vitest'
import type { Mock } from 'vitest'

/**
 * Stands in for a Supabase query builder. Every method returns the same object, so a test
 * can check each call, and awaiting it at any point resolves to `result`.
 */
export type MockQuery = Promise<unknown> & Record<'select' | 'eq' | 'is' | 'neq' | 'order', Mock>

export function mockQuery(result: unknown): MockQuery {
  const query = Promise.resolve(result) as MockQuery
  for (const method of ['select', 'eq', 'is', 'neq', 'order'] as const) {
    query[method] = vi.fn(() => query)
  }
  return query
}
