'use client';

/**
 * Portal Dashboard Page
 *
 * Main dashboard for portal users (suppliers/customers)
 * Path: /portal/dashboard
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Info } from 'lucide-react';

interface SessionInfo {
  username: string;
  role: 'CUSTOMER' | 'SUPPLIER' | 'ADMIN';
  companyName: string;
}

export default function PortalDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    // Check session validity
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      // Try to fetch user data (will fail if not authenticated)
      const response = await fetch('/api/portal/transactions?limit=1');
      const data = await response.json();

      if (data.success) {
        setSession({
          username: data.data.companyName,
          role: data.data.role,
          companyName: data.data.companyName,
        });
      } else {
        // Not authenticated, redirect to login
        router.push('/portal/login');
      }
    } catch (error) {
      console.error('Session check error:', error);
      router.push('/portal/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/portal/auth/logout', { method: 'POST' });
      router.push('/portal/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-500 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Redirecting...
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'CUSTOMER':
        return '고객사';
      case 'SUPPLIER':
        return '공급사';
      case 'ADMIN':
        return '관리자';
      default:
        return role;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                태창 ERP 거래처 포털
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {session.companyName} ({getRoleLabel(session.role)})
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            환영합니다!
          </h2>
          <p className="text-gray-600">
            포털을 통해 거래 내역과 품목 정보를 확인하실 수 있습니다.
          </p>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Transactions Card */}
          <Link
            href="/portal/transactions"
            className="block bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors p-6 border-l-4 border-gray-600 dark:border-gray-600"
          >
            <div className="flex items-center mb-4">
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <svg
                  className="w-6 h-6 text-gray-600 dark:text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900">
                거래 내역
              </h3>
            </div>
            <p className="text-gray-600 text-sm">
              {session.role === 'CUSTOMER'
                ? '매출 거래 내역을 확인하세요'
                : '매입 거래 내역을 확인하세요'}
            </p>
            <div className="mt-4 flex items-center text-gray-600 dark:text-gray-400 font-medium">
              <span>보러가기</span>
              <svg
                className="w-4 h-4 ml-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>

          {/* Items Card */}
          <Link
            href="/portal/items"
            className="block bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors p-6 border-l-4 border-gray-600 dark:border-gray-600"
          >
            <div className="flex items-center mb-4">
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <svg
                  className="w-6 h-6 text-gray-600 dark:text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900">
                품목 정보
              </h3>
            </div>
            <p className="text-gray-600 text-sm">
              거래 품목 정보를 확인하세요
            </p>
            <div className="mt-4 flex items-center text-gray-600 dark:text-gray-400 font-medium">
              <span>보러가기</span>
              <svg
                className="w-4 h-4 ml-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <Info className="w-5 h-5" />
            안내사항
          </h3>
          <ul className="space-y-2 text-sm text-gray-800 dark:text-gray-300">
            <li>• 거래 내역은 실시간으로 업데이트됩니다.</li>
            <li>• 문의사항은 담당자에게 연락주시기 바랍니다.</li>
            <li>• 보안을 위해 사용 후 반드시 로그아웃하세요.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
