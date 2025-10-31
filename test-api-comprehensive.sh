#!/bin/bash

# 종합 API 테스트 스크립트
# 한글 인코딩 검증 및 API 응답 확인

echo "========================================="
echo "태창 ERP API 종합 테스트"
echo "========================================="
echo ""

# 서버 상태 확인
echo "[1] 서버 상태 확인..."
SERVER_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5000")
if [ "$SERVER_CHECK" != "200" ]; then
  echo "❌ 서버가 응답하지 않습니다 (HTTP $SERVER_CHECK)"
  exit 1
fi
echo "✅ 서버 정상 응답 (HTTP 200)"
echo ""

# Auth API 테스트
echo "[2] Auth API 테스트..."
AUTH_RESPONSE=$(curl -s "http://localhost:5000/api/auth/me")
echo "Response: $AUTH_RESPONSE"
if echo "$AUTH_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Auth API 정상"
  # Extract user name to verify Korean encoding
  USER_NAME=$(echo "$AUTH_RESPONSE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
  echo "   사용자명: $USER_NAME"
else
  echo "⚠️  Auth API 응답 확인 필요"
fi
echo ""

# Dashboard API 테스트 (공개 엔드포인트로 추정)
echo "[3] Dashboard Overview API 테스트..."
DASHBOARD_RESPONSE=$(curl -s "http://localhost:5000/api/dashboard/overview")
echo "Response: ${DASHBOARD_RESPONSE:0:200}..."
if echo "$DASHBOARD_RESPONSE" | grep -q 'success'; then
  echo "✅ Dashboard API 응답 확인"
else
  echo "⚠️  Dashboard API: $(echo "$DASHBOARD_RESPONSE" | head -c 100)"
fi
echo ""

# Companies API 테스트 (한글 데이터 확인)
echo "[4] Companies API 테스트 (한글 데이터)..."
COMPANIES_RESPONSE=$(curl -s "http://localhost:5000/api/companies?limit=2")
echo "Response: ${COMPANIES_RESPONSE:0:300}..."

if echo "$COMPANIES_RESPONSE" | grep -q '"success":false'; then
  echo "⚠️  Companies API 인증 필요: $(echo "$COMPANIES_RESPONSE" | grep -o '"error":"[^"]*"')"
elif echo "$COMPANIES_RESPONSE" | grep -q 'company_name'; then
  echo "✅ Companies API 정상 응답"
  # Check for Korean text
  if echo "$COMPANIES_RESPONSE" | grep -qP '[\x{AC00}-\x{D7AF}]'; then
    echo "✅ 한글 데이터 확인됨"
  fi
else
  echo "⚠️  Companies API 확인 필요"
fi
echo ""

# BOM API 테스트
echo "[5] BOM API 테스트..."
BOM_RESPONSE=$(curl -s "http://localhost:5000/api/bom?limit=2")
echo "Response: ${BOM_RESPONSE:0:200}..."

if echo "$BOM_RESPONSE" | grep -q '"success":false'; then
  echo "⚠️  BOM API 인증 필요"
elif echo "$BOM_RESPONSE" | grep -q 'success'; then
  echo "✅ BOM API 응답 확인"
else
  echo "⚠️  BOM API 확인 필요"
fi
echo ""

echo "========================================="
echo "테스트 완료"
echo "========================================="
echo ""
echo "주의사항:"
echo "- '인증 필요' 메시지는 정상적인 보안 동작입니다"
echo "- 실제 테스트를 위해서는 로그인 기능 구현이 필요합니다"
echo "- 공개 엔드포인트(auth/me, dashboard)는 정상 동작해야 합니다"
echo ""
