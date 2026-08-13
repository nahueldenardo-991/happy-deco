# Sistema de Gestión Financiera y Rentabilidad - Happy Deco

**Versión:** 1.0  
**Fecha:** 13 de agosto de 2026  
**Alcance:** auditoría, modelo conceptual, fórmulas, UX y arquitectura de la primera versión funcional.

## 1. Resumen ejecutivo

Happy Deco ya tiene tres activos valiosos: un manual operativo muy detallado, un catálogo comercial con nueve propuestas y una primera planilla que reconoce que materiales, trabajo, traslado, mobiliario e indirectos tienen costo. La principal brecha no es la falta de datos aislados: es la falta de un modelo único que conecte venta, operación, costo real, cobro, caja y resultado mensual.

La recomendación es ampliar el ecosistema web existente con un módulo financiero conectado a la misma base de clientes y eventos. La primera versión incluida en esta entrega permite registrar eventos con pocos campos, calcular precio mínimo y recomendado, medir margen, visualizar el punto de equilibrio, distinguir caja de rentabilidad, controlar activos y exportar un respaldo.

Las cifras que no provienen del material fuente están identificadas como **DEMO**. No deben utilizarse para cotizar hasta ser validadas.

## 2. Fuentes auditadas

1. **Manual de Operaciones Happy Deco BETA**: 3.825 párrafos, procesos desde captación hasta post-evento, roles, tiempos, materiales, logística, control de calidad y anexos operativos.
2. **Catálogo Happy Deco v2**: nueve propuestas, inclusiones y condiciones generales. Los precios están reemplazados por `$$$$$`, por lo que no existe una lista de precios utilizable en la fuente.
3. **HappyDeco_COSTOS- clasica.xlsx**: ocho hojas (`DATOS_EVENTO`, `MATERIALES`, `MOBILIARIO`, `TRASLADO`, `MANO_DE_OBRA`, `COSTOS_INDIRECTOS`, `RESUMEN`, `RESULTADO`).

## 3. Auditoría - información disponible

### 3.1 Manual operativo

El manual aporta:

- ADN de marca: calidez, estética, detalle, excelencia, tranquilidad y experiencia WOW.
- Flujo completo del evento, desde el lead hasta el cierre y la fidelización.
- Roles operativos, responsabilidades y etapas de trabajo.
- Brief del evento, datos de lugar, acceso, interior/exterior y banderas rojas.
- Política comercial: seña, saldo previo, cambios, reprogramación y extras cotizados.
- Materiales, herramientas, consumibles, stock, proveedores y kit de emergencia.
- Preproducción, carga, traslado, montaje, styling, desmontaje, descarga, limpieza y mantenimiento.
- Control de calidad y regla explícita: nunca bajar precio sin bajar alcance.
- Ficha madre, packing list, checklists y tabla de tiempos como concepto operativo.

### 3.2 Catálogo comercial

El catálogo documenta, sin inventar inclusiones:

- Express.
- Minimalista.
- Clásica.
- Intermedia.
- Premium.
- Exclusiva.
- Escenográfica 3x3.
- Escenográfica 6x3.
- Escenográfica 10x3.

Condiciones comunes: globos incluidos, traslado y retiro incluidos en Santiago Capital, otras localidades con adicional, seña para reservar, saldo previo al evento, imágenes ilustrativas y adaptación al espacio. No incluye pastelería ni papelería creativa.

Existe una inconsistencia de nomenclatura que debe resolverse: el manual usa `Esencial / Wow / Premium / Personalizado`, mientras el catálogo utiliza las nueve propuestas anteriores. El catálogo debe ser la fuente comercial activa y el manual debe actualizarse o mapearse.

### 3.3 Excel de costos

El ejemplo registra:

- Venta: $430.000.
- Materiales: $52.550.
- Mobiliario y mantenimiento: $5.958.
- Traslado: $20.000.
- Mano de obra: $53.040.
- Indirectos asignados: $112.500.
- Costo total: $244.048.
- Resultado informado: $185.952.
- Margen informado: 43,24%.

Conceptualmente está bien que el archivo incluya consumibles, trabajo de las socias, traslado, amortización e indirectos.

## 4. Información faltante

### Prioridad crítica

