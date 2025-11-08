export default function Custom500() {
  return (
    <html>
      <head>
        <title>500 - 서버 오류</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          padding: '1rem'
        }}>
          <div style={{
            maxWidth: '28rem',
            width: '100%',
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <svg
                style={{
                  height: '4rem',
                  width: '4rem',
                  color: '#ef4444',
                  margin: '0 auto'
                }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '0.5rem'
            }}>
              500 - 서버 오류
            </h1>

            <p style={{
              color: '#6b7280',
              marginBottom: '1.5rem'
            }}>
              서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <a
                href="/"
                style={{
                  width: '100%',
                  backgroundColor: '#4b5563',
                  color: 'white',
                  fontWeight: '500',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  display: 'inline-block',
                  textDecoration: 'none'
                }}
              >
                홈으로 이동
              </a>

              <p style={{
                color: '#6b7280',
                fontSize: '0.875rem',
                marginTop: '0.5rem'
              }}>
                페이지를 새로고침하려면 브라우저의 새로고침 버튼을 사용하세요.
              </p>
            </div>

            <div style={{
              marginTop: '1.5rem',
              fontSize: '0.75rem',
              color: '#9ca3af'
            }}>
              <p>문제가 지속되면 관리자에게 문의해주세요.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
