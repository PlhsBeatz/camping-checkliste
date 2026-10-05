/** Gemeinsame Typen für Parzellen-Ausrichtung (Client + Server). */

export type PitchOrientationSource = 'osm' | 'satellite' | 'map' | 'merged'

export type PitchOrientationResult = {
  /** Bug-/Fahrtrichtung in Kompassgrad (0=N); Deichsel zur Zufahrt */
  headingDeg: number
  /** 0…1, wie klar die Linienstruktur ist */
  confidence: number
  /** Dominante Linienrichtung undirected (0…180) */
  lineDeg: number
  source?: PitchOrientationSource
  detail?: string
}
