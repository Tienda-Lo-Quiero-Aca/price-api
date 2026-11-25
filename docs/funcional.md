# Guía funcional

Cómo se calcula la rentabilidad de un producto, explicado desde el negocio: qué datos usa, qué costos suma, cómo sale el precio piso y cuándo un producto conviene.

← [Volver al inicio](../README.md)

**Contenido**

1. [La pregunta que responde](#la-pregunta-que-responde)
2. [Qué datos usa](#qué-datos-usa)
3. [Lo que cobra el vendedor](#lo-que-cobra-el-vendedor)
4. [El dólar](#el-dólar)
5. [Los costos, uno por uno](#los-costos-uno-por-uno)
6. [El precio piso](#el-precio-piso)
7. [Ganancia y margen](#ganancia-y-margen)
8. [Cuándo conviene y cuándo pausar](#cuándo-conviene-y-cuándo-pausar)
9. [Canales externos](#canales-externos)
10. [Ejemplo completo](#ejemplo-completo)
11. [Valores fijos del cálculo](#valores-fijos-del-cálculo)

---

## La pregunta que responde

> Si vendo este producto a este precio, en este canal, ¿cuánto me cuesta traerlo y venderlo, y cuánto gano?

Todos los productos son importados de Amazon a pedido. El costo no es solo el precio en Amazon: hay que sumarle el depósito en Estados Unidos, el courier (AMCO), los impuestos de importación, el envío al comprador, la comisión del canal y los impuestos sobre la venta.

El servicio no guarda nada ni cambia precios. Calcula con los datos del momento y devuelve el resultado.

---

## Qué datos usa

| Dato | De dónde sale |
|---|---|
| Precio de venta | Lo informa quien consulta. |
| Aporte de Mercado Libre en la promoción | Lo informa quien consulta (opcional, solo Mercado Libre). |
| Precio del producto en Amazon, en dólares | Madre (último relevamiento del producto). |
| Peso del producto | Madre. Viene en libras y se pasa a kilos. |
| Categoría de Mercado Libre | La informa quien consulta. En canales externos se busca en Madre a partir del SKU. |
| Impuestos de importación de la categoría | Madre (tabla de impuestos por categoría). |
| Comisión de venta | Mercado Libre la informa para cada publicación, precio y tipo de publicación. En canales externos es fija. |
| Cotización del dólar | CriptoYa (dólar MEP y oficial). |

Si falta alguno de los datos de Madre o la comisión, el cálculo no se hace y la respuesta viene **en cero** con `resolved: false`. Ver [Errores y cálculos incompletos](errores.md).

---

## Lo que cobra el vendedor

En una promoción de Mercado Libre con aporte, el comprador paga el precio de venta y Mercado Libre pone una parte extra. Lo que entra es la suma de los dos:

| Concepto | Cálculo |
|---|---|
| Aporte de Mercado Libre | Precio de venta × % de aporte |
| **Ingreso del vendedor** | Precio de venta + aporte de Mercado Libre |

Ejemplo: precio $250.000 con 2,4 % de aporte → Mercado Libre pone $6.000 → el ingreso es **$256.000**.

Sin aporte (o en canales externos), el ingreso es igual al precio de venta. Todo el resto del cálculo se hace sobre el **ingreso**, no sobre el precio de venta.

---

## El dólar

Se usan dos cotizaciones, cada una con un recargo:

| Cotización | Base | Recargo | Se usa para |
|---|---|---|---|
| **TC TLQ** | Dólar MEP (AL30, 24 hs) | + 2,5 % | Precio del producto, depósito en USA e impuestos de importación. |
| **TC AMCO** | Dólar oficial | + 2 % | Costo del courier. |

La cotización se consulta a CriptoYa y se reutiliza durante **12 horas**. Si CriptoYa no responde, se sigue usando la última que se obtuvo, aunque tenga más de 12 horas.

---

## Los costos, uno por uno

### Producto en Amazon

Precio en Amazon (USD) × TC TLQ.

### Depósito en USA

Un valor fijo de **USD 20** por producto × TC TLQ.

### Courier (AMCO)

Depende del **peso volumétrico**, que se estima como peso real × 1,35.

| Componente | Valor en USD |
|---|---|
| Flete | 7 por kilo volumétrico |
| Seguro de flete | 0,65 × 1,10 por kilo volumétrico |
| Fijo por envío | 3 |
| Gastos de despacho | (250 ÷ 200 + 255 × 1,21 ÷ 200) por kilo volumétrico |

El total en dólares se pasa a pesos con el TC AMCO, y se le suma el **1 % del costo del producto**.

### Impuestos de importación

Los productos entran por courier con una franquicia de **USD 400**:

1. **Valor en aduana** = costo del producto × 1,01 + USD 2,5 por kilo real (en pesos, con TC TLQ).
2. **Excedente** = lo que supera los USD 400. Si no supera, es cero.
3. **Derechos y tasas** = excedente × la suma de tasas y derechos de la categoría.
4. **IVA** = (valor en aduana + derechos y tasas) × la alícuota de IVA de la categoría.
5. **Impuestos de importación** = derechos y tasas + IVA.

Las dos alícuotas salen de la tabla de impuestos por categoría en Madre. Si la categoría tiene IVA de 11 %, se toma como **10,5 %**.

### Envío al comprador

Un promedio fijo de **$11.000** por venta, para cualquier producto.

### Comisión de venta

- **Mercado Libre:** el porcentaje que Mercado Libre informa para esa publicación, a ese precio y con ese tipo de publicación (`gold_special`, `gold_pro`…).
- **Canales externos:** un porcentaje fijo por canal. Ver [Canales externos](#canales-externos).

Se aplica sobre el ingreso del vendedor.

### Impuestos sobre la venta

**2 %** del ingreso del vendedor.

---

## El precio piso

Es el **precio mínimo de venta que deja un 25 % de ganancia operativa**. Se calcula así:

```
                 producto + depósito USA + courier + impuestos de importación + envío
precio piso = ─────────────────────────────────────────────────────────────────────────
                       1 − 2 % (impuestos) − comisión − 25 % (ganancia objetivo)
```

Arriba van los costos que no dependen del precio; abajo, los que son un porcentaje del precio (impuestos y comisión) y la ganancia buscada.

### El descuento posible

Compara el ingreso actual con el precio piso:

```
descuento = 1 − precio piso ÷ ingreso del vendedor
```

| Descuento | Qué quiere decir |
|---|---|
| Positivo (ej. 13,96 %) | Se puede bajar el precio hasta ese porcentaje y seguir ganando el 25 %. |
| Cero | El precio actual es justo el piso. |
| Negativo (ej. −43,39 %) | El precio está por debajo del piso: habría que subirlo ese porcentaje para ganar el 25 %. |

---

## Ganancia y margen

La respuesta trae dos formas de medir la ganancia, y conviene no confundirlas.

### Ganancia operativa (en el detalle)

Lo que queda del ingreso después de pagar **todos** los costos:

| Concepto | Cálculo |
|---|---|
| Costos totales | producto + depósito + courier + impuestos de importación + envío + comisión + impuestos sobre la venta |
| **Ganancia operativa** | ingreso − costos totales |
| % de ganancia operativa | ganancia operativa ÷ ingreso |

Está en `resultados` de los endpoints de detalle.

### Diferencia contra el precio piso (en el resumen)

Los endpoints de resumen (`/internal/getProfit`, `/bulk`, `/channel`) informan en `economics` cuánto está el ingreso **por encima del precio piso**, no la ganancia operativa:

| Campo | Qué es en realidad |
|---|---|
| `cost` | **El precio piso**, no el costo del producto. |
| `profitAmount` | Ingreso − precio piso. |
| `profitabilityPercent` | `profitAmount` ÷ ingreso. Es el mismo número que el [descuento posible](#el-descuento-posible). |
| `marginPercent` | `profitAmount` ÷ precio piso. |

Como el precio piso ya incluye un 25 % de ganancia, un `profitAmount` de cero significa "gano exactamente el 25 %", no "no gano nada". En el [ejemplo](#ejemplo-completo), con un ingreso de $250.000 la ganancia operativa es $83.097,60 (33,2 %) y `profitAmount` es $34.911,19.

---

## Cuándo conviene y cuándo pausar

La respuesta trae `profitable` y `shouldPause`, que siempre son opuestos. La regla **no es la misma** en Mercado Libre y en canales externos.

### En Mercado Libre

`profitable` es `true` cuando se pudo calcular con datos completos. **No mira si hay ganancia.** Es `false` (y `shouldPause` es `true`) solo si:

- falta algún valor del cálculo,
- el peso del producto es cero o no está cargado, o
- el SKU no tiene formato de producto de Amazon: `B0` seguido de 8 letras o números (ej. `B0F47N62NN`).

Un producto que pierde plata a ese precio sale igual con `profitable: true`. Para decidir si la promoción conviene hay que mirar `economics` o el [descuento posible](#el-descuento-posible).

### En canales externos

`profitable` es `true` solo si el [descuento posible](#el-descuento-posible) está **entre 0 % (sin incluir) y 40 % (incluido)** y todos los valores del cálculo son mayores a cero. Es decir:

| Situación | Resultado |
|---|---|
| El precio está por debajo del piso (descuento ≤ 0 %) | Pausar |
| El precio está entre el piso y un 40 % de descuento | Conviene |
| El precio supera el piso por más de un 40 % de descuento | Pausar: el precio se considera fuera de rango |
| Falta algún dato o vale cero | Pausar |

### Cuando no se pudo calcular

Si `resolved` es `false`, la respuesta viene en cero y `shouldPause` sale en `true` **por falta de datos, no porque el producto no convenga**. Antes de pausar algo hay que mirar `resolved`. Ver [Errores y cálculos incompletos](errores.md).

---

## Canales externos

Para Megatone, Frávega y OnCity alcanza con el SKU y el precio. La categoría se busca en Madre a partir del SKU (la de la primera publicación de Mercado Libre asociada), y la comisión es fija:

| Canal | Valor de `salesChannel` | Comisión |
|---|---|---|
| Megatone | `megatone` | 18,15 % |
| Frávega | `fravega` | 13,915 % |
| OnCity | `oncity` | 15 % |

No hay aporte del canal: el ingreso es igual al precio de venta. El resto del cálculo es idéntico al de Mercado Libre, incluido el envío promedio de $11.000.

El canal se acepta con mayúsculas o espacios (`" Fravega "`); se normaliza a minúsculas.

---

## Ejemplo completo

Un producto de USD 45 en Amazon, que pesa 3 libras, en una categoría con IVA 21 % y 50 % de derechos y tasas. Dólar MEP $1.200, oficial $1.000. Se vende en Mercado Libre a **$250.000**, sin aporte, con 14 % de comisión.

**Datos base**

| Dato | Valor |
|---|---|
| Peso | 3 lb = 1,36 kg |
| Peso volumétrico | 1,36 × 1,35 = 1,84 kg |
| TC TLQ | 1.200 × 1,025 = $1.230 |
| TC AMCO | 1.000 × 1,02 = $1.020 |
| Ingreso del vendedor | $250.000 |

**Costos**

| Costo | Cálculo | Monto |
|---|---|---|
| Producto en Amazon | 45 × 1.230 | $55.350,00 |
| Depósito en USA | 20 × 1.230 | $24.600,00 |
| Courier (AMCO) | USD 22,33 × 1.020 + 1 % de 55.350 | $23.334,45 |
| Impuestos de importación | valor en aduana $60.085,50, no supera USD 400 → solo IVA 21 % | $12.617,95 |
| Envío al comprador | fijo | $11.000,00 |
| Comisión de Mercado Libre | 14 % de 250.000 | $35.000,00 |
| Impuestos sobre la venta | 2 % de 250.000 | $5.000,00 |
| **Costos totales** | | **$166.902,40** |

**Resultado**

| Concepto | Valor |
|---|---|
| Ganancia operativa | 250.000 − 166.902,40 = **$83.097,60 (33,2 %)** |
| Precio piso | 126.902,40 ÷ (1 − 0,02 − 0,14 − 0,25) = **$215.088,81** |
| Descuento posible | 1 − 215.088,81 ÷ 250.000 = **13,96 %** |
| `economics.profitAmount` | 250.000 − 215.088,81 = $34.911,19 |
| `status.profitable` | `true` |

Con 2,4 % de aporte de Mercado Libre, el ingreso pasa a $256.000 y el descuento posible a 15,98 %.

El mismo producto en Frávega a $250.000 tiene precio piso $214.779,39 (comisión 13,915 %) y descuento posible 14,09 %: **conviene**. A $400.000 el descuento posible sería 46,31 %, más del 40 %, y saldría **pausar**.

---

## Valores fijos del cálculo

No dependen del producto ni del momento: están definidos en el servicio y cambiarlos requiere un deploy. Dónde está cada uno en el código figura en [Arquitectura y configuración](tecnico.md#valores-fijos-del-cálculo).

| Valor | Cuánto |
|---|---|
| Ganancia operativa objetivo (precio piso) | 25 % |
| Impuestos sobre la venta | 2 % |
| Utilidad adicional | 0 % |
| Comisiones de canales externos | Megatone 18,15 % · Frávega 13,915 % · OnCity 15 % |
| Envío promedio al comprador | $11.000 |
| Franquicia de importación | USD 400 |
| Depósito en USA | USD 20 |
| Tarifas del courier | Ver [Courier](#courier-amco) |
| Peso volumétrico | peso real × 1,35 |
| Recargos del dólar | MEP + 2,5 % · oficial + 2 % |
| Tope de descuento en canales externos | 40 % |
| Vigencia de la cotización del dólar | 12 horas |
