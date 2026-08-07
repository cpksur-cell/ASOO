import 'server-only'

import { seedRepository } from './seed-repository'
import type { ContentRepository } from './types'

/**
 * The single data boundary for the public site.
 *
 * Phase 1 returns the seed repository. Phase 2 returns a Data Connect
 * implementation of the same interface — and nothing that calls this changes.
 */
export function getRepository(): ContentRepository {
  return seedRepository
}

export type * from './types'
