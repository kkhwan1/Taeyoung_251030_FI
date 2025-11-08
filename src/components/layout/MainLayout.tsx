'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/stores/useAppStore';
import Header from './Header';
import Sidebar from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  // Use Zustand store instead of local state
  const theme = useAppStore((state) => state.theme);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed);

  const isDarkMode = theme === 'dark';
  const isSidebarOpen = !sidebarCollapsed;

  // Load theme preference on mount and apply to DOM
  useEffect(() => {
    // Add preload class to prevent transition flashing during initial load
    document.body.classList.add('preload');

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Remove preload class after a short delay to enable transitions
    setTimeout(() => {
      document.body.classList.remove('preload');
    }, 100);
  }, [theme]);

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setSidebarCollapsed]);

  const handleToggleSidebar = () => {
    toggleSidebar();
  };

  const handleToggleDarkMode = () => {
    toggleTheme();
  };

  // 로그인 페이지면 헤더/사이드바 없이 children만 렌더링
  if (isLoginPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header
        toggleSidebar={handleToggleSidebar}
        isDarkMode={isDarkMode}
        toggleDarkMode={handleToggleDarkMode}
      />

      <Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={handleToggleSidebar}
      />

      <main
        className={`pt-4 px-4 md:px-6 ${
          isSidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
        }`}
      >
        <div className="max-w-[1920px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}