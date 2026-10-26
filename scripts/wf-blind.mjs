export const meta = {
  name: 'bimunhak-blind-verify',
  description: '비문학 60테스트 블라인드 검증 — 정답/해설 가리고 MC 독립 재풀이 → ans 불일치 플래그',
  phases: [{ title: 'Blind' }],
}
const ROOT = '/Users/woobumpark/nf-tests-deploy'
import('node:fs') // noop for parity

const GANGS = [5, 8, 9, 10], TYPES = ['단어', '워크북', '퀴즈']
const items = []
for (const g of GANGS) for (let n = 1; n <= 5; n++) for (const t of TYPES) items.push({ g, n, type: t })

phase('Blind')
const SCHEMA = {
  type: 'object', required: ['file', 'mismatches'],
  properties: {
    file: { type: 'string' },
    mismatches: {
      type: 'array',
      items: {
        type: 'object',
        required: ['qid', 'myAns', 'storedAns', 'reason'],
        properties: {
          qid: { type: 'number' }, myAns: { type: 'number' },
          storedAns: { type: 'number' }, reason: { type: 'string' },
        },
      },
    },
  },
}

function mkThunk({ g, n, type }) {
  return async () => {
    const f = `${ROOT}/data/부교재/올림포스고급영미비문학/2025/${g}강/${n}번/${type}.json`
    const prompt = `너는 영어 시험 블라인드 채점관이다. 아래 테스트 JSON의 객관식(fmt=mc) 문항을 **정답(ans)·해설(det)을 절대 보지 말고** 네가 직접 풀어라.

파일: \`cat "${f}"\` 로 읽되, 각 문항의 passage·stem·ch(선지)만 보고 정답을 구한다. ans/det 필드는 보지 않는다(이미 봤더라도 무시하고 순수하게 지문 근거로만 판단).

규칙:
- ans는 **1-based**(①=1,②=2,③=3,④=4). 마커형(어법/부적절/삽입/오류)은 마커 번호, 일반형은 선지 순번.
- 각 mc 문항에 대해 네가 고른 답(myAns, 1-based)을 정한다.
- 그 다음에만 저장된 ans를 보고 비교. **다르면** mismatches에 {qid, myAns, storedAns(저장된 ans), reason(왜 네 답이 맞는지 지문 근거)} 추가.
- written 문항은 건너뛴다.
- 애매하거나 복수정답 소지가 있으면 그것도 mismatch로 보고(reason에 '복수정답/모호' 명시).

반환 JSON: {"file":"${g}강${n}번${type}","mismatches":[...]}  (불일치 없으면 빈 배열)`
    return await agent(prompt, { label: `blind ${g}강${n}번${type}`, phase: 'Blind', model: 'sonnet', schema: SCHEMA })
  }
}
// 5개씩 배치 — 리포트 워크플로우와 동시 실행 시 서버 throttle 회피
const results = []
for (let i = 0; i < items.length; i += 5) {
  const r = await parallel(items.slice(i, i + 5).map(mkThunk))
  results.push(...r)
}

const clean = results.filter(Boolean)
const withMM = clean.filter(r => r.mismatches && r.mismatches.length)
const totalMM = withMM.reduce((s, r) => s + r.mismatches.length, 0)
log(`블라인드 완료: 불일치 테스트 ${withMM.length}/${clean.length}, 총 ${totalMM}건`)
return { checked: clean.length, filesWithMismatch: withMM.length, totalMismatches: totalMM, details: withMM }
