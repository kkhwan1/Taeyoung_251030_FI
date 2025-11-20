'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  ChevronRight,
  Settings
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

interface MenuItem {
  id: string;
  title: string;
  icon?: React.ReactNode;
  href?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    title: '대시보드',
    children: [
      {
        id: 'main',
        title: '메인 대시보드',
        href: '/'
      }
    ]
  },
  {
    id: 'master',
    title: '기준정보',
    children: [
      {
        id: 'items',
        title: '품목관리',
        href: '/master/items'
      },
      {
        id: 'companies',
        title: '거래처관리',
        href: '/master/companies'
      },
      {
        id: 'bom',
        title: 'BOM관리',
        href: '/master/bom'
      },
      {
        id: 'price-management',
        title: '월별 단가 관리',
        href: '/price-management'
      }
    ]
  },
  {
    id: 'inventory',
    title: '재고관리',
    children: [
      {
        id: 'in',
        title: '입고관리',
        href: '/inventory?tab=receiving'
      },
      {
        id: 'production',
        title: '생산관리',
        href: '/inventory?tab=production'
      },
      {
        id: 'out',
        title: '출고관리',
        href: '/inventory?tab=shipping'
      },
      // 배치 등록 기능 (일시 비활성화)
      // 생산관리 탭으로 충분하여 메뉴에서 숨김 처리
      // 재활성화 시 아래 주석을 제거하세요
      // {
      //   id: 'batch-registration',
      //   title: '배치 등록',
      //   href: '/batch-registration'
      // }
    ]
  },
  {
    id: 'stock',
    title: '재고현황',
    children: [
      {
        id: 'current',
        title: '재고 현황',
        href: '/stock'
      },
      {
        id: 'history',
        title: '재고이력',
        href: '/stock/history'
      },
      {
        id: 'reports',
        title: '재고보고서',
        href: '/stock/reports'
      }
    ]
  },
  {
    id: 'process',
    title: '공정관리',
    children: [
      {
        id: 'process-operations',
        title: '공정 작업',
        href: '/process'
      },
      {
        id: 'coil-tracking',
        title: '코일 공정 추적',
        href: '/process/coil-tracking'
      },
      {
        id: 'traceability',
        title: '추적성 조회',
        href: '/traceability'
      }
    ]
  },
  {
    id: 'accounting',
    title: '회계관리',
    children: [
      {
        id: 'sales',
        title: '매출 관리',
        href: '/sales'
      },
      {
        id: 'purchases',
        title: '매입 관리',
        href: '/purchases'
      },
      {
        id: 'collections',
        title: '수금 관리',
        href: '/collections'
      },
      {
        id: 'payments',
        title: '지급 관리',
        href: '/payments'
      },
      {
        id: 'summary',
        title: '회계 요약',
        href: '/accounting/summary'
      }
    ]
  },
  {
    id: 'monitoring',
    title: '시스템 모니터링',
    children: [
      {
        id: 'dashboard',
        title: '모니터링 대시보드',
        href: '/monitoring'
      },
      {
        id: 'health',
        title: '헬스체크',
        href: '/monitoring/health'
      },
      {
        id: 'users',
        title: '사용자 관리',
        href: '/admin/users'
      }
    ]
  },
  {
    id: 'contracts',
    title: '계약 관리',
    href: '/contracts'
  }
];

export default function Sidebar({ isOpen, toggleSidebar }: SidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(['dashboard', 'master', 'inventory', 'stock', 'process', 'accounting', 'monitoring']);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUserRole(data.user.role);
        }
      })
      .catch(err => console.error('Failed to fetch user role:', err));
  }, []);

  // 메뉴 아이템 필터링
  const filteredMenuItems = useMemo(() => {
    if (!userRole) return menuItems;
    
    return menuItems.map(item => {
      // 사용자 관리는 admin, ceo만 표시
      if (item.id === 'monitoring' && item.children) {
        if (userRole !== 'admin' && userRole !== 'ceo') {
          return {
            ...item,
            children: item.children.filter(child => child.id !== 'users')
          };
        }
      }
      return item;
    });
  }, [userRole]);

  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const renderMenuItem = (item: MenuItem, depth = 0) => {
    // Check if the current path matches the menu item
    // Handle both exact matches and URL parameter matches for inventory
    const isActive = item.href && (
      pathname === item.href ||
      (pathname === '/inventory' && item.href.startsWith('/inventory?'))
    );
    const isExpanded = expandedItems.includes(item.id);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <div key={item.id}>
        {item.href ? (
          <Link
            href={item.href}
            prefetch={true}
            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${
              depth > 0 ? 'pl-12' : ''
            } ${
              isActive
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-l-4 border-gray-800 dark:border-gray-200'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-l-4 border-transparent'
            }`}
          >
            <span className={`${!isOpen && 'hidden'}`}>{item.title}</span>
          </Link>
        ) : (
          <button
            onClick={() => hasChildren && toggleExpand(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${
              depth > 0 ? 'pl-12' : ''
            } text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800`}
          >
            <span className={`flex-1 text-left ${!isOpen && 'hidden'}`}>
              {item.title}
            </span>
            {hasChildren && isOpen && (
              <span className="ml-auto">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
            )}
          </button>
        )}

        {hasChildren && isExpanded && isOpen && (
          <div className="bg-gray-50 dark:bg-gray-800/50">
            {item.children!.map(child => renderMenuItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-40 ${
          isOpen ? 'w-64' : 'w-16'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            {filteredMenuItems.map(item => renderMenuItem(item))}
          </nav>

          {/* Bottom section */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <button
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
            >
              <Settings className="w-5 h-5" />
              <span className={`${!isOpen && 'hidden'}`}>설정</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}