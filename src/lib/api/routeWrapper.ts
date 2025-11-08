/**
 * Route Wrapper Utility
 * Simplifies creating API routes with CRUDHandler pattern
 *
 * Usage:
 * import { createRoutes } from '@/lib/api/routeWrapper';
 * import { ItemsHandler } from '@/lib/api/handlers';
 *
 * const handler = new ItemsHandler();
 * export const { GET, POST } = createRoutes(handler, 'items');
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleError } from '@/lib/errorHandler';
import type { ICRUDHandler, RequestContext } from './types';

/**
 * Create standardized routes for a handler
 */
export function createRoutes(
  handler: ICRUDHandler,
  resourceName: string
) {
  return {
    /**
     * GET /api/[resource] - List all records
     */
    GET: async (request: NextRequest) => {
      const context: RequestContext = {
        resource: resourceName,
        action: 'list',
        userId: request.headers.get('x-user-id') || undefined,
        requestId: request.headers.get('x-request-id') || undefined
      };

      try {
        const result = await handler.getAll(request, context);
        return NextResponse.json(result);
      } catch (error) {
        return handleError(error, context);
      }
    },

    /**
     * POST /api/[resource] - Create new record
     */
    POST: async (request: NextRequest) => {
      const context: RequestContext = {
        resource: resourceName,
        action: 'create',
        userId: request.headers.get('x-user-id') || undefined,
        requestId: request.headers.get('x-request-id') || undefined
      };

      try {
        // Parse request body (Korean encoding support)
        const text = await request.text();
        const data = JSON.parse(text);

        const result = await handler.create(data, context);
        return NextResponse.json(result, { status: 201 });
      } catch (error) {
        return handleError(error, context);
      }
    }
  };
}

/**
 * Create standardized routes for [id] routes
 */
export function createIdRoutes(
  handler: ICRUDHandler,
  resourceName: string
) {
  return {
    /**
     * GET /api/[resource]/[id] - Get single record
     */
    GET: async (
      request: NextRequest,
      { params }: { params: Promise<{ id: string }> }
    ) => {
      const context: RequestContext = {
        resource: resourceName,
        action: 'read',
        userId: request.headers.get('x-user-id') || undefined,
        requestId: request.headers.get('x-request-id') || undefined
      };

      try {
        const { id } = await params;
        const result = await handler.getById(parseInt(id), context);
        return NextResponse.json(result);
      } catch (error) {
        return handleError(error, context);
      }
    },

    /**
     * PUT/PATCH /api/[resource]/[id] - Update record
     */
    PUT: async (
      request: NextRequest,
      { params }: { params: Promise<{ id: string }> }
    ) => {
      const context: RequestContext = {
        resource: resourceName,
        action: 'update',
        userId: request.headers.get('x-user-id') || undefined,
        requestId: request.headers.get('x-request-id') || undefined
      };

      try {
        const { id } = await params;

        // Parse request body (Korean encoding support)
        const text = await request.text();
        const data = JSON.parse(text);

        const result = await handler.update(parseInt(id), data, context);
        return NextResponse.json(result);
      } catch (error) {
        return handleError(error, context);
      }
    },

    /**
     * PATCH - Alias for PUT
     */
    PATCH: async (
      request: NextRequest,
      { params }: { params: Promise<{ id: string }> }
    ) => {
      const context: RequestContext = {
        resource: resourceName,
        action: 'update',
        userId: request.headers.get('x-user-id') || undefined,
        requestId: request.headers.get('x-request-id') || undefined
      };

      try {
        const { id } = await params;

        // Parse request body (Korean encoding support)
        const text = await request.text();
        const data = JSON.parse(text);

        const result = await handler.update(parseInt(id), data, context);
        return NextResponse.json(result);
      } catch (error) {
        return handleError(error, context);
      }
    },

    /**
     * DELETE /api/[resource]/[id] - Delete record
     */
    DELETE: async (
      request: NextRequest,
      { params }: { params: Promise<{ id: string }> }
    ) => {
      const context: RequestContext = {
        resource: resourceName,
        action: 'delete',
        userId: request.headers.get('x-user-id') || undefined,
        requestId: request.headers.get('x-request-id') || undefined
      };

      try {
        const { id } = await params;
        const result = await handler.delete(parseInt(id), context);
        return NextResponse.json(result);
      } catch (error) {
        return handleError(error, context);
      }
    }
  };
}
