export const config = {
  matcher: [
    '/((?!api|_next|static|favicon.ico|[\\w-]+\\.\\w+).*)',
  ],
};

export default function middleware(req) {
  const PASS = process.env.SITE_PASSWORD;
  const USER = 'admin';

  // If PASS is missing in production, let people in so the site doesn't 500
  if (!PASS) {
    return new Response(null, { status: 200, headers: { 'x-middleware-next': '1' } });
  }

  const authHeader = req.headers.get('authorization');

  if (authHeader) {
    try {
      const authValue = authHeader.split(' ')[1];
      // Safely decode
      const decoded = atob(authValue);
      const [user, pass] = decoded.split(':');

      if (user === USER && pass === PASS) {
        return new Response(null, {
          status: 200,
          headers: { 'x-middleware-next': '1' },
        });
      }
    } catch (e) {
      // If decoding fails, just show the login prompt again
    }
  }

  return new Response('Authentication Required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  });
}