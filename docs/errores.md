# Errores y cálculos incompletos

Por qué un cálculo puede no salir, cómo se ve cada caso en la respuesta y qué hacer.

← [Volver al inicio](../README.md)

Hay dos situaciones distintas:

- **Cálculo incompleto** — el pedido está bien, pero falta un dato del producto. La respuesta es `200`, todo viene en cero y `resolved` es `false`.
- **Error** — el pedido está mal armado, falta la clave, o un servicio del que depende el cálculo no respondió. La respuesta es un código HTTP de error.

**Contenido**

- [Los más frecuentes](#los-más-frecuentes)
- [Cálculos incompletos](#cálculos-incompletos)
- [Pedidos mal armados](#pedidos-mal-armados)
- [Sin clave](#sin-clave)
- [Un servicio no respondió](#un-servicio-no-respondió)
- [Error inesperado](#error-inesperado)
- [Un lote o un producto](#un-lote-o-un-producto)

---

## Los más frecuentes

| Qué se ve | En una línea | Qué hacer |
|---|---|---|
| [`resolved: false`](#cálculos-incompletos) | Falta el producto, la categoría o sus impuestos en Madre. | Completar el dato en Madre. **No pausar por este resultado.** |
| [`400 sku is required`](#pedidos-mal-armados) (u otro campo) | Falta un campo obligatorio. | Corregir el pedido. |
| [`400 body can contain up to 50 items`](#pedidos-mal-armados) | El lote tiene más de 50 productos. | Partirlo en lotes de 50. |
| [`401`](#sin-clave) | Falta `x-api-key` o es incorrecta. | Revisar la clave. |
| [`503` con `failedDependency: "meli-api"`](#meli-api) | Mercado Libre no informó la comisión. | Reintentar. |
| [`503` con `failedDependency: "madre-api"`](#madre-api) | Madre no respondió. | Reintentar. |

---

## Cálculos incompletos

Cuando falta un dato del producto, el servicio **no inventa valores**: devuelve el resultado con todos los importes en cero y lo marca.

| Endpoint | Cómo se marca |
|---|---|
| Resumen (`/getProfit`, `/getProfit/bulk`, `/getProfit/channel`) | `status.resolved: false` |
| Detalle de canal externo (`/channel/details`, `/channel/details/bulk`) | `status.resolved: false` |
| Detalle de Mercado Libre (`/details`, `/details/bulk`) | `unresolved: true` (no traen `status`) |

En los dos primeros casos, además, `profitable` sale `false` y `shouldPause` sale `true`. **Eso no significa que el producto no convenga**: significa que no se pudo calcular. Quien consume la respuesta tiene que mirar `resolved` antes de pausar.

En la respuesta incompleta, `input` conserva lo que se pidió (incluido el precio), pero `prices`, los costos y el resultado vienen en cero.

### Motivos

| Motivo | Mercado Libre | Canal externo | Qué hacer |
|---|---|---|---|
| El SKU no está en Madre (sin relevamiento de Amazon) | ✓ | ✓ | Verificar que el producto esté relevado en Madre. |
| La categoría no tiene impuestos cargados en Madre | ✓ | ✓ | Cargar la categoría en la tabla de impuestos de Madre. |
| El SKU no tiene una publicación de Mercado Libre asociada en Madre, así que no hay categoría | — | ✓ | Asociar el SKU a una publicación en Madre. |
| Mercado Libre no informó la comisión de ese producto | Solo en lotes | — | Reintentar. En un pedido de a uno, este caso es un [error 503](#meli-api). |

El servicio no dice cuál de los motivos fue: queda en el log del servidor (`Returning zeroed profitability detail…`), con el SKU y qué dato faltaba.

### Cálculo completo, pero `profitable: false`

Es otra cosa: los datos están, pero el resultado no pasa la regla de conveniencia. En Mercado Libre pasa si el peso del producto es cero o el SKU no tiene formato de producto de Amazon (`B0` + 8 caracteres). En canales externos, si el descuento posible está fuera del rango de 0 % a 40 %. Ver [Cuándo conviene y cuándo pausar](funcional.md#cuándo-conviene-y-cuándo-pausar).

---

## Pedidos mal armados

Responden `400` con el motivo en `message`:

```json
{ "statusCode": 400, "message": "sku is required", "error": "Bad Request" }
```

| Mensaje | Cuándo |
|---|---|
| `mla is required` | Falta `mla` o está vacío. |
| `sku is required` | Falta `sku` o está vacío. |
| `categoryId is required` | Falta `categoryId` o está vacío. |
| `publicationType is required` | Falta `publicationType` o está vacío. |
| `salePrice must be a number greater than 0` | `salePrice` falta, no es un número o es cero o negativo. Un número entre comillas (`"100000"`) también se rechaza. |
| `meliContributionPercentage must be a number between 0 and 100` | El aporte se envió pero no es un número entre 0 y 100. |
| `salesChannel is required` | Falta `salesChannel` o está vacío. |
| `salesChannel must be one of: megatone, fravega, oncity` | El canal no es uno de los tres. |
| `body must be an array` | En un lote, el body no es una lista. |
| `body must contain at least 1 item` | En un lote, la lista está vacía. |
| `body can contain up to 50 items` | En un lote, la lista tiene más de 50 productos. |

**Lotes de Mercado Libre.** `/getProfit/bulk` y `/getProfit/details/bulk` solo controlan que el body sea una lista de 1 a 50 elementos; **no revisan cada producto**. Un producto sin `sku` o sin `categoryId` hace fallar el lote entero con un [error inesperado](#error-inesperado). Uno sin `mla`, `publicationType` o con precio inválido no lo hace fallar: ese producto vuelve [incompleto](#cálculos-incompletos). Los lotes de canales externos sí revisan cada producto y responden `400`.

---

## Sin clave

```json
{ "statusCode": 401, "message": "Missing or invalid x-api-key header", "error": "Unauthorized" }
```

Falta el header `x-api-key` o no coincide con la clave del servicio. `/health` es el único endpoint que no la pide.

---

## Un servicio no respondió

Cuando falla un servicio del que depende el cálculo, la respuesta es `503` y dice cuál fue:

```json
{
  "statusCode": 503,
  "message": "Internal server error",
  "errorCode": "PRICE_DEP_FAILURE",
  "failedDependency": "meli-api",
  "cause": "Request failed with status code 404 (status 404)",
  "correlationId": "5b0c1c9e-2f0e-4c39-9a51-0f3c2a7e6d11"
}
```

| Campo | Qué es |
|---|---|
| `errorCode` | Siempre `PRICE_DEP_FAILURE` para estos casos. |
| `failedDependency` | El servicio que falló: `meli-api`, `madre-api` o `criptoya`. |
| `cause` | El motivo que devolvió ese servicio, con su código si lo hubo. |
| `correlationId` | Identificador para buscar el caso en el log del servidor, donde queda también el pedido. |

El pedido estaba bien, así que **reintentar tiene sentido**.

### `meli-api`

Mercado Libre no informó la comisión de la publicación. En un pedido de a uno, el cálculo no sigue. Causas habituales: el MLA no existe o no corresponde a la categoría, el tipo de publicación no es válido, o meli-api no respondió en 10 segundos.

**Qué hacer:** verificar `mla`, `categoryId` y `publicationType`; si están bien, reintentar.

### `madre-api`

Madre no respondió, o respondió con un error distinto de "no encontrado". `cause` dice a qué consulta y con qué código, por ejemplo `[MADRE POST] /api/automeli/product-snapshots/search (status 502)`. Cuando no hubo respuesta, el código que figura es `500`.

También aparece si al servicio le falta la URL o la clave de Madre en la configuración. En ese caso `cause` no lo dice: se ve igual que una falta de respuesta (`status 500`).

Que Madre responda "no encontrado" no es este error: es un [cálculo incompleto](#cálculos-incompletos).

**Qué hacer:** reintentar. Si persiste, revisar Madre.

### `criptoya`

No se pudo obtener la cotización del dólar **y no hay ninguna anterior guardada**. Solo pasa en el primer cálculo después de reiniciar el servicio: una vez que se obtuvo una cotización, si CriptoYa falla se sigue usando la última.

**Qué hacer:** reintentar en unos minutos.

---

## Error inesperado

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "errorCode": "PRICE_UNHANDLED_ERROR",
  "failedDependency": null,
  "cause": "Cannot read properties of undefined (reading 'trim')",
  "correlationId": "…"
}
```

Un error que no viene de un servicio externo. El caso conocido es un lote de Mercado Libre con un producto sin `sku` o sin `categoryId` (ver [Pedidos mal armados](#pedidos-mal-armados)). Con el `correlationId` se encuentra en el log el pedido que lo causó.

---

## Un lote o un producto

En los lotes, algunos datos se piden una sola vez para todos los productos. Si fallan, falla el lote entero; si falla algo de un producto, solo ese vuelve incompleto.

| Falla | Lote de Mercado Libre | Lote de canales externos |
|---|---|---|
| Cotización del dólar | Falla el lote (`503 criptoya`) | Falla el lote |
| Madre no responde al buscar los productos | Falla el lote (`503 madre-api`) | Falla el lote |
| Madre no responde al buscar las categorías | — | Falla el lote |
| Madre no responde al buscar los impuestos (salvo "no encontrado") | Falla el lote | Falla el lote |
| Mercado Libre no informa la comisión de un producto | Solo ese producto vuelve incompleto | — (la comisión es fija) |
| Un producto no está en Madre o su categoría no tiene impuestos | Solo ese producto vuelve incompleto | Solo ese producto vuelve incompleto |
