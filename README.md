# Quality Bordados — CRM MVP

Aplicación web responsiva para gestionar clientes, pedidos, cobranza y caja de Quality Bordados utilizando React, Firebase Auth y Firestore. Desplegable en GitHub Pages a través de GitHub Actions.

## Características principales

- **Autenticación** con Firebase Email/Password y soporte para _custom claims_ de roles (OWNER, ADMIN, VENTAS, PRODUCCION, COBRANZA).
- **Panel privado** con navegación lateral y métricas clave en el dashboard (pedidos activos, cartera vencida, flujo de caja semanal, entregas próximas).
- **Clientes**: CRUD completo con validaciones (RFC, teléfono MX, límites de crédito), filtros, detalle con historial de pedidos y cálculo de saldo.
- **Pedidos**: Wizard de 4 pasos (cliente → items → importes → confirmación), cálculo automático de totales/saldo, control de prioridades y máquina de estados con bitácora.
- **Cobranza**: listado de pedidos con saldo pendiente, registro de abonos con actualización inmediata del saldo y movimiento automático en caja.
- **Caja**: registro de ingresos/egresos, filtros por tipo/categoría/rango de fechas, totales y exportación CSV rápida.
- **Configuración**: anticipo mínimo por defecto, políticas de crédito y administración de roles visibles (solo OWNER/ADMIN).

## Tecnologías

- React + Vite + TypeScript
- TailwindCSS + componentes utilitarios propios inspirados en shadcn/ui
- Zustand para estado de autenticación (vía `useAuthStore`)
- React Query para caché de datos y sincronización con Firestore
- Firebase v10 modular (Auth + Firestore)
- Day.js, Zod, React Hook Form, Lucide Icons, Recharts

## Requisitos previos

- Node.js 18+
- Cuenta Firebase con proyecto configurado
- Colecciones Firestore creadas según el modelo provisto
- Roles asignados vía `custom claims` en Firebase Auth

## Variables de entorno

Crea un archivo `.env` (o configura en GitHub Pages → Repository Variables) con:

```
VITE_FIREBASE_API_KEY=xxxxx
VITE_FIREBASE_AUTH_DOMAIN=xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxxxx
VITE_FIREBASE_APP_ID=1:xxxx:web:xxxx
# Opcional para despliegues en subdirectorios (GitHub Pages)
VITE_PUBLIC_BASE_PATH=/qualitybordados.github.io/
```

## Instalación y uso local

```bash
npm install
npm run dev
```

El proyecto expone Vite en http://localhost:5173 y se conecta al proyecto Firebase especificado.

### Build de producción

```bash
npm run build
npm run preview
```

## Estructura de Firestore

### Colecciones principales

- `clientes`
- `pedidos`
  - Subcolecciones `pedido_items` y `produccion_eventos`
- `abonos`
- `movimientos_caja`
- `bitacora`
- `configuracion` (documento `general`)

### Índices recomendados

Configura los índices compuestos en Firestore:

1. `pedidos` — `status` (asc) + `fecha_compromiso` (desc)
2. `abonos` — `cliente_id` (asc) + `pedido_id` (asc) + `fecha` (desc)
3. `movimientos_caja` — `fecha` (desc) + `tipo` (asc)

## Roles y permisos de la UI

| Rol | Clientes | Pedidos | Producción | Cobranza | Caja | Config |
| --- | --- | --- | --- | --- | --- | --- |
| OWNER / ADMIN | acceso total | total | total | total | total | total |
| VENTAS | crear/editar | crear/editar hasta APROBADO | ver | ver | ver | ver |
| PRODUCCION | ver | actualizar estados operativos | total | ver | ver | ver |
| COBRANZA | ver | ver | ver | registrar abonos | registrar movimientos | ver |

> Las reglas de seguridad de Firestore deben reforzar estas restricciones.

## Despliegue a GitHub Pages

1. Habilita GitHub Actions en el repositorio.
2. Configura `VITE_*` como Repository Variables/Secrets.
3. Ajusta el archivo de workflow (no incluido) para ejecutar `npm ci`, `npm run build` y publicar `/dist` en GitHub Pages.
4. Si el sitio se aloja en un subdirectorio (p.ej. `username.github.io/project`), define `VITE_PUBLIC_BASE_PATH` con la ruta base.

## Semillas y pruebas manuales

Se recomienda usar los **Firebase Emulators** para semillas locales:

```bash
firebase emulators:start --only auth,firestore
```

Casos de prueba sugeridos:

- Crear cliente con RFC inválido → validación UI.
- Crear pedido sin anticipo suficiente → confirmación adicional.
- Registrar abono y verificar saldo actualizado y movimiento en caja.
- Cambiar estado de pedido hasta `CERRADO` sólo cuando el saldo es 0.
- Revisar visibilidad de acciones según rol autenticado.

## Próximos pasos sugeridos

- Generación de documentos PDF (cotizaciones / órdenes de trabajo).
- Notificaciones por correo / WhatsApp en cambios de estado.
- Integración con Firebase Storage para evidencias en producción.
- Automatizaciones con Cloud Functions (cierre de pedidos, recordatorios de cobranza).
- KPIs adicionales y proyecciones financieras.

---

> Proyecto listo para `npm run dev` y `npm run build`. Ajusta reglas de seguridad de Firestore antes de publicar en producción.
