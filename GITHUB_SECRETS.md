# GitHub Secrets Configuration

Per far funzionare la build su GitHub Actions, devi configurare questi secrets:

## 1. Vai su GitHub Repository Settings
- Apri: https://github.com/Marcone1983/greed-gross-ai/settings/secrets/actions
- Clicca su "New repository secret" per ogni secret

## 2. Aggiungi questi Secrets:

### KEYSTORE_BASE64
Copia tutto il contenuto del file `keystore_base64.txt`

### KEY_ALIAS
```
greedandgross
```

### KEYSTORE_PASSWORD
```
greedgross123
```

### KEY_PASSWORD
```
greedgross123
```

### GOOGLE_SERVICES_JSON
Il contenuto del tuo google-services.json di Firebase

### OPENAI_API_KEY
La tua API key di OpenAI

## 3. Dopo aver aggiunto tutti i secrets, ripusha o rilancia la build