'use client';

import { useState, useEffect } from 'react';
import { Menu, Moon, Sun, User, Bell, Settings, LogOut, Type, RotateCcw, Plus, Minus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFontSize } from '@/contexts/FontSizeContext';
import Image from 'next/image';

interface HeaderProps {
  toggleSidebar: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export default function Header({ toggleSidebar, isDarkMode, toggleDarkMode }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const { fontSize, setFontSize, increaseFontSize, decreaseFontSize, resetFontSize } = useFontSize();

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
            style={isMounted ? { minHeight: '44px', minWidth: '44px' } : { minHeight: '44px', minWidth: '44px' }}
            suppressHydrationWarning
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="태창금속 로고"
              width={120}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              태창금속(주) ERP
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

          {/* Font Size Control */}
          <div className="relative">
            <button
              onClick={() => setShowFontMenu(!showFontMenu)}
              className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Font size"
              title="글씨 크기 조절"
            >
              <Type className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>

            {showFontMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    글씨 크기
                  </span>
                  <button
                    onClick={() => {
                      resetFontSize();
                      setShowFontMenu(false);
                    }}
                    className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    title="기본값으로 재설정"
                    aria-label="기본값으로 재설정"
                  >
                    <RotateCcw className="w-3 h-3" />
                    초기화
                  </button>
                </div>

                {/* 증가/감소 버튼 (신규) */}
                <div className="flex items-center justify-center gap-3 mb-4">
                  <button
                    onClick={decreaseFontSize}
                    disabled={fontSize <= 12}
                    className={`
                      p-2 rounded-lg border border-gray-300 dark:border-gray-600 transition-all
                      ${fontSize <= 12
                        ? 'opacity-50 cursor-not-allowed text-gray-400'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                      }
                    `}
                    title="글씨 크기 줄이기"
                    aria-label="글씨 크기 줄이기"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg min-w-[100px] justify-center">
                    <Type className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                      {fontSize}px
                    </span>
                  </div>

                  <button
                    onClick={increaseFontSize}
                    disabled={fontSize >= 24}
                    className={`
                      p-2 rounded-lg border border-gray-300 dark:border-gray-600 transition-all
                      ${fontSize >= 24
                        ? 'opacity-50 cursor-not-allowed text-gray-400'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                      }
                    `}
                    title="글씨 크기 키우기"
                    aria-label="글씨 크기 키우기"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* 슬라이더 (기존 유지) */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs text-gray-500 dark:text-gray-400">작게</span>
                  <input
                    type="range"
                    min="12"
                    max="24"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gray-800 dark:accent-gray-300"
                    aria-label="Font size slider"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">크게</span>
                </div>

                {/* 시각적 인디케이터 (신규) */}
                <div className="flex items-center justify-center gap-1.5 mb-3">
                  {[12, 14, 16, 18, 20, 22, 24].map((size) => (
                    <button
                      key={size}
                      onClick={() => setFontSize(size)}
                      className={`
                        w-1.5 rounded-full transition-all duration-200
                        ${Math.abs(fontSize - size) <= 1
                          ? 'bg-gray-800 dark:bg-gray-300 shadow-md transform scale-110'
                          : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                        }
                      `}
                      style={{ height: `${(size / 24) * 32}px` }}
                      title={`${size}px`}
                      aria-label={`글꼴 크기 ${size}px로 설정`}
                    />
                  ))}
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  12px ~ 24px 사이에서 조절 가능합니다
                </p>
              </div>
            )}
          </div>

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