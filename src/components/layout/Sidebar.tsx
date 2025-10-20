'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Package,
  Database,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Box,
  Users,
  FileText,
  Settings,
  Layers,
  Truck,
  Monitor,
  Activity,
  Calculator,
  DollarSign,
  ShoppingCart,
  CreditCard,
  Wallet,
  TrendingUp
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

interface MenuItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  href?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    title: '대시보드',
    icon: <Home className="w-5 h-5" />,
    children: [
      {
        id: 'main',
        title: '메인 대시보드',
        icon: <Home className="w-5 h-5" />,
        href: '/'
      }
    ]
  },
  {
    id: 'master',
    title: '기준정보',
    icon: <Database className="w-5 h-5" />,
    children: [
      {
        id: 'items',
        title: '품목관리',
        icon: <Package className="w-5 h-5" />,
        href: '/master/items'
      },
      {
        id: 'companies',
        title: '거래처관리',
        icon: <Users className="w-5 h-5" />,
        href: '/master/companies'
      },
      {
        id: 'bom',
        title: 'BOM관리',
        icon: <Layers className="w-5 h-5" />,
        href: '/master/bom'
      },
      {
        id: 'price-management',
        title: '월별 단가 관리',
        icon: <TrendingUp className="w-5 h-5" />,
        href: '/price-management'
      }
    ]
  },
  {
    id: 'inventory',
    title: '재고관리',
    icon: <Box className="w-5 h-5" />,
    children: [
      {
        id: 'in',
        title: '입고관리',
        icon: <Truck className="w-5 h-5" />,
        href: '/inventory?tab=receiving'
      },
      {
        id: 'production',
        title: '생산관리',
        icon: <Package className="w-5 h-5" />,
        href: '/inventory?tab=production'
      },
      {
        id: 'out',
        title: '출고관리',
        icon: <Truck className="w-5 h-5" />,
        href: '/inventory?tab=shipping'
      }
    ]
  },
  {
    id: 'stock',
    title: '재고현황',
    icon: <BarChart3 className="w-5 h-5" />,
    children: [
      {
        id: 'current',
        title: '재고 현황',
        icon: <Package className="w-5 h-5" />,
        href: '/stock'
      },
      {
        id: 'history',
        title: '재고이력',
        icon: <FileText className="w-5 h-5" />,
        href: '/stock/history'
      },
      {
        id: 'reports',
        title: '재고보고서',
        icon: <FileText className="w-5 h-5" />,
        href: '/stock/reports'
      }
    ]
  },
  {
    id: 'accounting',
    title: '회계관리',
    icon: <Calculator className="w-5 h-5" />,
    children: [
      {
        id: 'sales',
        title: '매출 관리',
        icon: <DollarSign className="w-5 h-5" />,
        href: '/sales'
      },
      {
        id: 'purchases',
        title: '매입 관리',
        icon: <ShoppingCart className="w-5 h-5" />,
        href: '/purchases'
      },
      {
        id: 'collections',
        title: '수금 관리',
        icon: <CreditCard className="w-5 h-5" />,
        href: '/collections'
      },
      {
        id: 'payments',
        title: '지급 관리',
        icon: <Wallet className="w-5 h-5" />,
        href: '/payments'
      },
      {
        id: 'summary',
        title: '회계 요약',
        icon: <BarChart3 className="w-5 h-5" />,
        href: '/accounting/summary'
      }
    ]
  },
  {
    id: 'monitoring',
    title: '시스템 모니터링',
    icon: <Monitor className="w-5 h-5" />,
    children: [
      {
        id: 'dashboard',
        title: '모니터링 대시보드',
        icon: <Activity className="w-5 h-5" />,
        href: '/monitoring'
      },
      {
        id: 'health',
        title: '헬스체크',
        icon: <Settings className="w-5 h-5" />,
        href: '/monitoring/health'
      }
    ]
  }
];

export default function Sidebar({ isOpen, toggleSidebar }: SidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(['dashboard', 'master', 'inventory', 'stock', 'accounting', 'monitoring']);

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
            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
              depth > 0 ? 'pl-12' : ''
            } ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-l-4 border-transparent'
            }`}
          >
            {item.icon}
            <span className={`${!isOpen && 'hidden'}`}>{item.title}</span>
          </Link>
        ) : (
          <button
            onClick={() => hasChildren && toggleExpand(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
              depth > 0 ? 'pl-12' : ''
            } text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800`}
          >
            {item.icon}
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
        className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 z-40 ${
          isOpen ? 'w-64' : 'w-16'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            {menuItems.map(item => renderMenuItem(item))}
          </nav>

          {/* Bottom section */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <button
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
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