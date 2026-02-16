/**
 * Typen für API-Responses – vermeidet "unknown" bei res.json()
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
