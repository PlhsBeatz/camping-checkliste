# Home Assistant Integration

Diese Anleitung beschreibt die Anbindung der Camping-Packlisten-App an **Home Assistant** über Nabu Casa. Die App **steuert nicht** den Urlaubsmodus — sie meldet Zustände wie „abfahrbereit“; Home Assistant entscheidet über Automatisierungen.

## Voraussetzungen

1. Migration `0024_integrations.sql` auf D1 ausgeführt
2. In der App unter **Konfiguration → Integrationen**:
   - API-Token erstellt
   - Webhook mit Nabu-Casa-URL angelegt
3. Cloudflare Secret `INTEGRATION_CRON_SECRET` gesetzt (für tägliche Events)

```bash
wrangler d1 execute camping-db --remote --file=./migrations/0024_integrations.sql
wrangler secret put INTEGRATION_CRON_SECRET
```

## REST-Sensor (Polling)

In `configuration.yaml` oder als YAML-Automation:

```yaml
rest:
  - resource: https://<deine-app>/api/integrations/trip-status
    headers:
      Authorization: !secret packliste_api_token
    scan_interval: 300
    sensor:
      - name: Packliste Fortschritt
        unique_id: packliste_fortschritt
        value_template: "{{ value_json.packing.percent }}"
        unit_of_measurement: "%"
        json_attributes_path: "$"
        json_attributes:
          - readiness
          - phase
          - days_until_departure
          - vacation
      - name: Packliste Tage bis Abreise
        unique_id: packliste_tage_bis_abreise
        value_template: "{{ value_json.days_until_departure }}"
```

Secret in `secrets.yaml`:

```yaml
packliste_api_token: "cpl_…"
```

## Webhook empfangen (Push)

In Home Assistant: **Einstellungen → Automationen → Webhook** → Webhook erstellen, ID z.B. `packliste_events`.

Die Webhook-URL (Nabu Casa) in der Packlisten-App unter Integrationen eintragen.

```yaml
automation:
  - alias: Packliste – abfahrbereit
    trigger:
      - platform: webhook
        webhook_id: packliste_events
        allowed_methods:
          - POST
        local_only: false
    condition:
      - condition: template
        value_template: "{{ trigger.json.type == 'de.camping-packliste.packing.complete' }}"
    action:
      - service: input_boolean.turn_on
        target:
          entity_id: input_boolean.packliste_abfahrbereit
```

Helper anlegen:

```yaml
input_boolean:
  packliste_abfahrbereit:
    name: Packliste abfahrbereit
    icon: mdi:bag-suitcase
```

## Urlaubsmodus — HA entscheidet final

Beispiel: Haustür zu + Packliste abfahrbereit + Abreisetag → Bestätigung per Smartphone:

```yaml
automation:
  - alias: Urlaubsmodus bei Abfahrt (mit Bestätigung)
    trigger:
      - platform: state
        entity_id: lock.haustuer
        to: locked
    condition:
      - condition: state
        entity_id: input_boolean.packliste_abfahrbereit
        state: "on"
      - condition: template
        value_template: "{{ states('sensor.packliste_tage_bis_abreise') | int(999) <= 0 }}"
    action:
      - service: notify.mobile_app_dein_handy
        data:
          title: "Urlaubsmodus aktivieren?"
          message: "Packliste vollständig, Haustür abgeschlossen."
          data:
            actions:
              - action: URLAUBSMODUS_AN
                title: "Ja, Urlaubsmodus"
              - action: URLAUBSMODUS_NEIN
                title: "Nein"

  - alias: Urlaubsmodus bestätigt
    trigger:
      - platform: event
        event_type: mobile_app_notification_action
        event_data:
          action: URLAUBSMODUS_AN
    action:
      - service: input_select.select_option
        target:
          entity_id: input_select.haus_modus
        data:
          option: urlaub
      - service: input_boolean.turn_off
        target:
          entity_id: input_boolean.packliste_abfahrbereit
```

> Passe `lock.haustuer`, `notify.mobile_app_*` und den Haus-Modus-Service an deine Installation an.

## Event-Typen (CloudEvents)

| type | Bedeutung |
|------|-----------|
| `de.camping-packliste.packing.complete` | 100 % gepackt → `ready_to_depart: true` |
| `de.camping-packliste.packing.incomplete` | wieder unter 100 % |
| `de.camping-packliste.packing.progress_changed` | Schwellen 25/50/75/90 % |
| `de.camping-packliste.trip.departure_approaching` | 3 oder 1 Tag vor Abreise |
| `de.camping-packliste.trip.departure_day` | Abreisetag |
| `de.camping-packliste.trip.started` | Reise läuft |
| `de.camping-packliste.trip.ended` | Reise beendet |

Payload enthält immer den vollständigen Trip-Status unter `data` (siehe Live-Vorschau in der App).

## Signatur prüfen (optional)

Webhooks werden mit Header `X-Webhook-Signature: sha256=<hmac>` signiert (HMAC-SHA256 über den JSON-Body). Für HA reicht meist die Webhook-URL-Geheimheit; für eigene Empfänger kann die Signatur verifiziert werden.

## Weitere Ideen

- **Erinnerung:** REST-Sensor + Automation wenn `percent < 80` und `days_until_departure <= 2`
- **Rückkehr:** Event `trip.ended` → Urlaubsmodus aus, Heizung hoch
- **Node-RED:** gleiche REST-URL oder Webhook-Node statt HA
