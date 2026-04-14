// Vercel Edge Middleware — uses Web-standard Request/Response (no next/server).
// Runs on all paths except the matcher exclusions below.

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

const PUBLIC_PATHS = ['/', '/coming-soon'];

export default function middleware(request) {
  const { pathname } = new URL(request.url);

  // Allow public paths, API routes, and static assets through without auth
  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/assets/') ||
    pathname.match(/\.(webp|png|jpg|jpeg|svg|ico|js|css|woff2?)$/)
  ) {
    return;
  }

  const basicAuth = request.headers.get('authorization');
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASS;

  // If the env vars aren't set, fail open — don't lock yourself out before you've
  // configured credentials in Vercel. Delete this guard once auth is wired up if
  // you want a hard gate.
  if (!expectedUser || !expectedPass) {
    return;
  }

  if (basicAuth) {
    const [scheme, encoded] = basicAuth.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded);
      const [user, pass] = decoded.split(':');
      if (user === expectedUser && pass === expectedPass) {
        return;
      }
    }
  }

  return new Response('Unauthorised', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Supersub", charset="UTF-8"',
    },
  });
}
