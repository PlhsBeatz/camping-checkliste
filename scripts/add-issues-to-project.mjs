/**
 * Fügt Issues dem GitHub Project hinzu (addProjectV2ItemById).
 *
 * Env:
 *   GH_PROJECT_TOKEN – Classic PAT mit repo + project
 *   PROJECT_OWNER – Default PlhsBeatz
 *   PROJECT_NUMBER – Pflicht
 *   PROJECT_OWNER_TYPE – user | organization (Default user)
 *   REPO_FULL – Default PlhsBeatz/camping-checkliste
 *   MODE – single | backfill (Default: single wenn ISSUE_NODE_ID, sonst backfill)
 *   ISSUE_NODE_ID – GraphQL node_id eines Issues (Mode single)
 *   LABEL_FILTER – nur Issues mit diesem Label (leer = alle offenen; Default leer)
 */

const TOKEN = (process.env.GH_PROJECT_TOKEN || process.env.GITHUB_TOKEN || '').trim()
const OWNER = (process.env.PROJECT_OWNER || 'PlhsBeatz').trim()
const OWNER_TYPE = (process.env.PROJECT_OWNER_TYPE || 'user').trim().toLowerCase()
const PROJECT_NUMBER = Number(process.env.PROJECT_NUMBER || '0')
const REPO_FULL = (process.env.REPO_FULL || 'PlhsBeatz/camping-checkliste').trim()
const ISSUE_NODE_ID = (process.env.ISSUE_NODE_ID || '').trim()
const LABEL_FILTER =
  process.env.LABEL_FILTER !== undefined ? process.env.LABEL_FILTER.trim() : ''
const MODE =
  (process.env.MODE || '').trim() || (ISSUE_NODE_ID ? 'single' : 'backfill')

if (!TOKEN) {
  console.error('GH_PROJECT_TOKEN fehlt')
  process.exit(1)
}
if (!PROJECT_NUMBER || Number.isNaN(PROJECT_NUMBER)) {
  console.error('PROJECT_NUMBER fehlt')
  process.exit(1)
}

async function ghGraphql(query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'CampCheck-add-to-project',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (!res.ok || json.errors?.length) {
    const msg = json.errors?.map((e) => e.message).join('; ') || JSON.stringify(json).slice(0, 300)
    throw new Error(`GraphQL ${res.status}: ${msg}`)
  }
  return json.data
}

async function ghRest(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'CampCheck-add-to-project',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`REST ${path} → ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

async function getProjectId() {
  const root =
    OWNER_TYPE === 'organization' || OWNER_TYPE === 'org'
      ? `organization(login: $login) { projectV2(number: $number) { id } }`
      : `user(login: $login) { projectV2(number: $number) { id } }`
  const data = await ghGraphql(
    `query($login: String!, $number: Int!) { ${root} }`,
    { login: OWNER, number: PROJECT_NUMBER }
  )
  const project =
    OWNER_TYPE === 'organization' || OWNER_TYPE === 'org'
      ? data.organization?.projectV2
      : data.user?.projectV2
  if (!project?.id) {
    throw new Error(`Project #${PROJECT_NUMBER} für ${OWNER} nicht gefunden`)
  }
  return project.id
}

async function addIssueToProject(projectId, contentId) {
  const data = await ghGraphql(
    `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item { id }
      }
    }
  `,
    { projectId, contentId }
  )
  return data.addProjectV2ItemById?.item?.id ?? null
}

async function listOpenIssueNodeIds() {
  const [owner, repo] = REPO_FULL.split('/')
  const ids = []
  let page = 1
  for (;;) {
    const params = new URLSearchParams({
      state: 'open',
      per_page: '100',
      page: String(page),
    })
    if (LABEL_FILTER) {
      params.set('labels', LABEL_FILTER)
    }
    const issues = await ghRest(`/repos/${owner}/${repo}/issues?${params}`)
    if (!Array.isArray(issues) || issues.length === 0) break
    for (const issue of issues) {
      if (issue.pull_request) continue
      // REST liefert node_id
      if (issue.node_id) ids.push({ number: issue.number, nodeId: issue.node_id })
    }
    if (issues.length < 100) break
    page += 1
  }
  return ids
}

async function main() {
  console.log(
    `Mode=${MODE} owner=${OWNER} project=#${PROJECT_NUMBER} repo=${REPO_FULL} label=${LABEL_FILTER || '(alle)'}`
  )
  const projectId = await getProjectId()

  if (MODE === 'single') {
    if (!ISSUE_NODE_ID) throw new Error('MODE=single braucht ISSUE_NODE_ID')
    const itemId = await addIssueToProject(projectId, ISSUE_NODE_ID)
    console.log(`Added/exists: item ${itemId}`)
    return
  }

  const issues = await listOpenIssueNodeIds()
  console.log(`${issues.length} offene Issues zum Hinzufügen`)
  let ok = 0
  for (const { number, nodeId } of issues) {
    try {
      const itemId = await addIssueToProject(projectId, nodeId)
      console.log(`#${number} → ${itemId}`)
      ok += 1
    } catch (err) {
      console.error(`#${number} fehlgeschlagen:`, err.message || err)
    }
  }
  console.log(`Fertig: ${ok}/${issues.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
