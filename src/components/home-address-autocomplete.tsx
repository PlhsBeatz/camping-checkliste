'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

declare global {
  interface Window {
    google?: {
      maps?: {
        importLibrary: (name: string) => Promise<unknown>
      }
    }
  }
}

interface PlaceLike {
  formattedAddress?: string
  location?: { lat: () => number; lng: () => number }
  fetchFields: (opts: { fields: string[] }) => Promise<void>
}

interface HomeAddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onResolve: (result: { address: string; lat: number | null; lng: number | null }) => void
  placeholder?: string
}

const BOOTSTRAP_LOADER = `(g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=\`https://maps.\${c}apis.com/maps/api/js?\`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})`;

export function HomeAddressAutocomplete(props: HomeAddressAutocompleteProps) {
  const { value, onChange, onResolve, placeholder } = props
  const inputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const elementRef = useRef<HTMLElement | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [placesAvailable, setPlacesAvailable] = useState(false)

  // Bootstrap Loader (neue Maps JS API) mit key + v=weekly laden
  useEffect(() => {
    if (typeof window === 'undefined') return

    const w = window as Window
    if (w.google?.maps?.importLibrary) {
      setScriptLoaded(true)
      return
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      setScriptLoaded(true)
      return
    }

    const scriptId = 'google-maps-bootstrap'
    if (document.getElementById(scriptId)) {
      setScriptLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.textContent = `${BOOTSTRAP_LOADER}({key:"${apiKey.replace(/"/g, '\\"')}",v:"weekly",language:"de"});`
    script.onload = () => setScriptLoaded(true)
    script.onerror = () => setScriptLoaded(true)
    document.head.appendChild(script)
  }, [])

  // Places-Bibliothek laden und PlaceAutocompleteElement nutzen (neue API)
  useEffect(() => {
    if (!scriptLoaded || !window.google?.maps?.importLibrary || !containerRef.current) return

    let mounted = true
    let autocompleteEl: HTMLElement & { value: string; addEventListener: Function; removeEventListener: Function } | null = null

    async function init() {
      try {
        const { PlaceAutocompleteElement } = await window.google!.maps!.importLibrary('places') as {
          PlaceAutocompleteElement: new (opts?: {
            placeholder?: string
            requestedLanguage?: string
            includedRegionCodes?: string[]
          }) => HTMLElement & { value: string; addEventListener: Function; removeEventListener: Function }
        }
        if (!mounted || !containerRef.current) return

        autocompleteEl = new PlaceAutocompleteElement({
          placeholder: placeholder ?? 'Heimatadresse eingeben',
          requestedLanguage: 'de',
          includedRegionCodes: ['de', 'at', 'ch'],
        }) as HTMLElement & { value: string; addEventListener: Function; removeEventListener: Function }

        autocompleteEl.className = 'home-address-autocomplete-input'
        Object.assign(autocompleteEl.style, {
          width: '100%',
          height: '40px',
          border: '1px solid hsl(var(--border))',
          borderRadius: '6px',
          paddingLeft: '12px',
          paddingRight: '12px',
          fontSize: '14px',
          boxSizing: 'border-box',
        })

        const onSelect = async (ev: { placePrediction: { toPlace: () => Promise<PlaceLike> } }) => {
          try {
            const place = await ev.placePrediction.toPlace()
            await place.fetchFields({ fields: ['formattedAddress', 'location'] })
            const address = place.formattedAddress ?? value
            const loc = place.location
            const lat = loc ? loc.lat() : null
            const lng = loc ? loc.lng() : null
            onChange(address)
            onResolve({ address, lat, lng })
          } catch {
            setPlacesAvailable(false)
          }
        }

        autocompleteEl.addEventListener('gmp-select', onSelect as EventListener)
        ;(autocompleteEl as unknown as { _gmpSelectHandler: EventListener })._gmpSelectHandler = onSelect as EventListener

        // Wert vom Parent in das Element übernehmen
        if (value) (autocompleteEl as { value: string }).value = value

        // Input-Ereignisse (Tippen) an Parent melden
        const inputPart = autocompleteEl.shadowRoot?.querySelector?.('input') ?? (autocompleteEl as HTMLInputElement)
        const onInput = () => {
          const v = (autocompleteEl as { value: string }).value ?? ''
          onChange(v)
          onResolve({ address: v, lat: null, lng: null })
        }
        if (inputPart && inputPart.addEventListener) {
          inputPart.addEventListener('input', onInput)
          autocompleteEl._inputListener = onInput
          autocompleteEl._inputPart = inputPart
        }

        containerRef.current.innerHTML = ''
        containerRef.current.appendChild(autocompleteEl)
        elementRef.current = autocompleteEl
        setPlacesAvailable(true)
      } catch {
        if (mounted) setPlacesAvailable(false)
      }
    }

    init()
    return () => {
      mounted = false
      if (autocompleteEl) {
        const el = autocompleteEl as unknown as {
          _inputPart?: HTMLInputElement
          _inputListener?: () => void
          _gmpSelectHandler?: EventListener
        }
        if (el._inputPart && el._inputListener) el._inputPart.removeEventListener('input', el._inputListener)
        if (el._gmpSelectHandler) autocompleteEl.removeEventListener('gmp-select', el._gmpSelectHandler)
        if (autocompleteEl.parentNode) autocompleteEl.parentNode.removeChild(autocompleteEl)
      }
      elementRef.current = null
    }
  }, [scriptLoaded, placeholder, onChange, onResolve])

  // Wert-Prop in das Google-Element übernehmen
  useEffect(() => {
    const el = elementRef.current as (HTMLElement & { value: string }) | null
    if (el && value !== undefined && el.value !== value) el.value = value
  }, [value])

  const showFallback = !placesAvailable

  return (
    <div className="relative w-full">
      {showFallback && (
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            const v = e.target.value
            onChange(v)
            onResolve({ address: v, lat: null, lng: null })
          }}
          placeholder={placeholder ?? 'Heimatadresse eingeben'}
          autoComplete="off"
        />
      )}
      <div
        ref={containerRef}
        className={showFallback ? 'hidden' : 'block'}
        style={showFallback ? undefined : { minHeight: 40 }}
      />
    </div>
  )
}
