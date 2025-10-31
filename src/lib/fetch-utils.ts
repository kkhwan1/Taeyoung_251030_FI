/**
 * 공통 Fetch 유틸리티 함수
 * 
 * 모든 API 호출에 타임아웃, 재시도, 에러 처리를 일관되게 적용
 */

/**
 * 타임아웃이 포함된 fetch 함수
 * 
 * @param url - 요청 URL
 * @param options - fetch 옵션
 * @param timeout - 타임아웃 시간 (밀리초, 기본값: 10000ms = 10초)
 * @returns Promise<Response>
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms: ${url}`);
    }
    throw error;
  }
}

/**
 * 재시도 로직이 포함된 fetch 함수
 * 
 * @param url - 요청 URL
 * @param options - fetch 옵션
 * @param maxRetries - 최대 재시도 횟수 (기본값: 3)
 * @param retryDelay - 재시도 간격 (밀리초, 기본값: 1000ms)
 * @param timeout - 타임아웃 시간 (밀리초, 기본값: 10000ms)
 * @returns Promise<Response>
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  retryDelay: number = 1000,
  timeout: number = 10000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeout);
      
      // HTTP 오류도 재시도 대상으로 처리
      if (!response.ok && attempt < maxRetries) {
        const isRetryable = response.status >= 500 || response.status === 0;
        if (isRetryable) {
          console.warn(`Request failed with status ${response.status}, retrying... (${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
          continue;
        }
      }
      
      return response;
    } catch (error: any) {
      lastError = error;
      
      // 네트워크 오류만 재시도
      const isNetworkError = error instanceof TypeError || 
                            error.message?.includes('Failed to fetch') ||
                            error.message?.includes('NetworkError') ||
                            error.message?.includes('timeout') ||
                            error.message?.includes('network');
      
      if (isNetworkError && attempt < maxRetries) {
        const delay = Math.min(retryDelay * (attempt + 1), 3000); // 최대 3초
        console.log(`Network error, retrying... (${attempt + 1}/${maxRetries}) in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  
  throw lastError || new Error('Request failed after all retries');
}

/**
 * 타임아웃과 재시도가 모두 포함된 fetch 함수 (권장)
 * 
 * @param url - 요청 URL
 * @param options - fetch 옵션
 * @param config - 설정 옵션
 * @returns Promise<Response>
 */
export interface FetchConfig {
  timeout?: number;      // 타임아웃 시간 (기본값: 10000ms)
  maxRetries?: number;   // 최대 재시도 횟수 (기본값: 3)
  retryDelay?: number;   // 재시도 간격 (기본값: 1000ms)
}

export async function safeFetch(
  url: string,
  options: RequestInit = {},
  config: FetchConfig = {}
): Promise<Response> {
  const {
    timeout = 10000,
    maxRetries = 3,
    retryDelay = 1000
  } = config;

  return fetchWithRetry(url, options, maxRetries, retryDelay, timeout);
}

/**
 * JSON 응답을 파싱하는 안전한 fetch 함수
 * 
 * @param url - 요청 URL
 * @param options - fetch 옵션
 * @param config - 설정 옵션
 * @returns Promise<T>
 */
export async function safeFetchJson<T = any>(
  url: string,
  options: RequestInit = {},
  config: FetchConfig = {}
): Promise<T> {
  const response = await safeFetch(url, options, config);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * 여러 요청을 병렬로 처리하되, 타임아웃과 재시도를 적용
 * 
 * @param requests - fetch 요청 배열
 * @param config - 설정 옵션
 * @returns Promise<Response[]>
 */
export async function safeFetchAll(
  requests: Array<{ url: string; options?: RequestInit }>,
  config: FetchConfig = {}
): Promise<Response[]> {
  return Promise.all(
    requests.map(req => safeFetch(req.url, req.options || {}, config))
  );
}

/**
 * 여러 JSON 요청을 병렬로 처리
 * 
 * @param requests - fetch 요청 배열
 * @param config - 설정 옵션
 * @returns Promise<T[]>
 */
export async function safeFetchAllJson<T = any>(
  requests: Array<{ url: string; options?: RequestInit }>,
  config: FetchConfig = {}
): Promise<T[]> {
  const responses = await safeFetchAll(requests, config);
  return Promise.all(responses.map(res => {
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }));
}

