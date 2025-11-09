/**
 * Items API v2 - Using CRUDHandler Pattern
 * Demonstrates the new standardized approach
 *
 * Route: /api/items-v2
 * Methods: GET (list), POST (create)
 *
 * This is an example implementation showing how 100+ lines
 * of code can be reduced to 5 lines using the CRUDHandler pattern.
 */

import { createRoutes } from '@/lib/api/routeWrapper';
import { ItemsHandler } from '@/lib/api/handlers';

export const dynamic = 'force-dynamic';


const handler = new ItemsHandler();
export const { GET, POST } = createRoutes(handler, 'items');