- Precios actuales y fecha de vigencia de las nueve propuestas.
- Costos estándar reales por propuesta.
- Lista maestra de insumos con unidad, proveedor, costo y fecha de actualización.
- Inventario completo con cantidades, fecha y valor de compra, estado y vida útil.
- Horas reales por persona, función y etapa.
- Política impositiva y condición fiscal aplicable.
- Comisiones reales por medio de pago.
- Costos fijos completos y frecuencia.
- Cobros y pagos con fecha de vencimiento y fecha efectiva.
- Saldo inicial de caja y cuentas bancarias.
- Remuneración objetivo de cada socia por función.

### Prioridad alta

- Kilómetros, viajes, vehículo, consumo y estacionamiento por evento.
- Roturas, pérdidas, desperdicio y mantenimiento por activo.
- Descuentos, extras y responsable que los autorizó.
- Leads, reservas y facturación atribuida a publicidad.
- Capacidad operativa mensual y horas disponibles.
- Presupuesto mensual y escenarios de retiro.

## 5. Fortalezas del modelo actual

- Separa costos en categorías comprensibles.
- Usa cantidad por costo unitario para materiales.
- Reconoce la mano de obra como costo.
- Reconoce que el mobiliario propio se consume económicamente.
- Calcula un resultado por evento.
- Mantiene los cálculos visibles y simples.

## 6. Errores y riesgos financieros detectados

1. **La comisión comercial está mal modelada.** La fila `vendedor / comisión` contiene 7 horas y $6.500 por hora, pero su subtotal visible es $0. Una comisión debe ser porcentaje de venta o importe fijo, no horas sin fórmula.
2. **El margen está mal nombrado.** `Precio - costo total` es resultado operativo del evento, no “ganancia bruta”. La ganancia bruta y el margen de contribución requieren definiciones consistentes.
3. **No existe facturación neta.** Faltan comisión de cobro e impuestos antes de comparar con costos.
4. **Indirectos asignados sólo por cantidad de eventos.** Un Express recibe el mismo costo que una Escenográfica 10x3. Se necesitan drivers configurables.
5. **Publicidad tratada completamente como indirecto del evento.** Puede asignarse por fuente/lead o mantenerse como gasto comercial del período; no siempre corresponde dividirla en partes iguales.
6. **Mantenimiento fijo en 10%.** No está sustentado por historial ni separado de roturas y reposición.
7. **Activos con vida útil cero generan costo cero.** El activo “otros” por $300.000 queda sin amortización, subestimando costos.
8. **Tanza mezclada con mobiliario.** Es consumible y debe estar en materiales.
9. **Fecha almacenada como texto inválido.** `01//04/2026` impide agrupar y proyectar correctamente.
10. **No distingue estándar de real.** No puede explicar desvíos de consumo, horas o logística.
11. **No distingue rentabilidad de caja.** Una seña cobrada no equivale a venta ganada y una compra de activo no debe cargarse completa a un evento.
12. **No existe período de vigencia de costos.** En un contexto inflacionario, un costo sin fecha puede volver inválida una cotización.
13. **No hay controles de integridad.** Faltan alertas por costos en cero, activos sin vida útil, horas sin valor y eventos sin cobros.

## 7. Costos que pueden estar olvidándose

- Diseño, atención comercial, seguimiento, compras y administración.
- Carga, descarga, lavado, limpieza y guardado.
- Tiempo de traslado de todas las personas, no sólo combustible.
- Viajes múltiples, peajes, estacionamiento, flete y desgaste del vehículo.
- Impresión fallida, repuestos, desperdicio de globos y materiales de prueba.
- Herramientas menores, baterías, extensiones y kit de emergencia.
- Roturas, pérdidas, limpieza y mantenimiento de mobiliario.
- Seguro, seguridad, accidentes y contingencias climáticas.
- Comisiones de plataformas, cuotas y costo financiero.
- Impuestos nacionales, provinciales y municipales.
- Fotografía, contenido y post-evento.
- Almacenamiento, software, teléfono, asesoramiento y administración.
- Costo de oportunidad por bloquear una fecha de alta demanda.

## 8. Datos mínimos a registrar desde ahora

### Al cotizar

- Cliente, fecha, propuesta, ubicación, precio, extras, descuento y medio de pago.
- Ajustes respecto del estándar: globos, gráfica, mobiliario, personas, horas, kilómetros y dificultad.

### Durante y después

- Horas reales por persona y etapa.
- Consumibles reales y compras específicas.
- Kilómetros, viajes y gastos logísticos.
- Activos usados, roturas y mantenimiento.
- Cobros, comisiones, impuestos y saldos pendientes.
- Resultado de calidad y motivo de cualquier desvío.

