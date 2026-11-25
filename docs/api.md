# Referencia de la API

Todos los endpoints del servicio.

← [Volver al inicio](../README.md)

**URL base de producción:** `https://api.price.loquieroaca.com`

**Header obligatorio** en todos los endpoints salvo `/health`:

```
x-api-key: <API_KEY>
```

Los ejemplos usan dos variables de entorno para no repetir la URL y la clave:

```bash
export PRICE_API_URL="https://api.price.loquieroaca.com"
export PRICE_API_KEY="..."
```

**Contenido**

| Grupo | Endpoints |
|---|---|
| [Mercado Libre](#mercado-libre) | Resumen · Detalle · Resumen en lote · Detalle en lote |
| [Canales externos](#canales-externos) | Resumen · Detalle · Detalle en lote |
| [Estado del servicio](#estado-del-servicio) | Health check · Prueba de clave |

### Convenciones

- **Todos los cálculos son `POST`** con body JSON, aunque no modifican nada.
- **Montos** en pesos argentinos, redondeados a 2 decimales.
- **Cálculo incompleto** — si falta un dato del producto, la respuesta es `200` con todo en cero y `status.resolved: false` (o `unresolved: true` en el detalle de Mercado Libre). Ver [Errores y cálculos incompletos](errores.md#cálculos-incompletos).
- **Errores HTTP** — `400` si el pedido está mal armado; `401` si falta o es incorrecta la clave; `503` si un servicio del que depende el cálculo no respondió; `500` ante un error inesperado. Ver [Errores y cálculos incompletos](errores.md).
- **Lotes** — hasta 50 productos. Los resultados vuelven en el mismo orden en que se enviaron.
- **Importes de los ejemplos** — son los del [ejemplo completo](funcional.md#ejemplo-completo) de la guía funcional (producto de USD 45, 3 libras, dólar MEP $1.200): sirven para seguir el cálculo, no son los valores reales de esos SKU.

---

## Mercado Libre

Los cuatro endpoints reciben los mismos datos por producto.

**Datos de un producto**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `mla` | string | Sí | Publicación de Mercado Libre. Ej: `MLA2228742950`. |
| `categoryId` | string | Sí | Categoría de Mercado Libre. Ej: `MLA31040`. Define los impuestos de importación. |
| `publicationType` | string | Sí | Tipo de publicación: `gold_special`, `gold_pro`… Junto con el precio define la comisión. |
| `sku` | string | Sí | SKU del producto. Para que salga `profitable: true` tiene que ser `B0` + 8 letras o números. |
| `salePrice` | number | Sí | Precio de venta al comprador, mayor a 0. |
| `meliContributionPercentage` | number | No | % del precio que aporta Mercado Libre en la promoción, de 0 a 100. Por defecto, 0. |

### Resumen de un producto

```
POST /internal/getProfit
```

Calcula la rentabilidad de un producto y devuelve el resultado resumido.

**Ejemplo**

```bash
curl -s -X POST "$PRICE_API_URL/internal/getProfit" \
  -H "x-api-key: $PRICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mla": "MLA2228742950",
    "categoryId": "MLA31040",
    "publicationType": "gold_special",
    "sku": "B0F47N62NN",
    "salePrice": 250000,
    "meliContributionPercentage": 2.4
  }'
```

**Respuesta**

```json
{
  "input": {
    "mla": "MLA2228742950",
    "categoryId": "MLA31040",
    "publicationType": "gold_special",
    "sku": "B0F47N62NN",
    "salePrice": 250000,
    "meliContributionPercentage": 2.4
  },
  "prices": {
    "salePrice": 250000,
    "meliContributionPercentage": 2.4,
    "meliContributionAmount": 6000,
    "sellerNetPrice": 256000
  },
  "economics": {
    "cost": 215088.81,
    "profitAmount": 40911.19,
    "profitabilityPercent": 15.98,
    "marginPercent": 19.02
  },
  "status": {
    "profitable": true,
    "shouldPause": false,
    "resolved": true
  }
}
```

| Campo | Descripción |
|---|---|
| `input` | Lo que se pidió. `meliContributionPercentage` vale 0 si no se envió. |
| `prices.meliContributionAmount` | Lo que pone Mercado Libre: `salePrice` × % de aporte. |
| `prices.sellerNetPrice` | Ingreso del vendedor: `salePrice` + aporte. |
| `economics.cost` | **El precio piso** (precio mínimo para ganar el 25 %), no el costo del producto. |
| `economics.profitAmount` | `sellerNetPrice` − precio piso. |
| `economics.profitabilityPercent` | `profitAmount` ÷ `sellerNetPrice` × 100. |
| `economics.marginPercent` | `profitAmount` ÷ precio piso × 100. |
| `status.profitable` | `true` si se pudo calcular con datos completos, peso mayor a cero y SKU con formato de Amazon. **No mira si hay ganancia.** |
| `status.shouldPause` | Siempre lo opuesto a `profitable`. |
| `status.resolved` | `false` si faltó un dato y todo vino en cero. |

Ver [Ganancia y margen](funcional.md#ganancia-y-margen) y [Cuándo conviene y cuándo pausar](funcional.md#cuándo-conviene-y-cuándo-pausar).

**Errores propios:** si Mercado Libre no informa la comisión, responde `503` con `failedDependency: "meli-api"`, sin calcular.

### Detalle de un producto

```
POST /internal/getProfit/details
```

Mismo body que el resumen. Devuelve cada paso del cálculo.

**Respuesta** (mismo producto, sin aporte)

```json
{
  "input": {
    "mla": "MLA2228742950",
    "categoryId": "MLA31040",
    "publicationType": "gold_special",
    "sku": "B0F47N62NN",
    "salePrice": 250000,
    "meliContributionPercentage": 0
  },
  "prices": {
    "salePrice": 250000,
    "meliContributionPercentage": 0,
    "meliContributionAmount": 0,
    "sellerNetPrice": 250000
  },
  "datosBase": {
    "sku": "B0F47N62NN",
    "weightKg": 1.36,
    "volumetricWeightKg": 1.84,
    "sellerNetPrice": 250000,
    "categoryId": "MLA31040"
  },
  "tiposDeCambio": { "tcAmco": 1020, "tcTlq": 1230 },
  "costosOperativos": {
    "commissionMpPercentage": 14,
    "envioMlAmount": 11000,
    "precioAmzAmount": 55350,
    "depositoUsaAmount": 24600,
    "costosAmcoAmount": 23334.45,
    "imptosAmcoAmount": 12617.95
  },
  "emo": { "ivaCatAranc": 0.21, "sumaTasasYDer": 0.5 },
  "costosCalculados": {
    "utilidadAmount": 0,
    "impuestosMeliAmount": 5000,
    "comisionMpAmount": 35000
  },
  "resultados": {
    "totalCosts": 166902.4,
    "operatingProfit": 83097.6,
    "operatingProfitPercent": "33.2%"
  },
  "precio": { "suggestedPrice": 215088.81, "discount": "13.96%" }
}
```

| Campo | Descripción |
|---|---|
| `datosBase.weightKg` | Peso real en kilos (Madre lo guarda en libras). |
| `datosBase.volumetricWeightKg` | Peso volumétrico: `weightKg` × 1,35. |
| `tiposDeCambio.tcTlq` | Dólar MEP + 2,5 %. |
| `tiposDeCambio.tcAmco` | Dólar oficial + 2 %. |
| `costosOperativos.commissionMpPercentage` | Comisión tal como la informa Mercado Libre (14 = 14 %). |
| `costosOperativos.envioMlAmount` | Envío promedio, siempre 11.000. |
| `costosOperativos.precioAmzAmount` | Producto en Amazon, en pesos. |
| `costosOperativos.depositoUsaAmount` | Depósito en USA: USD 20 en pesos. |
| `costosOperativos.costosAmcoAmount` | Courier. |
| `costosOperativos.imptosAmcoAmount` | Impuestos de importación. |
| `emo.ivaCatAranc` | IVA de la categoría (0,11 se informa como 0,105). |
| `emo.sumaTasasYDer` | Derechos y tasas de la categoría. |
| `costosCalculados.utilidadAmount` | Utilidad adicional; hoy siempre 0. |
| `costosCalculados.impuestosMeliAmount` | Impuestos sobre la venta: 2 % del ingreso. |
| `costosCalculados.comisionMpAmount` | Comisión en pesos. |
| `resultados.totalCosts` | Suma de todos los costos. |
| `resultados.operatingProfit` | Ganancia operativa: ingreso − costos totales. |
| `resultados.operatingProfitPercent` | Texto, con un decimal y `%`. |
| `precio.suggestedPrice` | Precio piso. |
| `precio.discount` | Descuento posible, texto con dos decimales y `%`. Negativo si el precio está debajo del piso. |

El detalle **no trae `status`**. Cuando el cálculo queda incompleto trae `"unresolved": true` además de los ceros; cuando está completo, ese campo no aparece.

El significado de cada costo está en [Los costos, uno por uno](funcional.md#los-costos-uno-por-uno).

### Resumen en lote

```
POST /internal/getProfit/bulk
```

Body: una lista de 1 a 50 productos. Responde una lista de resúmenes, en el mismo orden, con la misma forma que [Resumen de un producto](#resumen-de-un-producto).

```bash
curl -s -X POST "$PRICE_API_URL/internal/getProfit/bulk" \
  -H "x-api-key: $PRICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {"mla":"MLA2228742950","categoryId":"MLA31040","publicationType":"gold_special","sku":"B0F47N62NN","salePrice":731399,"meliContributionPercentage":2.4},
    {"mla":"MLA987654321","categoryId":"MLA410558","publicationType":"gold_pro","sku":"B08S348KVR","salePrice":85000}
  ]'
```

Diferencias con el pedido de a uno:

- Si Mercado Libre no informa la comisión de un producto, **solo ese** vuelve con `resolved: false`; el resto se calcula.
- No revisa cada producto: uno sin `sku` o sin `categoryId` hace fallar el lote entero con `500`. Ver [Pedidos mal armados](errores.md#pedidos-mal-armados).
- No tiene paginado.

### Detalle en lote

```
POST /internal/getProfit/details/bulk?page=1&perPage=10
```

Body: una lista de 1 a 50 productos. Devuelve los detalles paginados.

**Parámetros de la URL**

| Parámetro | Por defecto | Descripción |
|---|---|---|
| `page` | `1` | Página a devolver. Si pide una página que no existe, devuelve la última. |
| `perPage` | La cantidad de productos enviados | Productos por página. Máximo 50. |

Un valor que no sea un entero positivo se ignora y se usa el valor por defecto.

**Respuesta**

```json
{
  "items": [ { "input": { "…": "…" }, "prices": { "…": "…" }, "precio": { "…": "…" } } ],
  "total": 2,
  "page": 1,
  "perPage": 10,
  "totalPages": 1
}
```

Cada elemento de `items` tiene la forma de [Detalle de un producto](#detalle-de-un-producto).

El paginado se hace **después** de calcular el lote completo: pedir una página no ahorra cálculo. Las mismas diferencias con el pedido de a uno que en el [resumen en lote](#resumen-en-lote).

---

## Canales externos

Para Megatone, Frávega y OnCity. La categoría se busca en Madre a partir del SKU y la comisión es fija por canal. Ver [Canales externos](funcional.md#canales-externos).

**Datos de un producto**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `sku` | string | Sí | SKU del producto. |
| `salePrice` | number | Sí | Precio de venta, mayor a 0. |
| `salesChannel` | string | Sí | `megatone`, `fravega` u `oncity`. Acepta mayúsculas y espacios alrededor. |

### Resumen de un producto en un canal

```
POST /internal/getProfit/channel
```

```bash
curl -s -X POST "$PRICE_API_URL/internal/getProfit/channel" \
  -H "x-api-key: $PRICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sku":"B0F47N62NN","salePrice":250000,"salesChannel":"fravega"}'
```

**Respuesta**

```json
{
  "input": { "sku": "B0F47N62NN", "salePrice": 250000, "salesChannel": "fravega" },
  "prices": {
    "salePrice": 250000,
    "meliContributionPercentage": 0,
    "meliContributionAmount": 0,
    "sellerNetPrice": 250000
  },
  "economics": {
    "cost": 214779.39,
    "profitAmount": 35220.61,
    "profitabilityPercent": 14.09,
    "marginPercent": 16.4
  },
  "status": { "profitable": true, "shouldPause": false, "resolved": true }
}
```

Los campos significan lo mismo que en [Mercado Libre](#resumen-de-un-producto), salvo `status.profitable`: acá es `true` solo si el descuento posible (`profitabilityPercent`) está entre 0 % (sin incluir) y 40 % (incluido) y todos los valores del cálculo son mayores a cero. `input.salesChannel` vuelve normalizado en minúsculas.

### Detalle de un producto en un canal

```
POST /internal/getProfit/channel/details
```

Mismo body. Devuelve los mismos bloques que el [detalle de Mercado Libre](#detalle-de-un-producto), con estas diferencias:

- `input` tiene `sku`, `salePrice` y `salesChannel`.
- `datosBase.categoryId` es la categoría encontrada en Madre.
- `costosOperativos.commissionMpPercentage` es la comisión fija del canal.
- **Trae `status`** (`profitable`, `shouldPause`, `resolved`), con la regla de canales externos.

### Detalle en lote en canales

```
POST /internal/getProfit/channel/details/bulk?page=1&perPage=10
```

Body: una lista de 1 a 50 productos, que pueden ser de canales distintos. Mismo paginado y misma respuesta que el [detalle en lote](#detalle-en-lote), con elementos como los del [detalle de un producto en un canal](#detalle-de-un-producto-en-un-canal).

A diferencia de los lotes de Mercado Libre, **revisa cada producto**: si uno está mal armado, responde `400` sin calcular ninguno.

```bash
curl -s -X POST "$PRICE_API_URL/internal/getProfit/channel/details/bulk?perPage=10" \
  -H "x-api-key: $PRICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {"sku":"B0F47N62NN","salePrice":731399,"salesChannel":"megatone"},
    {"sku":"B08S348KVR","salePrice":236999,"salesChannel":"fravega"}
  ]'
```

---

## Estado del servicio

### Health check

```
GET /health
```

No pide clave. No consulta ningún servicio externo: solo confirma que el proceso responde.

```json
{ "status": "ok" }
```

### Prueba de clave

```
GET /
```

Sirve para comprobar que la clave es correcta.

```bash
curl -s "$PRICE_API_URL/" -H "x-api-key: $PRICE_API_KEY"
```

```json
{ "message": "Price API protegida con API key" }
```
