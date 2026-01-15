import { vi } from 'vitest';

// Mock Supabase client for testing
export const supabase = {
  auth: {
    getSession: vi.fn(() => Promise.resolve({
      data: { session: null },
      error: null
    })),
    onAuthStateChange: vi.fn(() => ({
      data: {
        subscription: {
          unsubscribe: vi.fn()
        }
      }
    })),
    signInWithPassword: vi.fn(() => Promise.resolve({
      data: { user: null, session: null },
      error: null
    })),
    signUp: vi.fn(() => Promise.resolve({
      data: { user: null, session: null },
      error: null
    })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(() => Promise.resolve({
          data: null,
          error: null
        })),
        single: vi.fn(() => Promise.resolve({
          data: null,
          error: null
        })),
      })),
    })),
    insert: vi.fn(() => Promise.resolve({
      data: null,
      error: null
    })),
    upsert: vi.fn(() => Promise.resolve({
      data: null,
      error: null
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({
        data: null,
        error: null
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({
        data: null,
        error: null
      }))
    })),
  })),
};
