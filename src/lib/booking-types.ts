export type Buchungsstatus = 'angefragt' | 'gebucht' | 'bezahlt' | 'storniert'

export type CampingStayEmailTyp =
  | 'reservierungsbestaetigung'
  | 'buchungsbestaetigung'
  | 'zahlungsbestaetigung'
  | 'vor_anreise'
  | 'stornierung'
  | 'sonstiges'

export type BookingImportQuelle = 'paste' | 'email_forward' | 'webhook'

export type BookingImportStatus = 'pending' | 'confirmed' | 'dismissed'

/** Von Parser erkannte Felder (Vorschlag im Review). */
export type ParsedBookingFields = {
  platznummer?: string | null
  buchungsnummer?: string | null
  buchungsstatus?: Buchungsstatus | null
  start_datum?: string | null
  end_datum?: string | null
  checkin_zeit?: string | null
  checkout_zeit?: string | null
  zugangscode?: string | null
  unterkunftstyp?: string | null
  preis_gesamt?: number | null
  waehrung?: string | null
  anzahlung_betrag?: number | null
  restzahlung_faellig_am?: string | null
  buchungsdatum?: string | null
  stornierungsfrist?: string | null
  kontakt_platz?: string | null
  campingplatz_name?: string | null
  campingplatz_ort?: string | null
  email_typ?: CampingStayEmailTyp | null
}

export type StayBookingFields = {
  platznummer?: string | null
  buchungsnummer?: string | null
  buchungsstatus?: Buchungsstatus | null
  checkin_zeit?: string | null
  checkout_zeit?: string | null
  zugangscode?: string | null
  unterkunftstyp?: string | null
  preis_gesamt?: number | null
  waehrung?: string | null
  anzahlung_betrag?: number | null
  restzahlung_faellig_am?: string | null
  buchungsdatum?: string | null
  stornierungsfrist?: string | null
  extras_json?: string | null
  kontakt_platz?: string | null
  notizen_buchung?: string | null
}

export interface BookingImportPending {
  id: string
  status: BookingImportStatus
  quelle: BookingImportQuelle
  betreff: string | null
  absender: string | null
  empfangen_am: string
  inhalt_text: string | null
  message_id: string | null
  parsed_fields_json: string | null
  vorgeschlagener_urlaub_id: string | null
  r2_object_key: string | null
  created_at: string
  updated_at: string
}

export interface UrlaubCampingplatzEmail {
  id: string
  stay_id: string
  email_typ: CampingStayEmailTyp
  betreff: string | null
  absender: string | null
  empfangen_am: string | null
  gmail_suchlink: string | null
  inhalt_text: string | null
  r2_object_key: string | null
  import_pending_id: string | null
  created_at: string
}

export const BUCHUNGSSTATUS_OPTIONS: Buchungsstatus[] = [
  'angefragt',
  'gebucht',
  'bezahlt',
  'storniert',
]

export const EMAIL_TYP_LABELS: Record<CampingStayEmailTyp, string> = {
  reservierungsbestaetigung: 'Reservierungsbestätigung',
  buchungsbestaetigung: 'Buchungsbestätigung',
  zahlungsbestaetigung: 'Zahlungsbestätigung',
  vor_anreise: 'Vor Anreise',
  stornierung: 'Stornierung',
  sonstiges: 'Sonstiges',
}

export const BUCHUNGSSTATUS_LABELS: Record<Buchungsstatus, string> = {
  angefragt: 'Angefragt',
  gebucht: 'Gebucht',
  bezahlt: 'Bezahlt',
  storniert: 'Storniert',
}
