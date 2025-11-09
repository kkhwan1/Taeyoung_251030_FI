/**
 * API Routes Layout
 *
 * This layout provides global configuration for all API routes.
 * The `dynamic = 'force-dynamic'` export cascades to all child routes,
 * ensuring they use Server-Side Rendering instead of Static Site Generation.
 *
 * This is required because all 130 API routes use dynamic server features:
 * - request.nextUrl.searchParams
 * - request.headers
 * - request.url
 * - cookies() via middleware
 *
 * Without this layout, each route would need individual `export const dynamic = 'force-dynamic'`.
 */

// Force all API routes to use dynamic rendering
export const dynamic = 'force-dynamic';

// Use Node.js runtime for all API routes
export const runtime = 'nodejs';

export default function ApiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
