/**
 * Korean Character Encoding Utility
 * 
 * This utility ensures proper UTF-8 encoding for Korean characters in API requests.
 * 
 * CRITICAL: Use this function instead of request.json() for all POST/PUT/PATCH APIs
 * that may receive Korean text, as request.json() can corrupt Korean characters.
 * 
 * Pattern:
 *   const data = await parseKoreanRequest<YourType>(request);
 * 
 * Instead of:
 *   const data = await request.json();  // ❌ Can break Korean characters
 */

import { NextRequest } from 'next/server';

/**
 * Parse request body with proper Korean character encoding
 * 
 * @param request - Next.js request object
 * @returns Parsed JSON data with proper UTF-8 encoding
 * @throws Error if JSON parsing fails
 * 
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const body = await parseKoreanRequest<CreateItemRequest>(request);
 *   // body is now properly typed and Korean characters are preserved
 * }
 * ```
 */
export async function parseKoreanRequest<T = any>(request: NextRequest): Promise<T> {
  try {
    const text = await request.text();
    
    // Return empty object if text is empty
    if (!text || text.trim() === '') {
      return {} as T;
    }
    
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(
      `Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Parse request body with validation error handling
 * 
 * @param request - Next.js request object
 * @returns Object with success flag and data or error
 * 
 * @example
 * ```typescript
 * const result = await parseKoreanRequestSafe<CreateItemRequest>(request);
 * if (!result.success) {
 *   return NextResponse.json({ error: result.error }, { status: 400 });
 * }
 * const body = result.data;
 * ```
 */
export async function parseKoreanRequestSafe<T = any>(request: NextRequest): Promise<{
  success: boolean;
  data?: T;
  error?: string;
}> {
  try {
    const data = await parseKoreanRequest<T>(request);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid JSON format'
    };
  }
}

