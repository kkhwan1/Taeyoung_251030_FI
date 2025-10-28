'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/useToast';
import {
  AlertCircle,
  Zap,
  Info
} from 'lucide-react';

interface ErrorStats {
  total_errors: number;
  critical_errors: number;
  high_errors: number;
  medium_errors: number;
  low_errors: number;
  unresolved_errors: number;
  today_errors: number;
  last_24h_errors: number;
  top_error_types: Array<{
    error_type: string;
    count: number;
    percentage: number;
  }>;
  error_trend: Array<{
    date: string;
    count: number;
    critical_count: number;
  }>;
}

interface ErrorLog {
  log_id: number;
  error_type: string;
  message: string;
  details?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status_code: number;
  timestamp: string;
  request_id?: string;
  user_id?: string;
  resource?: string;
  action?: string;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
}

const severityColors = {
  CRITICAL: 'bg-gray-100 text-gray-800 border-gray-200',
  HIGH: 'bg-gray-100 text-gray-800 border-gray-200',
  MEDIUM: 'bg-gray-100 text-gray-800 border-gray-200',
  LOW: 'bg-gray-100 text-gray-800 border-gray-200'
};

const getSeverityIcon = (severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW') => {
  const iconProps = { className: "w-5 h-5" };
  switch (severity) {
    case 'CRITICAL':
      return <AlertCircle {...iconProps} className="w-5 h-5 text-gray-600" />;
    case 'HIGH':
      return <AlertTriangle {...iconProps} className="w-5 h-5 text-gray-600" />;
    case 'MEDIUM':
      return <Zap {...iconProps} className="w-5 h-5 text-gray-600" />;
    case 'LOW':
      return <Info {...iconProps} className="w-5 h-5 text-gray-600" />;
  }
};

export default function ErrorDashboard() {
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [recentErrors, setRecentErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeverity, setSelectedSeverity] = useState<string>('');
  const [timeRange, setTimeRange] = useState(7);
  const { addToast } = useToast();

  // 에러 통계 로드
  const loadErrorStats = async () => {
    try {
      const response = await fetch(`/api/admin/errors/stats?days=${timeRange}`);
      const result = await response.json();

      if (result.success) {
        setStats(result.data);
      } else {
        addToast({ type: 'error', title: '에러 통계 로드 실패', message: '에러 통계를 불러오는데 실패했습니다' });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      addToast({ type: 'error', title: '에러 통계 로드 오류', message: '에러 통계 로드 중 오류가 발생했습니다' });
    }
  };

  // 최근 에러 로그 로드
  const loadRecentErrors = async () => {
    try {
      const params = new URLSearchParams({
        limit: '10',
        ...(selectedSeverity && { severity: selectedSeverity })
      });

      const response = await fetch(`/api/admin/errors?${params}`);
      const result = await response.json();

      if (result.success) {
        setRecentErrors(result.data);
      } else {
        addToast({ type: 'error', title: '최근 에러 로드 실패', message: '최근 에러 로그를 불러오는데 실패했습니다' });
      }
    } catch (error) {
      console.error('Error loading recent errors:', error);
      addToast({ type: 'error', title: '최근 에러 로드 오류', message: '최근 에러 로드 중 오류가 발생했습니다' });
    }
  };

  // 에러 해결 처리
  const resolveError = async (logId: number) => {
    try {
      const response = await fetch('/api/admin/errors', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          log_id: logId,
          resolved_by: 'admin' // 실제 환경에서는 현재 사용자 ID 사용
        })
      });

      const result = await response.json();

      if (result.success) {
        addToast({ type: 'success', title: '에러 해결 완료', message: '에러가 해결로 표시되었습니다' });
        loadRecentErrors();
        loadErrorStats();
      } else {
        addToast({ type: 'error', title: '에러 해결 실패', message: '에러 해결 처리에 실패했습니다' });
      }
    } catch (error) {
      console.error('Error resolving error:', error);
      addToast({ type: 'error', title: '에러 해결 오류', message: '에러 해결 처리 중 오류가 발생했습니다' });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadErrorStats(), loadRecentErrors()]);
      setLoading(false);
    };

    loadData();
  }, [timeRange, selectedSeverity]);

  // 자동 새로고침 (30초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      loadErrorStats();
      loadRecentErrors();
    }, 30000);

    return () => clearInterval(interval);
  }, [timeRange, selectedSeverity]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">에러 모니터링 대시보드</h1>
        <div className="flex space-x-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value={1}>1일</option>
            <option value={7}>7일</option>
            <option value={30}>30일</option>
            <option value={90}>90일</option>
          </select>
          <Button onClick={() => { loadErrorStats(); loadRecentErrors(); }}>
            새로고침
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">총 에러</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_errors.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">최근 {timeRange}일</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">크리티컬 에러</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.critical_errors.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">즉시 조치 필요</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">미해결 에러</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.unresolved_errors.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">해결 대기 중</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">오늘 에러</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{stats.today_errors.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">24시간: {stats.last_24h_errors.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 에러 유형별 통계 */}
      {stats && stats.top_error_types.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>주요 에러 유형</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.top_error_types.slice(0, 5).map((errorType, index) => (
                <div key={errorType.error_type} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-900">
                      {index + 1}. {errorType.error_type}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{errorType.count}회</span>
                    <Badge variant="outline">{errorType.percentage}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 최근 에러 로그 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>최근 에러 로그</CardTitle>
            <div className="flex space-x-2">
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">모든 심각도</option>
                <option value="CRITICAL">크리티컬</option>
                <option value="HIGH">높음</option>
                <option value="MEDIUM">보통</option>
                <option value="LOW">낮음</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentErrors.length === 0 ? (
              <p className="text-gray-500 text-center py-4">에러가 없습니다.</p>
            ) : (
              recentErrors.map((error) => (
                <div key={error.log_id} className="border border-gray-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      {getSeverityIcon(error.severity)}
                      <Badge className={severityColors[error.severity]}>
                        {error.severity}
                      </Badge>
                      <span className="text-sm font-medium">{error.error_type}</span>
                      {error.resolved && <Badge variant="outline" className="bg-gray-50 text-gray-700">해결됨</Badge>}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">
                        {new Date(error.created_at).toLocaleString('ko-KR')}
                      </span>
                      {!error.resolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveError(error.log_id)}
                        >
                          해결 표시
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-gray-700">{error.message}</p>

                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    {error.resource && <span>리소스: {error.resource}</span>}
                    {error.action && <span>액션: {error.action}</span>}
                    {error.user_id && <span>사용자: {error.user_id}</span>}
                    <span>상태코드: {error.status_code}</span>
                  </div>

                  {error.details && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                        상세 정보 보기
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                        {typeof error.details === 'string' ? error.details : JSON.stringify(JSON.parse(error.details), null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 시스템 상태 알림 */}
      {stats && stats.critical_errors > 0 && (
        <Alert className="border-gray-200 bg-gray-50">
          <AlertDescription className="text-gray-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span><strong>{stats.critical_errors}개의 크리티컬 에러</strong>가 발생했습니다. 즉시 조치가 필요합니다.</span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}