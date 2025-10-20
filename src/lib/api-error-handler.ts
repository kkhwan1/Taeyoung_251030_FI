import { NextResponse } from 'next/server';

type ErrorDetails = Record<string, unknown> | string[] | string | undefined;

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: string;
  details?: ErrorDetails;
  timestamp?: string;
}

/**
 * Standard success response format
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/**
 * API Error class for consistent error handling
 */
export class APIError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public details?: ErrorDetails
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Database connection error handler
 */
export function handleDatabaseError(error: unknown): NextResponse {
  console.error('Database error:', error);

  // Type guard for database error
  if (!error || typeof error !== 'object') {
    return NextResponse.json(
      {
        success: false,
        error: 'Database operation failed',
        details: String(error)
      },
      { status: 500 }
    );
  }

  const dbError = error as { code?: string; message?: string };

  // Check for common MySQL errors
  if (dbError.code === 'ER_NO_SUCH_TABLE') {
    return NextResponse.json(
      {
        success: false,
        error: 'Database table not found',
        details: dbError.message
      },
      { status: 500 }
    );
  }

  if (dbError.code === 'ER_BAD_FIELD_ERROR') {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid database field',
        details: dbError.message
      },
      { status: 500 }
    );
  }

  if (dbError.code === 'ER_DUP_ENTRY') {
    return NextResponse.json(
      {
        success: false,
        error: 'Duplicate entry',
        details: 'This record already exists'
      },
      { status: 409 }
    );
  }

  // Generic database error
  return NextResponse.json(
    {
      success: false,
      error: 'Database operation failed',
      details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
    },
    { status: 500 }
  );
}

/**
 * Validation error handler
 */
export function handleValidationError(errors: string[]): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Validation failed',
      details: errors
    },
    { status: 400 }
  );
}

/**
 * Not found error handler
 */
export function handleNotFoundError(resource: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: `${resource} not found`
    },
    { status: 404 }
  );
}

/**
 * Generic error handler wrapper for API routes
 */
export async function withErrorHandler<T>(
  handler: () => Promise<T>
): Promise<NextResponse> {
  try {
    const result = await handler();
    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error instanceof APIError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error.details
        },
        { status: error.statusCode }
      );
    }

    if (error && typeof error === 'object' && 'code' in error) {
      return handleDatabaseError(error);
    }

    console.error('Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Validate required fields
 */
export function validateRequiredFields(
  data: Record<string, unknown>,
  requiredFields: string[]
): string[] {
  const errors: string[] = [];

  for (const field of requiredFields) {
    if (!data[field] && data[field] !== 0) {
      errors.push(`${field} is required`);
    }
  }

  return errors;
}

/**
 * Safe parse integer with default value
 */
export function parseIntSafe(value: unknown, defaultValue: number): number {
  const parsed = parseInt(String(value));
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Safe parse date
 */
export function parseDateSafe(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
}