#!/bin/bash
# 새벽 순찰 스크립트 — naesinfit-tests
# 매일 새벽 3시 LaunchAgent에서 자동 실행
# 1) validate --all 전수 검증
# 2) 알려진 사고 패턴 grep 순찰
# 3) Supabase 정답률 이상치 감지
# 결과: /tmp/naesinfit-patrol-YYYY-MM-DD.log

set -u
ROOT="/Users/woobumpark/Desktop/영어해방공식&내신핏/naesinfit-tests"
DATE=$(date +%Y-%m-%d)
LOG="/tmp/naesinfit-patrol-${DATE}.log"
PREV_FAIL_LIST="/tmp/naesinfit-patrol-fails.prev"
CUR_FAIL_LIST="/tmp/naesinfit-patrol-fails.cur"

cd "$ROOT" || { echo "[FATAL] cd failed" > "$LOG"; exit 1; }

{
  echo "================================================"
  echo " naesinfit 새벽 순찰 — $(date '+%Y-%m-%d %H:%M:%S')"
  echo "================================================"

  echo ""
  echo "[1/3] validate --all 실행 중..."
  VALIDATE_OUT=$(node validate/validate.js --all 2>&1)
  echo "$VALIDATE_OUT" | tail -50

  # FAIL 파일 목록 추출
  echo "$VALIDATE_OUT" | grep -E '^\[FAIL\]' | awk '{print $2}' | sort -u > "$CUR_FAIL_LIST"
  FAIL_COUNT=$(wc -l < "$CUR_FAIL_LIST" | tr -d ' ')
  echo ""
  echo ">>> 총 FAIL 파일: $FAIL_COUNT"

  # 신규 FAIL 비교
  if [ -f "$PREV_FAIL_LIST" ]; then
    NEW_FAILS=$(comm -23 "$CUR_FAIL_LIST" "$PREV_FAIL_LIST")
    if [ -n "$NEW_FAILS" ]; then
      echo ""
      echo "!!! 신규 FAIL 감지 !!!"
      echo "$NEW_FAILS"
      NEW_COUNT=$(echo "$NEW_FAILS" | wc -l | tr -d ' ')
      echo ">>> 신규 FAIL: $NEW_COUNT 건"
      # 카톡 알림 자리(추후 등록)
      # osascript -e 'display notification "..."' 도 가능
    else
      echo ">>> 신규 FAIL 없음"
    fi
  else
    echo ">>> 첫 실행 — 비교 대상 없음"
  fi
  cp "$CUR_FAIL_LIST" "$PREV_FAIL_LIST"

  echo ""
  echo "[2/3] 알려진 사고 패턴 grep 순찰..."
  PATTERNS=(
    "It is not mentioned that"
    "원문에 없는 내용"
    "원문에 없음"
    "\\[3점\\]"
    "\\[2점\\]"
    "\\[1점\\]"
  )
  PATTERN_HIT=0
  for P in "${PATTERNS[@]}"; do
    HITS=$(grep -rl --include='*.json' "$P" data/ 2>/dev/null)
    if [ -n "$HITS" ]; then
      COUNT=$(echo "$HITS" | wc -l | tr -d ' ')
      echo "  [HIT] '$P' → $COUNT 파일"
      echo "$HITS" | head -10 | sed 's/^/    /'
      PATTERN_HIT=$((PATTERN_HIT + COUNT))
    fi
  done
  echo ">>> 패턴 적발: $PATTERN_HIT 건"

  echo ""
  echo "[3/3] Supabase 정답률 이상치 감지..."
  if [ -f .env ]; then
    node scripts/anomaly-detector.js 2>&1 || echo "  (anomaly-detector 실행 실패)"
  else
    echo "  (.env 없음 — skip)"
  fi

  echo ""
  echo "================================================"
  echo " 순찰 종료 — $(date '+%H:%M:%S')"
  echo "================================================"
} > "$LOG" 2>&1

# stdout에도 요약
tail -5 "$LOG"
echo "[로그] $LOG"
