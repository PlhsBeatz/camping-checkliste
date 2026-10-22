'use client'

import { ConfigPageLayout } from '@/components/config-page-layout'
import { TagManager } from '@/components/tag-manager'
import { useState, useEffect } from 'react'
import { Tag, TagKategorie } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { getCachedTags, getCachedTagKategorien } from '@/lib/offline-sync'
import { cacheTags, cacheTagKategorien } from '@/lib/offline-db'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [tagKategorien, setTagKategorien] = useState<TagKategorie[]>([])

  const loadAll = async () => {
    try {
      const [tagsRes, katRes] = await Promise.all([fetch('/api/tags'), fetch('/api/tag-kategorien')])
      const tagsJson = (await tagsRes.json()) as ApiResponse<Tag[]>
      const katJson = (await katRes.json()) as ApiResponse<TagKategorie[]>
      if (tagsJson.success && tagsJson.data) {
        setTags(tagsJson.data)
        await cacheTags(tagsJson.data)
      }
      if (katJson.success && katJson.data) {
        setTagKategorien(katJson.data)
        await cacheTagKategorien(katJson.data)
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const [cachedTags, cachedKat] = await Promise.all([
          getCachedTags(),
          getCachedTagKategorien(),
        ])
        if (cachedTags.length > 0) setTags(cachedTags)
        if (cachedKat.length > 0) setTagKategorien(cachedKat)
      }
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const handleRefresh = loadAll
  useReconnectRefetch(loadAll)

  return (
    <ConfigPageLayout>
      <TagManager tagKategorien={tagKategorien} tags={tags} onRefresh={handleRefresh} />
    </ConfigPageLayout>
  )
}
