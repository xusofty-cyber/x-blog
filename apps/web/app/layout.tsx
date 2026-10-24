import type { Metadata } from 'next';
import { Libre_Bodoni, Noto_Serif_SC, Public_Sans, Noto_Sans_SC } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const libreBodoni = Libre_Bodoni({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-libre-bodoni',
  weight: ['400', '500', '600', '700'],
});

const notoSerifSC = Noto_Serif_SC({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-serif-sc',
  weight: ['400', '600', '700'],
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-public-sans',
  weight: ['300', '400', '500', '600', '700'],
});

const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-sans-sc',
  weight: ['300', '400', '500', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'X-Blog - 现代全栈博客系统',
    template: '%s | X-Blog',
  },
  description: '基于 Swiss Modernism 2.0 杂志美学与 Next.js 15 App Router 构建的现代深度技术刊物。',
  keywords: ['X-Blog', 'Swiss Modernism', 'Next.js 15', 'NestJS', 'React 19', 'Fullstack Blog', 'Engineering'],
  authors: [{ name: 'X-Blog Editorial Team' }],
  openGraph: {
    title: 'X-Blog - 现代全栈博客系统',
    description: '基于 Swiss Modernism 2.0 与 Next.js 15 App Router 构建的高性能深度技术刊物。',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('xblog_theme');
                  var supportDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'dark' || (!theme && supportDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${libreBodoni.variable} ${notoSerifSC.variable} ${publicSans.variable} ${notoSansSC.variable} font-sans flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-accent selection:text-white`}
      >
        <Header />
        <main className="flex-1 w-full">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
