import { redirect } from 'next/navigation'

export default function ProfilPasswortRedirectPage() {
  redirect('/einstellungen/passwort-aendern')
}
