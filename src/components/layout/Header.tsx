'use client';

import { useState, useEffect } from 'react';
import { Menu, Moon, Sun, User, Bell, Settings, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  toggleSidebar: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export default function Header({ toggleSidebar, isDarkMode, toggleDarkMode }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setUserName(data.user.name || data.user.username);
          setUserRole(data.user.role);
          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
          setUserName('');
          setUserRole('');
        }
      })
      .catch(() => {
        setIsLoggedIn(false);
        setUserName('');
        setUserRole('');
      });
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // 로그아웃 후 강제 새로고침으로 사용자 정보 초기화
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // 에러 발생 시에도 로그인 페이지로 이동
      window.location.href = '/login';
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        {/* Left side */}
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-800 dark:bg-gray-200 rounded-lg flex items-center justify-center">
              <span className="text-white dark:text-gray-900 font-bold text-sm">TC</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              태창 ERP
            </h1>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button
            className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-gray-800 dark:bg-gray-300 rounded-full"></span>
          </button>

          {/* Settings */}
          <button
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={isDarkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
          >
            <div className="relative">
              {isDarkMode ? (
                <Sun className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
            </div>
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-300">
                {isLoggedIn ? userName : '로그인'}
              </span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 py-1">
                {isLoggedIn && userName && (
                  <>
                    <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      {userRole}
                    </div>
                    <a
                      href="#"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      프로필
                    </a>
                    <a
                      href="#"
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      설정
                    </a>
                    <hr className="my-1 border-gray-200 dark:border-gray-700" />
                  </>
                )}
                {isLoggedIn ? (
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    로그아웃
                  </button>
                ) : (
                  <button
                    onClick={() => router.push('/login')}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    로그인
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}