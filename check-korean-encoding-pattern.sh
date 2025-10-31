#!/bin/bash

echo "========================================="
echo "한글 인코딩 패턴 검증"
echo "========================================="
echo ""

PASS_COUNT=0
FAIL_COUNT=0
WARNING_COUNT=0

# POST 메서드 검사
echo "[1] POST 메서드 검증..."
echo ""

POST_FILES=$(grep -rl "export async function POST" src/app/api --include="route.ts")

for file in $POST_FILES; do
  # Check if file uses request.text() + JSON.parse()
  if grep -q "await request.text()" "$file" && grep -q "JSON.parse" "$file"; then
    echo "✅ $file"
    ((PASS_COUNT++))
  elif grep -q "await request.json()" "$file"; then
    echo "❌ $file (uses request.json() - may break Korean text)"
    ((FAIL_COUNT++))
  else
    echo "⚠️  $file (pattern unclear - needs manual check)"
    ((WARNING_COUNT++))
  fi
done

echo ""
echo "[2] PUT 메서드 검증..."
echo ""

PUT_FILES=$(grep -rl "export async function PUT" src/app/api --include="route.ts")

for file in $PUT_FILES; do
  # Check if file uses request.text() + JSON.parse()
  if grep -q "await request.text()" "$file" && grep -q "JSON.parse" "$file"; then
    echo "✅ $file"
    ((PASS_COUNT++))
  elif grep -q "await request.json()" "$file"; then
    echo "❌ $file (uses request.json() - may break Korean text)"
    ((FAIL_COUNT++))
  else
    echo "⚠️  $file (pattern unclear - needs manual check)"
    ((WARNING_COUNT++))
  fi
done

echo ""
echo "========================================="
echo "검증 완료"
echo "========================================="
echo "✅ 올바른 패턴: $PASS_COUNT"
echo "❌ 수정 필요: $FAIL_COUNT"
echo "⚠️  수동 확인 필요: $WARNING_COUNT"
echo ""

if [ $FAIL_COUNT -gt 0 ]; then
  echo "주의: $FAIL_COUNT 개의 파일에서 request.json() 사용이 발견되었습니다."
  echo "한글 데이터 처리를 위해 request.text() + JSON.parse() 패턴으로 수정이 필요합니다."
  exit 1
fi

echo "모든 POST/PUT 엔드포인트가 한글 인코딩 패턴을 준수합니다!"
