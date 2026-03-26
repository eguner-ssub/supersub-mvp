import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ShareCardButton from '../../shared/ui/ShareCardButton';

// ── Mock useGame ────────────────────────────────────────────────────────────
const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

const mockUseGame = vi.fn();
vi.mock('../../shared/context/GameContext', () => ({
  useGame: () => mockUseGame(),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────
const makePrediction = (overrides = {}) => ({
  id: 'pred-1',
  share_token: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  selection_label: 'Arsenal to Win',
  match_title: 'Arsenal vs Chelsea',
  card_type: 'c_match_result',
  match_id: 12345,
  odds: 2.1,
  points_awarded: 210,
  selection: 'HOME_WIN',
  ...overrides,
});

const renderButton = (props = {}) =>
  render(
    <MemoryRouter>
      <ShareCardButton prediction={makePrediction()} variant="pre" {...props} />
    </MemoryRouter>
  );

// ── Tests ───────────────────────────────────────────────────────────────────
describe('ShareCardButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGame.mockReturnValue({
      userProfile: { id: 'user-1' },
      supabase: { from: mockFrom },
    });
  });

  it('renders nothing when prediction has no share_token', () => {
    const { container } = render(
      <MemoryRouter>
        <ShareCardButton prediction={{ id: 'pred-1' }} variant="pre" />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a share button when share_token exists', () => {
    renderButton();
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('uses navigator.clipboard.writeText on desktop (no navigator.share)', async () => {
    // Ensure navigator.share is NOT available
    const originalShare = navigator.share;
    delete navigator.share;

    const writeTextMock = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });

    renderButton();
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        'https://supersub.mobi/share/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      );
    });

    // Shows "Copied!" feedback
    expect(screen.getByText('Copied!')).toBeInTheDocument();

    // Restore
    if (originalShare) navigator.share = originalShare;
  });

  it('fires a share tracking event on click', async () => {
    delete navigator.share;
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });

    renderButton();
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('affiliate_events');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'share',
          card_type: 'c_match_result',
          match_id: 12345,
        })
      );
    });
  });

  it('builds correct share copy for "pre" variant', async () => {
    const shareMock = vi.fn(() => Promise.resolve());
    navigator.share = shareMock;

    renderButton({ variant: 'pre' });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("I'm calling Arsenal to Win"),
        })
      );
    });

    delete navigator.share;
  });

  it('builds correct share copy for "won" variant', async () => {
    const shareMock = vi.fn(() => Promise.resolve());
    navigator.share = shareMock;

    renderButton({ variant: 'won' });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('I called it'),
        })
      );
    });

    delete navigator.share;
  });

  it('builds correct share copy for "lost" variant', async () => {
    const shareMock = vi.fn(() => Promise.resolve());
    navigator.share = shareMock;

    renderButton({ variant: 'lost' });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('So close'),
        })
      );
    });

    delete navigator.share;
  });
});
