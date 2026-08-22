import { redirect } from 'next/navigation'

/** Alte URL → Tools-Untermenü */
export default function WartungRedirectPage() {
  redirect('/tools/wartung')
}
