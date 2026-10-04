import type { D1Database } from '@cloudflare/workers-types'
import type { WohnwagenKatalogEntry } from '@/lib/db'

export type WohnwagenKatalogUpsert = {
  id: string
  hersteller: string
  modell: string
  baujahr_von?: number | null
  baujahr_bis?: number | null
  laenge_m: number
  breite_m: number
  laenge_gesamt_m?: number | null
  laenge_aufbau_m?: number | null
  deichsel_im_bild?: number | null
  mass_hinweis?: string | null
  grundriss_json?: string | null
  source_url?: string | null
  grundriss_bild_url?: string | null
  r2_object_key?: string | null
  content_type?: string | null
  notes?: string | null
}

function mapKatalogRow(row: Record<string, unknown>): WohnwagenKatalogEntry {
  return {
    id: String(row.id),
    hersteller: String(row.hersteller),
    modell: String(row.modell),
    baujahr_von: row.baujahr_von != null ? Number(row.baujahr_von) : null,
    baujahr_bis: row.baujahr_bis != null ? Number(row.baujahr_bis) : null,
    laenge_m: Number(row.laenge_m),
    breite_m: Number(row.breite_m),
    laenge_gesamt_m: row.laenge_gesamt_m != null ? Number(row.laenge_gesamt_m) : null,
    laenge_aufbau_m: row.laenge_aufbau_m != null ? Number(row.laenge_aufbau_m) : null,
    deichsel_im_bild: row.deichsel_im_bild != null ? Number(row.deichsel_im_bild) : null,
    mass_hinweis: row.mass_hinweis != null ? String(row.mass_hinweis) : null,
    grundriss_json: row.grundriss_json != null ? String(row.grundriss_json) : null,
    source_url: row.source_url != null ? String(row.source_url) : null,
    grundriss_bild_url:
      row.grundriss_bild_url != null ? String(row.grundriss_bild_url) : null,
    r2_object_key: row.r2_object_key != null ? String(row.r2_object_key) : null,
    content_type: row.content_type != null ? String(row.content_type) : null,
    refreshed_at: row.refreshed_at != null ? String(row.refreshed_at) : null,
    notes: row.notes != null ? String(row.notes) : null,
  }
}

export async function getWohnwagenKatalogById(
  db: D1Database,
  id: string
): Promise<WohnwagenKatalogEntry | null> {
  try {
    const row = await db
      .prepare(`SELECT * FROM wohnwagen_katalog WHERE id = ?`)
      .bind(id)
      .first<Record<string, unknown>>()
    return row ? mapKatalogRow(row) : null
  } catch (error) {
    console.error('Error fetching wohnwagen katalog:', error)
    return null
  }
}

