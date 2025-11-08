import fs from 'fs'
import path from 'path'
import { quizSchema } from '@/lib/quiz-schema'

type MCQ = { id: string; type: 'mcq'; prompt: string; options: string[]; answer: string }
type Short = { id: string; type: 'short'; prompt: string; answer: string }
type Long = { id: string; type: 'long'; prompt: string; answer: string }
type Quiz = { questions: (MCQ | Short | Long)[] }

const FIXTURE_DIR = path.resolve(process.cwd(), 'fixtures')
const FILES = ['quiz_cs.json', 'quiz_bio.json']

function readFixture(name: string): Quiz {
  const p = path.join(FIXTURE_DIR, name)
  const raw = fs.readFileSync(p, 'utf-8')
  return JSON.parse(raw)
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

function checkUniqIds(q: Quiz) {
  const ids = q.questions.map(q => q.id)
  const uniq = new Set(ids)
  assert(uniq.size === ids.length, 'Question IDs must be unique')
}

function checkMcqRules(q: Quiz) {
  for (const item of q.questions) {
    if (item.type !== 'mcq') continue
    assert(Array.isArray(item.options), `MCQ ${item.id} options missing`)
    assert(item.options.length >= 3 && item.options.length <= 5, `MCQ ${item.id} must have 3–5 options`)
    const set = new Set(item.options)
    assert(set.size === item.options.length, `MCQ ${item.id} options must be distinct`)
    assert(item.options.includes(item.answer), `MCQ ${item.id} answer must equal one option`)
  }
}

function checkPromptLengths(q: Quiz) {
  for (const item of q.questions) {
    const maxLength = item.type === 'long' ? 300 : 180
    assert(item.prompt.length <= maxLength, `Prompt too long on ${item.id} (${item.prompt.length} chars, max ${maxLength})`)
  }
}

function runOne(name: string) {
  const json = readFixture(name)
  const parsed = quizSchema.parse(json) // Zod shape check
  checkUniqIds(parsed)
  checkMcqRules(parsed)
  checkPromptLengths(parsed)
  return parsed.questions.length
}

try {
  console.log('--- Fixture sanity check ---')
  for (const f of FILES) {
    const count = runOne(f)
    console.log(`✅ ${f} passed (${count} questions)`)
  }
  console.log('All fixtures valid.\n')
} catch (e: any) {
  console.error('❌ Fixture failed:', e.message)
  process.exit(1)
}
