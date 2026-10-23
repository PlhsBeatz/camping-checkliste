/**
 * Spiegelt GitHub Project Status → Issue-Labels (roadmap + status:*).
 *
 * Env:
 *   GH_PROJECT_TOKEN oder GITHUB_TOKEN – PAT mit Issues + Projects
 *   PROJECT_OWNER – z. B. PlhsBeatz (Default)
 *   PROJECT_NUMBER – Project-Nummer aus der URL …/projects/N
 *   PROJECT_OWNER_TYPE – user | organization (Default: user)
 *   ITEM_NODE_ID – optional: einzelnes ProjectV2Item (Event)
 *   MODE – item | backfill (Default: item wenn ITEM_NODE_ID, sonst backfill)
 *   REPO_FULL – nur Issues dieses Repos (Default: PlhsBeatz/camping-checkliste)
 */

const TOKEN = (process.env.GH_PROJECT_TOKEN || process.env.GITHUB_TOKEN || '').trim()
const OWNER = (process.env.PROJECT_OWNER || 'PlhsBeatz').trim()
const OWNER_TYPE = (process.env.PROJECT_OWNER_TYPE || 'user').trim().toLowerCase()
const PROJECT_NUMBER = Number(process.env.PROJECT_NUMBER || '0')
const REPO_FULL = (process.env.REPO_FULL || 'PlhsBeatz/camping-checkliste').trim()
const ITEM_NODE_ID = (process.env.ITEM_NODE_ID || '').trim()
const MODE =
  (process.env.MODE || '').trim() || (ITEM_NODE_ID ? 'item' : 'backfill')

const STATUS_FIELD_NAME = 'Status'

const ALL_MIRROR_LABELS = [
  'roadmap',
  'status:todo',
  'status:in-progress',
  'status:in-test',
  'status:geplant',
  'status:in-arbeit',
  'status:erledigt',
  'status:done',
]

/** @type {Record<string, string[]>} */
const STATUS_TO_LABELS = {
  Backlog: [],
  Todo: ['roadmap', 'status:todo'],
  'In Progress': ['roadmap', 'status:in-progress'],
  'In Test': ['roadmap', 'status:in-test'],
  Done: ['roadmap'],
}

if (!TOKEN) {
  console.error('GH_PROJECT_TOKEN / GITHUB_TOKEN fehlt')
  process.exit(1)
}
if (!PROJECT_NUMBER || Number.isNaN(PROJECT_NUMBER)) {
  console.error('PROJECT_NUMBER fehlt oder ist ungültig (z. B. 1 aus …/projects/1)')
  process.exit(1)
}

async function ghGraphql(query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'CampCheck-project-sync',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (!res.ok || json.errors?.length) {
    const msg = json.errors?.map((e) => e.message).join('; ') || (await res.text().catch(() => ''))
    throw new Error(`GraphQL ${res.status}: ${msg || JSON.stringify(json).slice(0, 300)}`)
  }
  return json.data
}

async function ghRest(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'CampCheck-project-sync',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`REST ${path} → ${res.status}: ${text.slice(0, 200)}`)
  }
  if (res.status === 204) return null
  return res.json()
}

function projectRootQuery() {
  if (OWNER_TYPE === 'organization' || OWNER_TYPE === 'org') {
    return `
      organization(login: $login) {
        projectV2(number: $number) { id }
      }
    `
  }
  return `
    user(login: $login) {
      projectV2(number: $number) { id }
    }
  `
}

function projectRootData(data) {
  if (OWNER_TYPE === 'organization' || OWNER_TYPE === 'org') {
    return data.organization?.projectV2
  }
  return data.user?.projectV2
}

async function getProjectId() {
  const data = await ghGraphql(
    `
    query($login: String!, $number: Int!) {
      ${projectRootQuery()}
    }
  `,
    { login: OWNER, number: PROJECT_NUMBER }
  )
  const project = projectRootData(data)
  if (!project?.id) {
    throw new Error(`Project #${PROJECT_NUMBER} für ${OWNER_TYPE} ${OWNER} nicht gefunden`)
  }
  return project.id
}

/**
 * @param {string} itemId
 * @returns {Promise<{ status: string | null, issueNumber: number | null, repo: string | null }>}
 */
