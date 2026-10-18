# Relay

Plateforme de fiabilite pour la reception et la livraison d'evenements webhook.

## Etat du projet

Le premier vertical slice est en place :

- reception via `POST /webhooks/:source` ;
- validation HMAC-SHA256 du corps brut ;
- identifiant obligatoire `x-relay-event-id` ;
- deduplication persistante dans PostgreSQL ;
- historique des tentatives et dead-letter queue ;
- tests unitaires et end-to-end.

Le traitement BullMQ et la relance manuelle sont disponibles. Les tests utilisent un store memoire isole.

## Developpement

```bash
npm install
docker compose up -d postgres
npm run start:dev
```

Le schema `webhook_events` est cree automatiquement au premier evenement. PostgreSQL stocke les evenements et Redis porte la queue `relay-deliveries`. Les connexions et l'URL du destinataire sont definies dans [.env.example](.env.example).

## Consultation

```text
GET /events/:eventId/attempts
GET /dead-letters
POST /events/:eventId/retry
```

La cle de signature utilisee par defaut est `dev-secret`. Elle peut etre remplacee avec `WEBHOOK_SECRET`.

Exemple de signature :

```bash
BODY='{"event":"payment.created"}'
SIGNATURE=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac dev-secret -hex | sed 's/^.* //')

curl -i http://localhost:3000/webhooks/stripe \
	-H 'content-type: application/json' \
	-H 'x-relay-event-id: evt_123' \
	-H "x-relay-signature: $SIGNATURE" \
	--data "$BODY"
```

## Tests

```bash
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run build
```

## Demonstration panne/reprise

Dans deux terminaux, lancer l'API et le receiver de demonstration :

```bash
npm run demo:receiver
DELIVERY_URL=http://localhost:4000/webhook-receiver npm run start:dev
```

Puis, dans un troisieme terminal :

```bash
npm run demo:scenario
```

Le rapport montre les tentatives en erreur, la reprise apres retour du receiver et un seul effet metier par evenement, meme apres des receptions dupliquees. Il peut etre exporte avec `REPORT_FILE=./demo/report.json npm run demo:scenario`.