export async function upsertWohnwagenKatalogEntry(
  db: D1Database,
  input: WohnwagenKatalogUpsert
): Promise<WohnwagenKatalogEntry> {
  const now = new Date().toISOString()
  try {
    await db
      .prepare(
        `INSERT INTO wohnwagen_katalog (
          id, hersteller, modell, baujahr_von, baujahr_bis, laenge_m, breite_m,
          laenge_gesamt_m, laenge_aufbau_m, deichsel_im_bild, mass_hinweis,
          grundriss_json, source_url, grundriss_bild_url, r2_object_key, content_type,
          refreshed_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          hersteller = excluded.hersteller,
          modell = excluded.modell,
          baujahr_von = excluded.baujahr_von,
          baujahr_bis = excluded.baujahr_bis,
          laenge_m = excluded.laenge_m,
          breite_m = excluded.breite_m,
          laenge_gesamt_m = COALESCE(excluded.laenge_gesamt_m, wohnwagen_katalog.laenge_gesamt_m),
          laenge_aufbau_m = COALESCE(excluded.laenge_aufbau_m, wohnwagen_katalog.laenge_aufbau_m),
          deichsel_im_bild = COALESCE(excluded.deichsel_im_bild, wohnwagen_katalog.deichsel_im_bild),
          mass_hinweis = COALESCE(excluded.mass_hinweis, wohnwagen_katalog.mass_hinweis),
          grundriss_json = COALESCE(excluded.grundriss_json, wohnwagen_katalog.grundriss_json),
          source_url = COALESCE(excluded.source_url, wohnwagen_katalog.source_url),
          grundriss_bild_url = COALESCE(excluded.grundriss_bild_url, wohnwagen_katalog.grundriss_bild_url),
          r2_object_key = COALESCE(excluded.r2_object_key, wohnwagen_katalog.r2_object_key),
          content_type = COALESCE(excluded.content_type, wohnwagen_katalog.content_type),
          refreshed_at = excluded.refreshed_at,
          notes = excluded.notes`
      )
      .bind(
        input.id,
        input.hersteller,
        input.modell,
        input.baujahr_von ?? null,
        input.baujahr_bis ?? null,
        input.laenge_m,
        input.breite_m,
        input.laenge_gesamt_m ?? null,
        input.laenge_aufbau_m ?? null,
        input.deichsel_im_bild ?? null,
        input.mass_hinweis ?? null,
        input.grundriss_json ?? null,
        input.source_url ?? null,
        input.grundriss_bild_url ?? null,
        input.r2_object_key ?? null,
        input.content_type ?? null,
        now,
        input.notes ?? null
      )
      .run()
  } catch {
    // Fallback ohne Maßklarheit-Spalten (Migration 0070 fehlt)
    await db
      .prepare(
        `INSERT INTO wohnwagen_katalog (
          id, hersteller, modell, baujahr_von, baujahr_bis, laenge_m, breite_m,
          grundriss_json, source_url, grundriss_bild_url, r2_object_key, content_type,
          refreshed_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          hersteller = excluded.hersteller,
          modell = excluded.modell,
          baujahr_von = excluded.baujahr_von,
          baujahr_bis = excluded.baujahr_bis,
          laenge_m = excluded.laenge_m,
          breite_m = excluded.breite_m,
          grundriss_json = COALESCE(excluded.grundriss_json, wohnwagen_katalog.grundriss_json),
          source_url = COALESCE(excluded.source_url, wohnwagen_katalog.source_url),
          grundriss_bild_url = COALESCE(excluded.grundriss_bild_url, wohnwagen_katalog.grundriss_bild_url),
          r2_object_key = COALESCE(excluded.r2_object_key, wohnwagen_katalog.r2_object_key),
          content_type = COALESCE(excluded.content_type, wohnwagen_katalog.content_type),
          refreshed_at = excluded.refreshed_at,
          notes = excluded.notes`
      )
      .bind(
        input.id,
        input.hersteller,
        input.modell,
        input.baujahr_von ?? null,
        input.baujahr_bis ?? null,
        input.laenge_m,
        input.breite_m,
        input.grundriss_json ?? null,
        input.source_url ?? null,
        input.grundriss_bild_url ?? null,
        input.r2_object_key ?? null,
        input.content_type ?? null,
        now,
        input.notes ?? null
      )
      .run()
  }

  const saved = await getWohnwagenKatalogById(db, input.id)
  if (!saved) {
    return {
      id: input.id,
      hersteller: input.hersteller,
      modell: input.modell,
      baujahr_von: input.baujahr_von ?? null,
      baujahr_bis: input.baujahr_bis ?? null,
      laenge_m: input.laenge_m,
      breite_m: input.breite_m,
      laenge_gesamt_m: input.laenge_gesamt_m ?? null,
      laenge_aufbau_m: input.laenge_aufbau_m ?? null,
      deichsel_im_bild: input.deichsel_im_bild ?? null,
      mass_hinweis: input.mass_hinweis ?? null,
      grundriss_json: input.grundriss_json ?? null,
      source_url: input.source_url ?? null,
      grundriss_bild_url: input.grundriss_bild_url ?? null,
      r2_object_key: input.r2_object_key ?? null,
      content_type: input.content_type ?? null,
      refreshed_at: now,
      notes: input.notes ?? null,
    }
  }
  return saved
}

/** Maße + optional Bild-Verweis auf Transportmittel schreiben. */
export async function applyKatalogImageToTransport(
  db: D1Database,
  transportId: string,
  entry: WohnwagenKatalogEntry
): Promise<boolean> {
  try {
    await db
      .prepare(
        `UPDATE transportmittel SET
          laenge_m = ?,
          breite_m = ?,
          laenge_gesamt_m = ?,
          laenge_aufbau_m = ?,
          deichsel_im_bild = ?,
          mass_hinweis = ?,
          baujahr = COALESCE(baujahr, ?),
          grundriss_json = COALESCE(?, grundriss_json),
          grundriss_bild_r2_key = COALESCE(?, grundriss_bild_r2_key),
          grundriss_bild_content_type = COALESCE(?, grundriss_bild_content_type)
         WHERE id = ?`
      )
      .bind(
        entry.laenge_m,
        entry.breite_m,
        entry.laenge_gesamt_m ?? null,
        entry.laenge_aufbau_m ?? null,
        entry.deichsel_im_bild ?? null,
        entry.mass_hinweis ?? null,
        entry.baujahr_von ?? entry.baujahr_bis ?? null,
        entry.grundriss_json ?? null,
        entry.r2_object_key ?? null,
        entry.content_type ?? null,
        transportId
      )
      .run()
    return true
  } catch (error) {
    try {
      await db
        .prepare(
          `UPDATE transportmittel SET
            laenge_m = ?, breite_m = ?, baujahr = COALESCE(baujahr, ?),
            grundriss_bild_r2_key = COALESCE(?, grundriss_bild_r2_key),
            grundriss_bild_content_type = COALESCE(?, grundriss_bild_content_type)
           WHERE id = ?`
        )
        .bind(
          entry.laenge_m,
          entry.breite_m,
          entry.baujahr_von ?? entry.baujahr_bis ?? null,
          entry.r2_object_key ?? null,
          entry.content_type ?? null,
          transportId
        )
        .run()
      return true
    } catch (fallbackError) {
      console.error('Error applying katalog to transport:', fallbackError || error)
      return false
    }
  }
}
