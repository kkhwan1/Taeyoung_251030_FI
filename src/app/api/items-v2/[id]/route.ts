/**
 * Items API v2 - Using CRUDHandler Pattern (ID routes)
 * Demonstrates the new standardized approach for [id] routes
 *
 * Route: /api/items-v2/[id]
 * Methods: GET (single), PUT (update), DELETE (soft delete)
 *
 * This is an example implementation showing how 200+ lines
 * of code can be reduced to 5 lines using the CRUDHandler pattern.
 */

import { createIdRoutes } from '@/lib/api/routeWrapper';
import { ItemsHandler } from '@/lib/api/handlers';

const handler = new ItemsHandler();
export const { GET, PUT, PATCH, DELETE } = createIdRoutes(handler, 'items');
