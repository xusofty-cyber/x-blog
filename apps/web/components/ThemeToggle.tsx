'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hasDarkClass = document.documentElement.classList.contains('dark');
    setIsDark(hasDarkClass);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('xblog_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('xblog_theme', 'light');
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-11 w-11 items-center justify-center rounded-btn border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      aria-label={mounted ? (isDark ? '切换至浅色模式' : '切换至深色模式') : '切换色彩主题'}
      title={mounted ? (isDark ? '切换至浅色模式' : '切换至深色模式') : '切换色彩主题'}
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4 text-foreground transition-transform duration-200" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4 text-foreground transition-transform duration-200" aria-hidden="true" />
        )
      ) : (
        <span className="h-4 w-4 block" aria-hidden="true" />
      )}
    </button>
  );
}