## 9. Modelo conceptual

### Entidades principales

- **Clientes** 1:N **Eventos**.
- **Propuestas** 1:N **Eventos** y 1:N **Estándares de propuesta**.
- **Eventos** 1:N **Consumos**, **Horas**, **Usos de activo**, **Viajes**, **Cobros** y **Extras**.
- **Insumos** N:1 **Proveedores**; los consumos apuntan a insumos y conservan el costo histórico usado.
- **Personal** 1:N **Horas** y 1:N **Remuneraciones**.
- **Mobiliario** 1:N **Usos de activo**, **Mantenimientos** y **Reposiciones**.
- **Gastos** N:1 **Categorías de gasto** y opcionalmente N:1 **Eventos**.
- **Presupuestos mensuales** 1:N **Líneas de presupuesto**.
- **Movimientos de caja** se relacionan con cobros, pagos, retiros, inversiones y fondos internos.
- **Campañas** 1:N **Leads**; leads pueden convertirse en clientes/eventos.

### Reglas de datos

- Cada importe guarda moneda, fecha y origen.
- Cada costo estándar tiene vigencia desde/hasta.
- El costo real del evento conserva el precio histórico aunque cambie el maestro.
- Los datos DEMO llevan un indicador eliminable.
- Las bajas deben ser lógicas para preservar trazabilidad.
- Los cambios de supuestos deben quedar en un registro de versiones.

## 10. Fórmulas auditables

### Evento

`Venta bruta = precio de lista - descuento + extras`

Ejemplo: $430.000 - $0 + $0 = $430.000.

`Comisión de cobro = venta bruta × tasa del medio de pago`

`Impuestos sobre venta = base imponible × tasa aplicable`

`Venta neta = venta bruta - comisión de cobro - impuestos sobre venta`

`Costo de material = cantidad real × costo unitario histórico`

`Costo de mano de obra = suma(horas por persona y etapa × valor hora vigente)`

`Costo logístico = kilómetros × costo por km + peajes + estacionamiento + fletes + tiempo de traslado`

`Costo por uso de activo = máximo(valor depreciable / vida útil en eventos; depreciación por tiempo) + mantenimiento esperado por uso`

`Margen de contribución $ = venta neta - materiales - mano de obra variable - logística - comisiones variables - otros variables`

`Margen de contribución % = margen de contribución $ / venta bruta`

`Resultado operativo del evento = margen de contribución - amortización por uso - indirectos asignados`

`Margen operativo % = resultado operativo / venta bruta`

`Ganancia por hora = resultado operativo / horas totales`

`Desvío de costo = costo real - costo estándar ajustado`

`Desvío % = desvío de costo / costo estándar ajustado`

### Precio

`Precio mínimo rentable = costo relevante / (1 - margen mínimo - tasa variable sobre venta)`

Si el costo es $244.048 y el margen mínimo es 30%, sin tasas variables: $244.048 / 0,70 = $348.640.

`Precio recomendado = costo relevante / (1 - margen objetivo - tasa variable sobre venta)`

Con margen objetivo de 40%: $244.048 / 0,60 = $406.747.

### Indirectos

Cada categoría debe elegir un driver:

- Por evento: costos que ocurren una vez por evento.
- Por horas productivas: almacenamiento, supervisión o administración ligada a complejidad.
- Por facturación: seguros o costos que escalan con venta.
- Por lead/reserva: publicidad atribuible.
- Sin asignar al evento: gastos corporativos que se evalúan sólo en el resultado mensual.

`Indirecto asignado = pool mensual × consumo de driver del evento / consumo total del driver del mes`

### Punto de equilibrio

`PE en pesos = costos fijos / ratio de contribución promedio ponderado`

`PE en eventos = costos fijos / contribución promedio por evento`

Para un mix: `resultado del mix = suma(cantidad por propuesta × contribución estándar) - costos fijos`.

### Caja

`Saldo final = saldo inicial + cobros - pagos`

`Runway = caja disponible / egresos fijos mensuales normalizados`

### Retiros

`Utilidad distribuible = resultado operativo - reserva impuestos - reposición - emergencia - reinversión`

Escenarios iniciales configurables:

- Conservador: mayor fondo de emergencia y reinversión.
- Equilibrado: reserva y crecimiento balanceados.
- Distribución alta: mayor retiro con alerta de runway posterior.

Nunca se calcula un retiro desde el saldo bancario.

