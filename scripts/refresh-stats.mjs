// Refreshes the GitHub star counts on the project cards (content/projects/*/project.json).
// A stat is refreshed when its label mentions "stars" and the project has a github.com link.
// The number keeps the style it was written in: "3,586" stays grouped, "1.2k" stays compact (rounded down).
// It never fails a build: if GitHub can't be reached, the numbers already in the file stay.
//   npm run stats            update the files
//   npm run stats -- --dry   only print what would change
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const DIR = new URL('../content/projects/', import.meta.url)
const dry = process.argv.includes('--dry')
const headers = { accept: 'application/vnd.github+json', 'user-agent': 'portfolio-stats' }
if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`

const compact = (n, k) => (n < 1000 ? String(n) : `${(Math.floor(n / 100) / 10).toString()}${k}`)
const styled = (old, n) => (/k$/i.test(old) ? compact(n, old.slice(-1)) : old.includes(',') ? n.toLocaleString('en-US') : String(n))

async function stars(repo) {
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}`, { headers, signal: AbortSignal.timeout(10_000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return (await r.json()).stargazers_count
  } catch (e) {
    console.warn(`  ${repo}: kept the old number (${e.message})`)
    return null
  }
}

for (const name of readdirSync(DIR).sort()) {
  const file = new URL(`${name}/project.json`, DIR)
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  const p = JSON.parse(text)
  const repo = (p.links ?? []).map((l) => l.url.match(/^https:\/\/github\.com\/([^/]+\/[^/#?]+?)(?:\.git)?\/?$/)?.[1]).find(Boolean)
  if (!repo || !(p.stats ?? []).some((s) => /stars/i.test(s.label))) continue
  const n = await stars(repo)
  if (n == null) continue
  // edit the text in place rather than re-serialising, so the file keeps its hand formatting
  const next = text.replace(/("value":\s*")([^"]*)("\s*,\s*"label":\s*"[^"]*stars[^"]*")/gi, (_, a, old, b) => a + styled(old, n) + b)
  if (next === text) {
    console.log(`  ${name}: ${n} stars, unchanged`)
    continue
  }
  console.log(`  ${name}: ${n} stars${dry ? ' (dry run, not written)' : ''}`)
  if (!dry) writeFileSync(file, next)
}
