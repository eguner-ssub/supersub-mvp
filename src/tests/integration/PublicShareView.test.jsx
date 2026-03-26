import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// ── Mock @supabase/supabase-js at module level ──────────────────────────────
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

// ── Mock useGame (PublicShareView doesn't use it, but AffiliateDisclaimer might be in tree) ──
vi.mock('../../shared/context/GameContext', () => ({
  useGame: () => ({
    userProfile: null,
    loading: false,
    supabase: { from: mockFrom },
  }),
}));

import PublicShareView from '../../pages/PublicShareView';

// ── Helpers ─────────────────────────────────────────────────────────────────
const TEST_TOKEN = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const makePrediction = (overrides = {}) => ({
  id: 'pred-1',
  share_token: TEST_TOKEN,
  selection_label: 'Arsenal to Win',
  match_title: 'Arsenal vs Chelsea',
  card_type: 'c_match_result',
  settled_status: 'WON',
  points_awarded: 210,
  potential_reward: 210,
  status: 'SETTLED',
  ...overrides,
});

const renderView = (token = TEST_TOKEN) =>
  render(
    <MemoryRouter initialEntries={[`/share/${token}`]}>
      <Routes>
        <Route path="/share/:token" element={<PublicShareView />} />
      </Routes>
    </MemoryRouter>
  );

// ── Tests ───────────────────────────────────────────────────────────────────
describe('PublicShareView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Prediction not found" when token does not match any prediction', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    renderView();

    await waitFor(() => {
      expect(screen.getByText('Prediction not found')).toBeInTheDocument();
    });

    expect(screen.getByText(/expired or doesn't exist/i)).toBeInTheDocument();
    expect(screen.getByText(/Go to Supersub/i)).toBeInTheDocument();
  });

  it('renders a WON prediction with trophy and points', async () => {
    mockSingle.mockResolvedValue({ data: makePrediction(), error: null });

    renderView();

    await waitFor(() => {
      expect(screen.getByText('Arsenal to Win')).toBeInTheDocument();
    });

    expect(screen.getByText('Arsenal vs Chelsea')).toBeInTheDocument();
    expect(screen.getByText('Called it')).toBeInTheDocument();
    expect(screen.getByText('+210 pts')).toBeInTheDocument();
  });

  it('renders a LOST prediction with "Unlucky" message', async () => {
    mockSingle.mockResolvedValue({
      data: makePrediction({ settled_status: 'LOST' }),
      error: null,
    });

    renderView();

    await waitFor(() => {
      expect(screen.getByText('Arsenal to Win')).toBeInTheDocument();
    });

    expect(screen.getByText('Unlucky')).toBeInTheDocument();
  });

  it('renders a PENDING prediction with "Awaiting result"', async () => {
    mockSingle.mockResolvedValue({
      data: makePrediction({ settled_status: null, status: 'PENDING' }),
      error: null,
    });

    renderView();

    await waitFor(() => {
      expect(screen.getByText('Arsenal to Win')).toBeInTheDocument();
    });

    expect(screen.getByText('Awaiting result')).toBeInTheDocument();
  });

  it('shows the CTA to play free', async () => {
    mockSingle.mockResolvedValue({ data: makePrediction(), error: null });

    renderView();

    await waitFor(() => {
      expect(screen.getByText(/Make your own call/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Already playing/i)).toBeInTheDocument();
  });

  it('shows the correct card type badge', async () => {
    mockSingle.mockResolvedValue({ data: makePrediction(), error: null });

    renderView();

    await waitFor(() => {
      expect(screen.getByText('MATCH RESULT')).toBeInTheDocument();
    });
  });

  it('queries predictions with the correct share_token', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    renderView('my-test-token');

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('predictions');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('share_token', 'my-test-token');
    });
  });
});