### Publicidad

`CPL = gasto publicitario / leads`

`Costo por reserva = gasto publicitario / reservas`

`Conversión = reservas / leads`

`ROAS = facturación atribuida / gasto publicitario`

## 11. Experiencia de usuario

### Pantallas

1. Dashboard: KPIs, alertas, punto de equilibrio, caja y lectura ejecutiva.
2. Nuevo evento: cliente, fecha, propuesta, precio, extras, descuento y ajustes excepcionales.
3. Eventos: ficha financiera, cobros, costos y estado.
4. Rentabilidad: ranking por evento/propuesta, desvíos y ganancia por hora.
5. Propuestas: inclusiones reales, estándar, mínimo y recomendado.
6. Gastos: fijos, variables, presupuesto vs real y driver.
7. Personal: roles, horas, valor hora y remuneración separada de utilidades.
8. Mobiliario: inventario, usos, mantenimiento y alerta de reposición.
9. Caja: movimientos, cuentas a cobrar/pagar y 30/60/90 días.
10. Punto de equilibrio: pesos, eventos y mix.
11. Publicidad: CPL, conversión y ROAS.
12. Configuración: márgenes, tasas, drivers, fondos, backup e importación.

### Flujo de nuevo evento

1. Elegir cliente.
2. Elegir propuesta.
3. Ingresar precio.
4. Marcar extras/descuento.
5. Ajustar sólo lo que cambia frente al estándar.
6. Ver costo, mínimo, recomendado y margen antes de guardar.

## 12. Arquitectura recomendada

### Decisión

Aplicación web responsive integrada al portal Happy Deco, con base SQL compartida y exportación a Excel/PDF.

### Motivos

- El negocio ya posee un portal web, CRM, proceso, producción y una base Supabase.
- Una app separada duplicaría clientes y eventos.
- Una planilla única no resuelve bien usuarios concurrentes, historial, permisos y trazabilidad.
- Excel seguirá siendo formato de importación/exportación y herramienta de análisis ad hoc.

### Capas

- Interfaz web para carga y dashboard.
- Servicio de cálculo con fórmulas versionadas.
- Base relacional para datos maestros y transacciones.
- Capa de importación/exportación.
- Registro de auditoría y backups.

### Persistencia de la v1

La versión entregada persiste en el dispositivo y permite exportar/importar un backup JSON. El siguiente paso técnico es mover los registros al esquema SQL compartido y dejar el almacenamiento local sólo como cola offline. No se debe considerar el almacenamiento del navegador como fuente definitiva en producción.

## 13. Alcance de la primera versión funcional

Incluye:

- Dashboard mensual.
- Alta rápida de evento.
- Base de nueve propuestas con inclusiones del catálogo.
- Cotización con costo estimado, precio mínimo, recomendado y alerta de margen.
- Rentabilidad por evento.
- Punto de equilibrio.
- Personal, mobiliario, caja y publicidad.
- Parámetros configurables.
- Datos DEMO identificados y eliminables.
- Backup e importación.

Pendiente para producción:

- Validar todos los costos y precios reales.
- Sincronización SQL multiusuario.
- Importador directo de Excel con mapeo asistido.
- Gestión completa de cobros/pagos y fondos internos.
- Generación de PDF de cotización.
- Roles y permisos.
- Historial de cambios y cierre mensual.

## 14. Plan de implementación recomendado

### Semana 1 - Datos maestros

Validar propuestas, precios, insumos, proveedores, personal, activos, impuestos y costos fijos.

### Semana 2 - Operación real

Cargar eventos activos, cobros, horas y costos; comparar estándar contra real.

### Semana 3 - Caja y presupuesto

Configurar saldos, compromisos, presupuesto mensual, fondos y política de retiro.

### Semana 4 - Cierre y gobierno

Revisar indicadores, ajustar drivers, documentar cierre mensual, permisos y backup.

## 15. Decisiones que deben validar las socias

1. Precios vigentes y fecha de actualización.
2. Margen mínimo y objetivo por propuesta.
3. Valor hora por función, incluso cuando la realiza una socia.
4. Driver de asignación por cada costo indirecto.
5. Tratamiento impositivo y de comisiones.
6. Política de reservas, reinversión y retiro.
7. Fuente comercial oficial: catálogo v2 y mapeo con el manual.

Hasta que esos siete puntos estén validados, el sistema sirve para aprender y ordenar datos, pero no debe considerarse una fuente definitiva de precios.
