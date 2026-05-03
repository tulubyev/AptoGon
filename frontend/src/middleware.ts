import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  matcher: [
    // Match all pathnames except for
    // - files (e.g. /robots.txt, /favicon.ico)
    // - api routes (/api/...)
    // - _next (Next.js internals)
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
}
