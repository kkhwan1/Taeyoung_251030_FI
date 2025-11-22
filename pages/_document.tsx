import { Html, Head, Main, NextScript } from 'next/document';

/**
 * Custom Document for Pages Router Fallback
 * 
 * This file is required for Next.js to properly render error pages
 * when using App Router alongside Pages Router fallback pages.
 */
export default function Document() {
  return (
    <Html lang="ko">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
