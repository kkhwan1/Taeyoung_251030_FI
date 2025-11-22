import { NextPage, NextPageContext } from 'next';

/**
 * Custom Error Page for Pages Router Fallback
 *
 * This file is required for Next.js to properly render error pages
 * when using App Router alongside Pages Router fallback.
 *
 * NOTE: Do NOT import Html from 'next/document' here.
 * Only use regular HTML elements.
 */

interface ErrorProps {
  statusCode: number | undefined;
}

const Error: NextPage<ErrorProps> = ({ statusCode }) => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f3f4f6',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '2rem',
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        maxWidth: '28rem'
      }}>
        <h1 style={{
          fontSize: '3.75rem',
          fontWeight: 'bold',
          color: '#ef4444',
          marginBottom: '1rem'
        }}>
          {statusCode || '오류'}
        </h1>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '1rem'
        }}>
          {statusCode === 404
            ? '페이지를 찾을 수 없습니다'
            : statusCode === 500
            ? '서버 오류가 발생했습니다'
            : '문제가 발생했습니다'}
        </h2>
        <p style={{
          color: '#6b7280',
          marginBottom: '1.5rem'
        }}>
          {statusCode === 404
            ? '요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.'
            : '잠시 후 다시 시도해 주세요.'}
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            padding: '0.5rem 1.5rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: '0.5rem',
            textDecoration: 'none'
          }}
        >
          홈으로 이동
        </a>
      </div>
    </div>
  );
};

Error.getInitialProps = ({ res, err }: NextPageContext): ErrorProps => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
