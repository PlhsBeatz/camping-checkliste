import type { PackingItem } from '@/lib/db'
import type { PackingSyncPatchOp } from '@/lib/packing-sync'

/**
 * Wendet Gepackt-Delta-Patches auf eine lokale Packliste an (kein Server-Fetch).
 */
export function applyPackingSyncPatches(
  items: PackingItem[],
  patches: PackingSyncPatchOp[]
): PackingItem[] {
  if (patches.length === 0) return items

  let next = items
  for (const patch of patches) {
    next = applyOnePatch(next, patch)
  }
  return next
}

function applyOnePatch(items: PackingItem[], patch: PackingSyncPatchOp): PackingItem[] {
  switch (patch.op) {
    case 'item-gepackt':
      return items.map((item) => {
        if (item.id !== patch.id) return item
        if (patch.gepackt_vorgemerkt !== undefined) {
          return {
            ...item,
            gepackt_vorgemerkt: patch.gepackt_vorgemerkt,
            gepackt_vorgemerkt_durch:
              patch.gepackt_vorgemerkt_durch !== undefined
                ? patch.gepackt_vorgemerkt_durch ?? undefined
                : item.gepackt_vorgemerkt_durch,
          }
        }
        return {
          ...item,
          gepackt: patch.gepackt,
          ...(patch.gepackt === false
            ? { gepackt_vorgemerkt: false, gepackt_vorgemerkt_durch: undefined }
            : {}),
        }
      })

    case 'mitreisender-gepackt':
      return items.map((item) => {
        if (item.id !== patch.id) return item
        const mitreisende = [...(item.mitreisende ?? [])]
        const idx = mitreisende.findIndex((m) => m.mitreisender_id === patch.mitreisenderId)

        if (idx >= 0) {
          const cur = mitreisende[idx]!
          if (patch.gepackt_vorgemerkt !== undefined) {
            mitreisende[idx] = { ...cur, gepackt_vorgemerkt: patch.gepackt_vorgemerkt }
          } else {
            mitreisende[idx] = {
              ...cur,
              gepackt: patch.gepackt,
              ...(patch.gepackt === false ? { gepackt_vorgemerkt: false } : {}),
            }
          }
        } else if (patch.gepackt_vorgemerkt) {
          mitreisende.push({
            mitreisender_id: patch.mitreisenderId,
            mitreisender_name: patch.mitreisenderName ?? '',
            gepackt: false,
            gepackt_vorgemerkt: true,
          })
        } else if (patch.gepackt) {
          mitreisende.push({
            mitreisender_id: patch.mitreisenderId,
            mitreisender_name: patch.mitreisenderName ?? '',
            gepackt: true,
          })
        } else {
          return item
        }
        return { ...item, mitreisende }
      })

    case 'gruppe-gepackt':
      return items.map((item) => {
        if (item.id !== patch.id) return item
        const gruppen = [...(item.gruppen ?? [])]
        const idx = gruppen.findIndex((g) => g.gruppe_id === patch.gruppeId)
        if (idx < 0) return item
        const cur = gruppen[idx]!
        if (patch.gepackt_vorgemerkt !== undefined) {
          gruppen[idx] = {
            ...cur,
            gepackt_vorgemerkt: patch.gepackt_vorgemerkt,
            ...(patch.gepackt_vorgemerkt_durch !== undefined
              ? { gepackt_vorgemerkt_durch: patch.gepackt_vorgemerkt_durch }
              : {}),
          }
        } else {
          gruppen[idx] = {
            ...cur,
            gepackt: patch.gepackt,
            ...(patch.gepackt === false
              ? { gepackt_vorgemerkt: false, gepackt_vorgemerkt_durch: null }
              : {}),
          }
        }
        return { ...item, gruppen }
      })

    default:
      return items
  }
}
