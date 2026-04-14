import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/coming-soon'];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public paths and all API routes through without auth
  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/assets/') ||
    pathname.match(/\.(webp|png|jpg|jpeg|svg|ico|js|css|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  const basicAuth = request.headers.get('authorization');
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASS;

  if (basicAuth) {
    const [scheme, encoded] = basicAuth.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded);
      const [user, pass] = decoded.split(':');
      if (user === expectedUser && pass === expectedPass) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Unauthorised', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Supersub", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
