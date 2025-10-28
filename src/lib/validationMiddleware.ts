/**
 * Validation middleware for API routes
 * Integrates Zod validation with Next.js API routes and authentication
 */
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema } from 'zod';
import { User, UserRole } from '@/types/auth';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

/**
 * Parse and validate request body with Zod schema
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    // Use request.text() + JSON.parse() for proper Korean character handling
    const textBody = await request.text();
    const jsonBody = textBody ? JSON.parse(textBody) : {};

    const result = schema.safeParse(jsonBody);

    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      const errors: ValidationError[] = result.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));

      return {
        success: false,
        errors
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: [{
        field: 'body',
        message: error instanceof Error ? error.message : 'Invalid JSON format',
        code: 'invalid_json'
      }]
    };
  }
}

/**
 * Validate URL search parameters with Zod schema
 */
export function validateSearchParams<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): ValidationResult<T> {
  try {
    const { searchParams } = new URL(request.url);
    const params: Record<string, any> = {};

    // Convert URLSearchParams to plain object
    for (const [key, value] of searchParams.entries()) {
      params[key] = value;
    }

    const result = schema.safeParse(params);

    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      const errors: ValidationError[] = result.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));

      return {
        success: false,
        errors
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: [{
        field: 'searchParams',
        message: error instanceof Error ? error.message : 'Invalid search parameters',
        code: 'invalid_params'
      }]
    };
  }
}

/**
 * Validate dynamic route parameters with Zod schema
 */
export function validateRouteParams<T>(
  params: Record<string, string>,
  schema: ZodSchema<T>
): ValidationResult<T> {
  try {
    // Convert string values to appropriate types for validation
    const processedParams: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      // Try to convert to number if it looks like a number
      if (/^\d+$/.test(value)) {
        processedParams[key] = parseInt(value, 10);
      } else {
        processedParams[key] = value;
      }
    }

    const result = schema.safeParse(processedParams);

    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      const errors: ValidationError[] = result.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));

      return {
        success: false,
        errors
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: [{
        field: 'routeParams',
        message: error instanceof Error ? error.message : 'Invalid route parameters',
        code: 'invalid_route_params'
      }]
    };
  }
}

/**
 * Create a validation response for API errors
 */
export function createValidationErrorResponse(errors: ValidationError[]): NextResponse {
  return NextResponse.json({
    success: false,
    error: 'Validation failed',
    validation_errors: errors
  }, { status: 400 });
}

/**
 * Enhanced middleware wrapper that combines authentication and validation
 */
export interface ValidatedRouteOptions<TBody = any, TQuery = any, TParams = any> {
  // Authentication options
  roles?: UserRole | UserRole[];
  resource?: string;
  action?: string;

  // Validation schemas
  bodySchema?: ZodSchema<TBody>;
  querySchema?: ZodSchema<TQuery>;
  paramsSchema?: ZodSchema<TParams>;

  // Validation options
  requireBody?: boolean;
  requireAuth?: boolean;
}

export interface ValidatedRequest<TBody = any, TQuery = any, TParams = any> extends NextRequest {
  validatedBody?: TBody;
  validatedQuery?: TQuery;
  validatedParams?: TParams;
  user?: User;
}

/**
 * Create a validated and authenticated route handler
 * Overload 1: For routes without dynamic params
 */
export function createValidatedRoute<TBody = any, TQuery = any>(
  handler: (request: ValidatedRequest<TBody, TQuery>) => Promise<NextResponse>,
  options: ValidatedRouteOptions<TBody, TQuery> & { paramsSchema?: undefined }
): (request: NextRequest) => Promise<NextResponse>;

/**
 * Create a validated and authenticated route handler
 * Overload 2: For routes with dynamic params
 */
