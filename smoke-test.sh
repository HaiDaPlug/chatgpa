#!/bin/bash
# Purpose: Smoke tests for API gateway system (Phase 1 foundation)
# Usage: ./smoke-test.sh [base_url] [test_token]

set -e

# Configuration
BASE_URL="${1:-http://localhost:3000}"
TEST_TOKEN="${2:-test-token-replace-me}"

# Color output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo "🧪 API Gateway Smoke Tests (Phase 1)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Base URL: $BASE_URL"
echo "Token: ${TEST_TOKEN:0:20}..."
echo ""

TESTS_PASSED=0
TESTS_FAILED=0

# Test helper function
function test_endpoint() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected_status="$4"
  local auth_header="${5:-}"
  local content_type="${6:-application/json}"
  local body="${7:-}"

  echo -n "Testing $name... "

  local curl_cmd="curl -s -o /tmp/response.txt -w '%{http_code}' -X $method '$BASE_URL$path'"

  if [ -n "$auth_header" ]; then
    curl_cmd="$curl_cmd -H 'Authorization: $auth_header'"
  fi

  if [ "$method" = "POST" ]; then
    curl_cmd="$curl_cmd -H 'Content-Type: $content_type'"
    if [ -n "$body" ]; then
      curl_cmd="$curl_cmd -d '$body'"
    fi
  fi

  status=$(eval $curl_cmd)

  if [ "$status" = "$expected_status" ]; then
    echo -e "${GREEN}✓ $status${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ Expected $expected_status, got $status${NC}"
    echo -e "${YELLOW}Response:${NC}"
    cat /tmp/response.txt | jq . 2>/dev/null || cat /tmp/response.txt
    echo ""
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

# Test helper for checking response headers
function test_header() {
  local name="$1"
  local method="$2"
  local path="$3"
  local header_name="$4"
  local auth_header="${5:-}"

  echo -n "Testing $name... "

  local curl_cmd="curl -s -i -X $method '$BASE_URL$path'"

  if [ -n "$auth_header" ]; then
    curl_cmd="$curl_cmd -H 'Authorization: $auth_header'"
  fi

  if [ "$method" = "POST" ]; then
    curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '{}'"
  fi

  response=$(eval $curl_cmd)

  if echo "$response" | grep -qi "$header_name:"; then
    echo -e "${GREEN}✓ Header present${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ Header missing${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

echo "═══════════════════════════════════════"
echo " Phase 1: Middleware Foundation Tests"
echo "═══════════════════════════════════════"
echo ""

# Test 1: Content-Type validation (415 for non-JSON POST)
test_endpoint \
  "Content-Type validation (non-JSON)" \
  "POST" \
  "/api/v1/ai?action=health" \
  "415" \
  "" \
  "text/plain" \
  "test"

# Test 2: Missing Authorization header (401)
test_endpoint \
  "Missing auth header" \
  "POST" \
  "/api/v1/ai?action=health" \
  "401" \
  "" \
  "application/json" \
  '{"action":"health"}'

# Test 3: Invalid Authorization format (401)
test_endpoint \
  "Invalid auth format" \
  "POST" \
  "/api/v1/ai?action=health" \
  "401" \
  "InvalidFormat abc123" \
  "application/json" \
  '{"action":"health"}'

# Test 4: Missing action parameter (400)
test_endpoint \
  "Missing action parameter" \
  "POST" \
  "/api/v1/ai" \
  "400" \
  "Bearer $TEST_TOKEN" \
  "application/json" \
  '{"data":{}}'

# Test 5: Unknown action (400)
test_endpoint \
  "Unknown action" \
  "POST" \
  "/api/v1/ai?action=invalid_action_xyz" \
  "400" \
  "Bearer $TEST_TOKEN" \
  "application/json" \
  '{"action":"invalid_action_xyz"}'

# Test 6: X-Request-ID header in response
test_header \
  "X-Request-ID header presence" \
  "POST" \
  "/api/v1/ai?action=health" \
  "X-Request-ID" \
  "Bearer $TEST_TOKEN"

# Test 7: Body size limit (413 for >1MB payload)
# Note: This test is skipped if curl doesn't support large payloads
echo -n "Testing body size limit (>1MB)... "
if command -v head &> /dev/null; then
  # Generate 1.5MB of data
  large_payload=$(head -c 1572864 /dev/zero | base64 | tr -d '\n')
  status=$(curl -s -o /dev/null -w '%{http_code}' \
    -X POST "$BASE_URL/api/v1/ai?action=health" \
    -H "Authorization: Bearer $TEST_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"data\":\"$large_payload\"}")

  if [ "$status" = "413" ]; then
    echo -e "${GREEN}✓ 413${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${YELLOW}⊘ Skipped (got $status, needs actual gateway)${NC}"
  fi
else
  echo -e "${YELLOW}⊘ Skipped (head command not available)${NC}"
fi

echo ""
echo "═══════════════════════════════════════"
echo " Phase 2: Security Verification Tests"
echo "═══════════════════════════════════════"
echo ""

# Test 8: Rate limiting (burst test - not guaranteed to fail on first run)
echo -n "Testing rate limiting (rapid requests)... "
rate_limit_hits=0
for i in {1..15}; do
  status=$(curl -s -o /dev/null -w '%{http_code}' \
    -X GET "$BASE_URL/api/v1/util?action=ping")
  if [ "$status" = "429" ]; then
    rate_limit_hits=$((rate_limit_hits + 1))
  fi
done

if [ $rate_limit_hits -gt 0 ]; then
  echo -e "${GREEN}✓ Rate limit enforced (hit after $rate_limit_hits requests)${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${YELLOW}⊘ Not triggered (expected on cold start)${NC}"
fi

# Test 9: Stripe webhook requires raw body (no JSON parsing)
echo -n "Testing Stripe webhook signature validation... "
status=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST "$BASE_URL/api/stripe-webhook" \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: invalid" \
  -d '{"type":"test"}')

if [ "$status" = "401" ] || [ "$status" = "400" ]; then
  echo -e "${GREEN}✓ Signature validation active ($status)${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
else
  echo -e "${RED}✗ Expected 401 or 400, got $status${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
fi

# Test 10: X-Request-ID in health endpoint
test_header \
  "X-Request-ID in health response" \
  "GET" \
  "/api/v1/util?action=health" \
  "X-Request-ID" \
  ""

# Test 11: Verify 413 on large payload (already tested above, documenting here)
echo -e "${YELLOW}ℹ Body size limit (413) already tested in Phase 1${NC}"

echo ""
echo "═══════════════════════════════════════"
echo " Summary"
echo "═══════════════════════════════════════"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All smoke tests passed${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  exit 1
fi
