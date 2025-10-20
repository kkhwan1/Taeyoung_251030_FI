'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
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
  uptime: number;
  version: string;
  responseTime: number;
  basicChecks: {
    database: {
      status: string;
      responseTime: number;
      connections: number;
      error?: string;
    };
    memory: {
      usage: number;
      heap: number;
      external: number;
    };
  };
  detailedChecks: {
    databaseTables: {
      status: string;
      tablesChecked: number;
      failedTables: number;
      responseTime: number;
      error?: string;
    };
    filesystem: {
      status: string;
      logsDirectory: string;
      writable: boolean;
      error?: string;
    };
    environment: {
      status: string;
      requiredVariables: number;
      missingVariables: string[];
      nodeEnv: string;
    };
  };
  correlationId: string;
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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
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
        return <CheckCircle className={`${size} text-green-500`} />;
      case 'degraded':
        return <AlertTriangle className={`${size} text-yellow-500`} />;
      case 'unhealthy':
        return <XCircle className={`${size} text-red-500`} />;
      default:
        return <AlertTriangle className={`${size} text-gray-500`} />;
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
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">시스템 헬스체크</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            상세한 시스템 상태 검사 및 진단
          </p>
        </div>

        <button
          onClick={fetchDetailedHealth}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>헬스체크 실행</span>
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700 dark:text-red-400">오류: {error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
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
                  <h2 className="text-2xl font-bold">전체 시스템 상태</h2>
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
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">기본 상태 검사</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Database Check */}
              <div className={`border rounded-lg p-6 ${getStatusColor(healthData.basicChecks.database.status)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Database className="w-6 h-6 text-blue-500" />
                    <div>
                      <h4 className="font-semibold">데이터베이스</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">연결 및 응답성</p>
                    </div>
                  </div>
                  {getStatusIcon(healthData.basicChecks.database.status)}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>응답시간</span>
                    <span className="font-medium">{healthData.basicChecks.database.responseTime}ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>연결 수</span>
                    <span className="font-medium">{healthData.basicChecks.database.connections}</span>
                  </div>
                  {healthData.basicChecks.database.error && (
                    <div className="text-sm text-red-600 dark:text-red-400">
                      오류: {healthData.basicChecks.database.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Memory Check */}
              <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <MemoryStick className="w-6 h-6 text-green-500" />
                    <div>
                      <h4 className="font-semibold">메모리</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">사용량 및 힙 상태</p>
                    </div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>RSS 메모리</span>
                    <span className="font-medium">{Math.round(healthData.basicChecks.memory.usage)}MB</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>힙 메모리</span>
                    <span className="font-medium">{Math.round(healthData.basicChecks.memory.heap)}MB</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>외부 메모리</span>
                    <span className="font-medium">{Math.round(healthData.basicChecks.memory.external)}MB</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Checks */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">상세 상태 검사</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Database Tables Check */}
              <div className={`border rounded-lg p-6 ${getStatusColor(healthData.detailedChecks.databaseTables.status)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Database className="w-6 h-6 text-blue-500" />
                    <div>
                      <h4 className="font-semibold">데이터베이스 테이블</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">테이블 접근성</p>
                    </div>
                  </div>
                  {getStatusIcon(healthData.detailedChecks.databaseTables.status)}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>검사한 테이블</span>
                    <span className="font-medium">{healthData.detailedChecks.databaseTables.tablesChecked}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>실패한 테이블</span>
                    <span className="font-medium">{healthData.detailedChecks.databaseTables.failedTables}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>응답시간</span>
                    <span className="font-medium">{healthData.detailedChecks.databaseTables.responseTime}ms</span>
                  </div>
                  {healthData.detailedChecks.databaseTables.error && (
                    <div className="text-sm text-red-600 dark:text-red-400">
                      {healthData.detailedChecks.databaseTables.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Filesystem Check */}
              <div className={`border rounded-lg p-6 ${getStatusColor(healthData.detailedChecks.filesystem.status)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <HardDrive className="w-6 h-6 text-purple-500" />
                    <div>
                      <h4 className="font-semibold">파일시스템</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">로그 디렉토리 접근</p>
                    </div>
                  </div>
                  {getStatusIcon(healthData.detailedChecks.filesystem.status)}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">로그 디렉토리:</span>
                    <div className="font-mono text-xs mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                      {healthData.detailedChecks.filesystem.logsDirectory}
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>쓰기 가능</span>
                    <span className="font-medium">
                      {healthData.detailedChecks.filesystem.writable ? '예' : '아니오'}
                    </span>
                  </div>
                  {healthData.detailedChecks.filesystem.error && (
                    <div className="text-sm text-red-600 dark:text-red-400">
                      {healthData.detailedChecks.filesystem.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Environment Check */}
              <div className={`border rounded-lg p-6 ${getStatusColor(healthData.detailedChecks.environment.status)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <Settings className="w-6 h-6 text-orange-500" />
                    <div>
                      <h4 className="font-semibold">환경 변수</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">필수 설정 확인</p>
                    </div>
                  </div>
                  {getStatusIcon(healthData.detailedChecks.environment.status)}
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>필수 변수</span>
                    <span className="font-medium">{healthData.detailedChecks.environment.requiredVariables}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>누락된 변수</span>
                    <span className="font-medium">{healthData.detailedChecks.environment.missingVariables.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>환경</span>
                    <span className="font-medium">{healthData.detailedChecks.environment.nodeEnv}</span>
                  </div>
                  {healthData.detailedChecks.environment.missingVariables.length > 0 && (
                    <div className="text-sm text-red-600 dark:text-red-400">
                      누락: {healthData.detailedChecks.environment.missingVariables.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* System Information */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">시스템 정보</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.floor(healthData.uptime / 1000 / 60)}분
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">가동시간</div>
              </div>
              <div className="text-center">
                <Activity className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {healthData.responseTime}ms
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">응답시간</div>
              </div>
              <div className="text-center">
                <Settings className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {healthData.version}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">버전</div>
              </div>
              <div className="text-center">
                <Database className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {healthData.basicChecks.database.connections}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">DB 연결</div>
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