export function createValidatedRoute<TBody = any, TQuery = any, TParams = any>(
  handler: (
    request: ValidatedRequest<TBody, TQuery, TParams>,
    context?: { params: Promise<Record<string, string>> }
  ) => Promise<NextResponse>,
  options?: ValidatedRouteOptions<TBody, TQuery, TParams>
): (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

/**
 * Implementation
 */
export function createValidatedRoute<TBody = any, TQuery = any, TParams = any>(
  handler: (
    request: ValidatedRequest<TBody, TQuery, TParams>,
    context?: { params: Promise<Record<string, string>> }
  ) => Promise<NextResponse>,
  options: ValidatedRouteOptions<TBody, TQuery, TParams> = {}
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const validatedRequest = request as ValidatedRequest<TBody, TQuery, TParams>;

    try {
      // 1. Validate route parameters if schema provided
      if (options.paramsSchema && context?.params) {
        const params = await context.params;
        const paramsResult = validateRouteParams(params, options.paramsSchema);
        if (!paramsResult.success) {
          return createValidationErrorResponse(paramsResult.errors!);
        }
        validatedRequest.validatedParams = paramsResult.data;
      }

      // 2. Validate query parameters if schema provided
      if (options.querySchema) {
        const queryResult = validateSearchParams(request, options.querySchema);
        if (!queryResult.success) {
          return createValidationErrorResponse(queryResult.errors!);
        }
        validatedRequest.validatedQuery = queryResult.data;
      }

      // 3. Validate request body if schema provided
      if (options.bodySchema) {
        // Only validate body for methods that typically have a body
        const method = request.method.toUpperCase();
        if (['POST', 'PUT', 'PATCH'].includes(method) || options.requireBody) {
          const bodyResult = await validateRequestBody(request, options.bodySchema);
          if (!bodyResult.success) {
            return createValidationErrorResponse(bodyResult.errors!);
          }
          validatedRequest.validatedBody = bodyResult.data;
        }
      }

      // 4. Apply authentication if required (integrate with existing auth middleware)
      if (options.requireAuth !== false) {
        // Import auth middleware dynamically to avoid circular dependencies
        const { withAuth, withRole, withPermission } = await import('./middleware');

        // Apply authentication
        const authResult = await withAuth(request);
        if (authResult instanceof NextResponse) {
          return authResult; // Auth failed
        }
        validatedRequest.user = authResult.user;

        // Apply role-based authorization if specified
        if (options.roles) {
          const roleResult = await withRole(options.roles)(request, authResult.user);
          if (roleResult instanceof NextResponse) {
            return roleResult; // Role check failed
          }
        }

        // Apply permission-based authorization if specified
        if (options.resource && options.action) {
          const permissionResult = await withPermission(options.resource, options.action)(request, authResult.user);
          if (permissionResult instanceof NextResponse) {
            return permissionResult; // Permission check failed
          }
        }
      }

      // 5. Call the actual handler with validated data
      return await handler(validatedRequest, context);

    } catch (error) {
      console.error('Validation middleware error:', error);
      return NextResponse.json({
        success: false,
        error: 'Internal server error during validation'
      }, { status: 500 });
    }
  };
}

/**
 * Simplified validation-only wrapper (without authentication)
 */
export function validateOnly<TBody = any, TQuery = any, TParams = any>(
  handler: (
    request: ValidatedRequest<TBody, TQuery, TParams>,
    context?: { params: Promise<Record<string, string>> } | undefined
  ) => Promise<NextResponse>,
  options: {
    bodySchema?: ZodSchema<TBody>;
    querySchema?: ZodSchema<TQuery>;
    paramsSchema?: ZodSchema<TParams>;
    requireBody?: boolean;
  }
) {
  return createValidatedRoute(handler, {
    ...options,
    requireAuth: false
  });
}

/**
 * Helper function to extract validated data from request
 */
export function getValidatedData<TBody = any, TQuery = any, TParams = any>(
  request: ValidatedRequest<TBody, TQuery, TParams>
): {
  body?: TBody;
  query?: TQuery;
  params?: TParams;
  user?: User;
} {
  return {
    body: request.validatedBody,
    query: request.validatedQuery,
    params: request.validatedParams,
    user: request.user
  };
}

/**
 * Utility to create consistent error responses
 */
export function createErrorResponse(
  message: string,
  status: number = 400,
  details?: any
): NextResponse {
  return NextResponse.json({
    success: false,
    error: message,
    ...(details && { details })
  }, { status });
}

/**
 * Utility to create consistent success responses
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    ...(message && { message })
  }, { status });
}