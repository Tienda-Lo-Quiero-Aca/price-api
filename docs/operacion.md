# Operación

Cómo desplegar, cómo verificar que quedó bien, y qué hacer ante los problemas más frecuentes.

← [Volver al inicio](../README.md)

**Contenido**

1. [Dónde corre](#dónde-corre)
2. [Deploy](#deploy)
3. [Verificar que está sano](#verificar-que-está-sano)
4. [Rotar la clave del servicio](#rotar-la-clave-del-servicio)
5. [Problemas frecuentes](#problemas-frecuentes)

---

## Dónde corre

| | |
|---|---|
| URL | `https://api.price.loquieroaca.com` |
| Servidor | Droplet de DigitalOcean, detrás de nginx |
| Directorio | _Pendiente de completar_ |
| Proceso | _Pendiente de completar_ (nombre en PM2) |
| Punto de entrada | `dist/main.js` |
| Configuración | `.env` en el directorio del servicio |

Detalles que evitan confusiones:

- **El proceso ejecuta el código compilado** (`dist/`), no el fuente. Traer cambios con `git pull` no modifica nada de lo que está corriendo.
- El punto de entrada es `dist/main.js`. La carpeta `scripts/` está excluida de la compilación justamente para que no cambie: si se compilara, TypeScript movería todo a `dist/src/main.js`.
- **nginx hace un `proxy_pass` directo**, sin reintentos ni páginas de error propias: los `503` del servicio llegan tal cual a los consumidores, con su body.
- El `.env` y el sitio de documentación se leen **del directorio desde el que arranca el proceso**: tiene que ser el del repositorio.

---

## Deploy

Tres pasos, y **los tres son necesarios**: traer el código, compilar y reiniciar.

```bash
cd <directorio> && git pull && cp -r dist dist.backup && npm run build && ls -l dist/main.js
```

El `ls` del final tiene que mostrar el archivo con la fecha y hora de ahora. Recién entonces:

```bash
pm2 restart <proceso> --update-env && rm -rf dist.backup
```

**Por qué el respaldo.** `npm run build` borra `dist/` antes de compilar. Si la compilación falla a mitad de camino, el servicio se queda sin nada que ejecutar. Con el respaldo se vuelve atrás así:

```bash
rm -rf dist && mv dist.backup dist && pm2 restart <proceso>
```

**Si cambiaron dependencias** (`package.json`), agregar `npm ci` antes de compilar.

**`--update-env`** hace que PM2 relea las variables. Sin eso, sigue con las que tenía cargadas.

**Si el cambio es solo de documentación** (`README.md` o `docs/*.md`), alcanza con `git pull`: el sitio en `/docs` lee los textos del repositorio en cada visita, sin compilar ni reiniciar.

**Al reiniciar se pierde la cotización del dólar guardada.** El primer cálculo vuelve a consultar CriptoYa; si en ese momento no responde, los cálculos fallan con `503 criptoya` hasta que responda.

### Confirmar que quedó la versión nueva

Buscar en el compilado algo que solo exista en el cambio que se subió:

```bash
grep -rl "TEXTO_DEL_CAMBIO" dist/ | head -1
```

Y que PM2 haya reiniciado de verdad:

```bash
pm2 list
```

La columna `uptime` tiene que mostrar segundos o minutos, no días.

---

## Verificar que está sano

**El proceso responde:**

```bash
curl -s https://api.price.loquieroaca.com/health
# {"status":"ok"}
```

`/health` no consulta Madre, meli-api ni CriptoYa: que responda no garantiza que se pueda calcular.

**La clave es la correcta:**

```bash
curl -s https://api.price.loquieroaca.com/ -H "x-api-key: $PRICE_API_KEY"
# {"message":"Price API protegida con API key"}
```

**Un cálculo de punta a punta** (pasa por las tres dependencias):

```bash
curl -s -X POST "https://api.price.loquieroaca.com/internal/getProfit/channel" \
  -H "x-api-key: $PRICE_API_KEY" -H "Content-Type: application/json" \
  -d '{"sku":"B0F47N62NN","salePrice":731399,"salesChannel":"megatone"}'
```

Tiene que volver con `status.resolved: true` e importes distintos de cero.

**Errores recientes:**

```bash
pm2 logs <proceso> --lines 200 --nostream | grep -E "PRICE_DEP_FAILURE|PRICE_UNHANDLED_ERROR"
```

En producción el log solo tiene `error` y `warn`, así que todo lo que aparece merece una mirada.

---

## Rotar la clave del servicio

La clave (`API_KEY`) es una sola, compartida por todos los consumidores. Al cambiarla hay que actualizarla en todos a la vez; el que quede con la vieja recibe `401`.

1. Generar la clave nueva.
2. Cambiar `API_KEY` en el `.env` del servicio y reiniciar con `--update-env`.
3. Actualizarla en cada consumidor:

| Consumidor | Dónde |
|---|---|
| Central de Promociones (`central-promotion-engine`) | `PRICE_API_TOKEN` |
| Panel de la Central de Promociones (`cpe-panel`) | `PRICE_API_KEY` |
| Panel de administración | `LQA_MERCADOLIBRE_PRICING_API_KEY` (o el parámetro "API key Pricing" del panel) |
| Front TLQ (calculadora de precios) | `PRICE_API_KEY` |
| Products API | `PRICING_API_KEY` |

4. Verificar con [la prueba de clave](#verificar-que-está-sano) y mirar el log de cada consumidor.

**Credenciales del sitio de documentación.** `DOCS_SITE_USER` y `DOCS_SITE_PASSWORD` en el `.env`; se cambian y se reinicia con `--update-env`. Si se borran las dos, el sitio queda abierto y esta página deja de publicarse.

---

## Problemas frecuentes

### Muchos `503` con `failedDependency: "meli-api"`

meli-api no está informando comisiones. En los lotes se ve distinto: no hay 503, pero muchos productos vuelven con `resolved: false` y en el log aparece `Bulk profitability: N of M items could not resolve their Mercado Libre commission`.

**Qué hacer:** revisar meli-api y su token de Mercado Libre. Price API no guarda nada, así que cuando meli-api vuelve, los cálculos vuelven solos.

### `503` con `failedDependency: "madre-api"` en todos los pedidos

Si es todo y de golpe, probablemente Madre está caída. Si empezó justo después de un deploy, revisar que el `.env` tenga `MADRE_API_BASE_URL` y `MADRE_INTERNAL_API_KEY`: sin ellas el error es el mismo (`status 500` en `cause`).

### `503` con `failedDependency: "criptoya"`

Solo pasa si no hay ninguna cotización guardada, o sea, al poco tiempo de reiniciar. Esperar unos minutos y reintentar. No reiniciar el servicio: empeora el problema.

### Muchos resultados con `resolved: false`

Faltan datos en Madre. En el log aparece `Returning zeroed profitability detail…` con el SKU y qué faltaba (`hasProductStatus`, `hasTaxes`, `hasCommissionCategory`). Lo más común es una categoría nueva sin impuestos cargados. Ver [Errores y cálculos incompletos](errores.md#cálculos-incompletos).

### Un consumidor pausó productos que convenían

Revisar si miró `resolved`: un cálculo incompleto sale con `shouldPause: true`. Y en Mercado Libre, recordar que `profitable` no mide la ganancia. Ver [Cuándo conviene y cuándo pausar](funcional.md#cuándo-conviene-y-cuándo-pausar).

### `401` en todos los pedidos de un consumidor

La clave no coincide. Si se rotó hace poco, falta actualizarla en ese consumidor. Ver [Rotar la clave del servicio](#rotar-la-clave-del-servicio).

### El sitio `/docs` muestra la versión vieja de un texto

Confirmar que el `git pull` se hizo en el directorio desde el que corre el proceso. El sitio no cachea: lee el archivo en cada visita.
