import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The handler now inlines SUPPORTED_LEAGUE_IDS — keep a mirror here for assertions.
const SUPPORTED_LEAGUE_IDS = [39, 40, 78, 135, 94];

// ── Mock @supabase/supabase-js ──
let mockQueryResult = { data: [], error: null };

const mockChain = {
    from: vi.fn(() => mockChain),
    select: vi.fn(() => mockChain),
    eq: vi.fn(() => mockChain),
    in: vi.fn(() => mockChain),
    order: vi.fn(() => mockChain),
    single: vi.fn(() => mockQueryResult),
    then: undefined,
};

for (const method of ['from', 'select', 'eq', 'in', 'order']) {
    mockChain[method].mockImplementation(() => {
        return { ...mockChain, then: (resolve) => resolve(mockQueryResult) };
    });
}
mockChain.single.mockImplementation(() => Promise.resolve(mockQueryResult));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => mockChain),
}));

// ── Helpers ──
function createMockReqRes(query = {}) {
    const req = { query };
    const res = {
        _status: 200,
        _body: null,
        status(code) { this._status = code; return this; },
        json(body) { this._body = body; return this; },
    };
    return { req, res };
}

// ── Tests ──
describe('API /api/matches', () => {
    let originalEnv;

    beforeEach(async () => {
        vi.clearAllMocks();
        originalEnv = { ...process.env };
        process.env.SUPABASE_URL = 'https://test.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
        mockQueryResult = { data: [], error: null };

        // Reset the cached lazy client so env changes take effect.
        // We do this by re-importing the module after clearing the cache.
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    async function getHandler() {
        const mod = await import('../matches.js?t=' + Date.now());
        return mod.default;
    }

    // ─── 1. Missing Config → API_INIT_FAILED ───
    it('returns 500 with API_INIT_FAILED when SUPABASE_URL is missing', async () => {
        delete process.env.SUPABASE_URL;
        const handler = await getHandler();
        const { req, res } = createMockReqRes({ date: '2026-02-23' });

        await handler(req, res);

        expect(res._status).toBe(500);
        expect(res._body.error).toBe('API_INIT_FAILED');
        expect(res._body.message).toContain('SUPABASE_URL');
    });

    it('returns 500 with API_INIT_FAILED when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        const handler = await getHandler();
        const { req, res } = createMockReqRes({ date: '2026-02-23' });

        await handler(req, res);

        expect(res._status).toBe(500);
        expect(res._body.error).toBe('API_INIT_FAILED');
        expect(res._body.message).toContain('SUPABASE_SERVICE_ROLE_KEY');
    });

    // ─── 2. Database Connection Error ───
    it('returns the Supabase error message on a failed query', async () => {
        mockQueryResult = { data: null, error: { message: 'connection refused' } };
        const handler = await getHandler();
        const { req, res } = createMockReqRes({ date: '2026-02-23' });

        await handler(req, res);

        expect(res._body.error).toBe('connection refused');
        expect(res._body.response).toEqual([]);
    });

    // ─── 3. Data Integrity ───
    it('returns an array where every match has the correct date format', async () => {
        const testDate = '2026-02-23';
        mockQueryResult = {
            data: [
                { id: 1, date: testDate, league_id: 39, kickoff_time: '15:00' },
                { id: 2, date: testDate, league_id: 135, kickoff_time: '17:30' },
                { id: 3, date: testDate, league_id: 78, kickoff_time: '20:00' },
            ],
            error: null,
        };
        const handler = await getHandler();
        const { req, res } = createMockReqRes({ date: testDate });

        await handler(req, res);

        expect(Array.isArray(res._body.response)).toBe(true);
        expect(res._body.response.length).toBe(3);
        for (const match of res._body.response) {
            expect(match.date).toBe(testDate);
            expect(match.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
    });

    // ─── 4. League Filter ───
    it('passes SUPPORTED_LEAGUE_IDS to the .in() filter', async () => {
        mockQueryResult = { data: [], error: null };
        const handler = await getHandler();
        const { req, res } = createMockReqRes({ date: '2026-02-23' });

        await handler(req, res);

        expect(mockChain.in).toHaveBeenCalledWith('league_id', SUPPORTED_LEAGUE_IDS);
        expect(SUPPORTED_LEAGUE_IDS).not.toContain(262);
    });
});