async function getItemInfo(itemId) {
  const data = await ghGraphql(
    `
    query($id: ID!) {
      node(id: $id) {
        ... on ProjectV2Item {
          fieldValueByName(name: "${STATUS_FIELD_NAME}") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
            }
          }
          content {
            __typename
            ... on Issue {
              number
              repository { nameWithOwner }
            }
          }
        }
      }
    }
  `,
    { id: itemId }
  )
  const node = data.node
  if (!node) return { status: null, issueNumber: null, repo: null }
  const content = node.content
  if (!content || content.__typename !== 'Issue') {
    return { status: null, issueNumber: null, repo: null }
  }
  return {
    status: node.fieldValueByName?.name ?? null,
    issueNumber: content.number ?? null,
    repo: content.repository?.nameWithOwner ?? null,
  }
}

/**
 * @param {string} projectId
 */
async function* iterateProjectItems(projectId) {
  let cursor = null
  for (;;) {
    const data = await ghGraphql(
      `
      query($id: ID!, $cursor: String) {
        node(id: $id) {
          ... on ProjectV2 {
            items(first: 50, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id
                fieldValueByName(name: "${STATUS_FIELD_NAME}") {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                  }
                }
                content {
                  __typename
                  ... on Issue {
                    number
                    repository { nameWithOwner }
                  }
                }
              }
            }
          }
        }
      }
    `,
      { id: projectId, cursor }
    )
    const items = data.node?.items
    if (!items) break
    for (const n of items.nodes || []) {
      yield n
    }
    if (!items.pageInfo?.hasNextPage) break
    cursor = items.pageInfo.endCursor
  }
}

/**
 * @param {string} repoFull
 * @param {number} issueNumber
 * @param {string | null} statusName
 */
async function syncIssueLabels(repoFull, issueNumber, statusName) {
  if (!repoFull || !issueNumber) return
  if (repoFull.toLowerCase() !== REPO_FULL.toLowerCase()) {
    console.log(`Skip #${issueNumber} (${repoFull}) – anderes Repo`)
    return
  }

  const statusKey = statusName || 'Backlog'
  const desired = STATUS_TO_LABELS[statusKey]
  if (desired === undefined) {
    console.log(`Skip #${issueNumber}: unbekannter Status "${statusName}"`)
    return
  }

  const [owner, repo] = repoFull.split('/')
  const issue = await ghRest(`/repos/${owner}/${repo}/issues/${issueNumber}`)
  const current = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name))
  const kept = current.filter((n) => !ALL_MIRROR_LABELS.includes(n))
  const next = [...new Set([...kept, ...desired])].sort()
  const curSorted = [...current].sort()
  if (next.join('\0') === curSorted.join('\0')) {
    console.log(`OK #${issueNumber} (${statusName || '—'}: unverändert)`)
    return
  }

  await ghRest(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
    method: 'PUT',
    body: JSON.stringify({ labels: next }),
  })
  console.log(`Synced #${issueNumber}: ${statusName || '—'} → [${desired.join(', ') || 'keine Spiegel-Labels'}]`)
}

async function syncOneItem(itemId) {
  const info = await getItemInfo(itemId)
  if (!info.issueNumber || !info.repo) {
    console.log(`Item ${itemId}: kein Issue (Draft/PR?) – skip`)
    return
  }
  await syncIssueLabels(info.repo, info.issueNumber, info.status)
}

async function backfill() {
  const projectId = await getProjectId()
  let count = 0
  for await (const node of iterateProjectItems(projectId)) {
    if (node.content?.__typename && node.content.__typename !== 'Issue') continue
    const number = node.content?.number
    const repo = node.content?.repository?.nameWithOwner
    const status = node.fieldValueByName?.name ?? null
    if (!number || !repo) continue
    await syncIssueLabels(repo, number, status)
    count += 1
  }
  console.log(`Backfill fertig: ${count} Issues geprüft`)
}

async function main() {
  console.log(`Mode=${MODE} owner=${OWNER} project=#${PROJECT_NUMBER} repo=${REPO_FULL}`)
  if (MODE === 'item') {
    if (!ITEM_NODE_ID) {
      throw new Error('MODE=item erfordert ITEM_NODE_ID')
    }
    await syncOneItem(ITEM_NODE_ID)
    return
  }
  await backfill()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
