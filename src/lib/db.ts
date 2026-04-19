import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Check if DATABASE_URL is set and points to a valid source
const hasDb = !!process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('file:/nonexistent')

function createPrismaClient(): PrismaClient | null {
  if (!hasDb) {
    console.log('[DB] No DATABASE_URL configured — database features disabled')
    return null
  }
  try {
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query'] : ['error'],
    })
  } catch (e) {
    console.warn('[DB] Failed to create PrismaClient:', e instanceof Error ? e.message : 'Unknown error')
    return null
  }
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production' && db) {
  globalForPrisma.prisma = db
}

// Helper to check if DB is available
export function isDbAvailable(): boolean {
  return db !== null
}
