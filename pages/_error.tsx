import { NextPageContext } from 'next'

interface ErrorProps {
  statusCode: number
}

function Error({ statusCode }: ErrorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
        <h1 className="text-6xl font-bold text-red-500 mb-4">{statusCode}</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          {statusCode === 404 ? '페이지를 찾을 수 없습니다' : '서버 오류가 발생했습니다'}
        </h2>
        <p className="text-gray-600 mb-6">
          {statusCode === 404
            ? '요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.'
            : '죄송합니다. 서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'}
        </p>
        <a
          href="/"
          className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          홈으로 이동
        </a>
      </div>
    </div>
  )
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode: statusCode || 500 }
}

export default Error
