'use client';

// Force dynamic rendering to avoid Static Generation errors with React hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Database,
  MemoryStick,
  HardDrive,
  Settings,
  Clock,
  Activity
} from 'lucide-react';

interface DetailedHealthCheck {
  status: string;
  timestamp: string;
  version: string;
  responseTime: number;
  checks: {
    database: {
      status: string;
      responseTime: number;
      connectionPool?: {
        active: number;
        idle: number;
        total: number;
        limit: number;
        utilizationPercent: number;
      };
    };
    memory: {
      status: string;
      usage: number;
      heap: number;
      external: number;
      limit: number;
    };
    system: {
      status: string;
      nodeVersion: string;
      platform: string;
      architecture: string;
      environment: string;
      pid: number;
    };
  };
  correlationId: string;
  environment: string;
}

export default function HealthCheckPage() {
  const [healthData, setHealthData] = useState<DetailedHealthCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch detailed health check
  const fetchDetailedHealth = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/health', {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setHealthData(data);
    } catch (err) {
      console.error('Error fetching detailed health:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDetailedHealth();
  }, []);

  // Get status icon
  const getStatusIcon = (status: string, size = 'w-5 h-5') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className={`${size} text-green-600 dark:text-green-400`} />;
      case 'degraded':
        return <XCircle className={`${size} text-yellow-600 dark:text-yellow-400`} />;
      case 'unhealthy':
        return <XCircle className={`${size} text-red-600 dark:text-red-400`} />;
      default:
        return <XCircle className={`${size} text-gray-500`} />;
    }
  };

  // Get status color class
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'border-green-200 bg-green-50 dark:bg-green-900/20';
      case 'degraded':
        return 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20';
      case 'unhealthy':
        return 'border-red-200 bg-red-50 dark:bg-red-900/20';
      default:
        return 'border-gray-200 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">시스템 헬스체크</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          상세한 시스템 상태 검사 및 진단
        </p>
      </div>

      {/* Refresh Button */}
      <div className="mb-6">
        <button
          onClick={fetchDetailedHealth}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>헬스체크 실행</span>
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-700 dark:text-gray-400">오류: {error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-500" />
            <span className="text-gray-600 dark:text-gray-400">상세 헬스체크를 실행하는 중...</span>
          </div>
        </div>
      )}

      {/* Health Data */}
      {healthData && !loading && (
        <>
          {/* Overall Status */}
          <div className={`border rounded-lg p-6 ${getStatusColor(healthData.status)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getStatusIcon(healthData.status, 'w-8 h-8')}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">전체 시스템 상태</h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {new Date(healthData.timestamp).toLocaleString('ko-KR')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {healthData.status.toUpperCase()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  응답시간: {healthData.responseTime}ms
                </div>
              </div>
            </div>
          </div>

          {/* Basic Checks */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">시스템 상태 검사</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Database Check */}
              <div className={`border rounded-lg p-6 ${getStatusColor(healthData.checks.database.status)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Database className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">데이터베이스</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">연결 및 응답성</p>
                    </div>
                  </div>
                  {getStatusIcon(healthData.checks.database.status)}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span>응답시간</span>
                    <span className="font-medium">{healthData.checks.database.responseTime}ms</span>
                  </div>
                  {healthData.checks.database.connectionPool && (
                    <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                      <span>연결 풀</span>
                      <span className="font-medium">{healthData.checks.database.connectionPool.total}/{healthData.checks.database.connectionPool.limit}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Memory Check */}
              <div className={`border rounded-lg p-6 ${getStatusColor(healthData.checks.memory.status)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <MemoryStick className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">메모리</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">사용량 및 힙 상태</p>
                    </div>
                  </div>
                  {getStatusIcon(healthData.checks.memory.status)}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span>사용량</span>
                    <span className="font-medium">{healthData.checks.memory.usage}MB</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span>힙 메모리</span>
                    <span className="font-medium">{healthData.checks.memory.heap}MB</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span>외부 메모리</span>
                    <span className="font-medium">{healthData.checks.memory.external}MB</span>
                  </div>
                </div>
              </div>

              {/* System Check */}
              <div className={`border rounded-lg p-6 ${getStatusColor(healthData.checks.system.status)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Settings className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">시스템</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">환경 정보</p>
                    </div>
                  </div>
                  {getStatusIcon(healthData.checks.system.status)}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span>Node.js</span>
                    <span className="font-medium">{healthData.checks.system.nodeVersion}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span>환경</span>
                    <span className="font-medium">{healthData.checks.system.environment}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                    <span>플랫폼</span>
                    <span className="font-medium">{healthData.checks.system.platform}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <p>상관관계 ID: {healthData.correlationId}</p>
            <p className="mt-1">검사 완료: {new Date(healthData.timestamp).toLocaleString('ko-KR')}</p>
          </div>
        </>
      )}
    </div>
  );
}