# Relay

Plateforme de fiabilite pour la reception et la livraison d'evenements webhook.

## Etat du projet

Le premier vertical slice est en place :

- reception via `POST /webhooks/:source` ;
- validation HMAC-SHA256 du corps brut ;
- identifiant obligatoire `x-relay-event-id` ;
- deduplication des evenements en memoire ;
- tests unitaires et end-to-end.

La persistance PostgreSQL et le traitement BullMQ seront ajoutes dans les prochains increments.

## Developpement

```bash
npm install
npm run start:dev
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