# Quality Bordados — CRM MVP

Aplicación web responsiva para gestionar clientes, pedidos, cobranza y caja de Quality Bordados utilizando React, Firebase Auth y Firestore. Desplegable en GitHub Pages a través de GitHub Actions.

## Características principales

- **Autenticación** con Firebase Email/Password y soporte para _custom claims_ de roles (OWNER, ADMIN, VENTAS, PRODUCCION, COBRANZA).
- **Panel privado** con navegación lateral y métricas clave en el dashboard (pedidos activos, cartera vencida, flujo de caja semanal, entregas próximas).
- **Clientes**: CRUD completo con validaciones (RFC, teléfono MX, límites de crédito), filtros, detalle con historial de pedidos y cálculo de saldo.
- **Pedidos**: Wizard de 4 pasos (cliente → items → importes → confirmación), cálculo automático de totales/saldo, control de prioridades y máquina de estados con bitácora.
- **Cobranza**: listado de pedidos con saldo pendiente, registro de abonos con actualización inmediata del saldo y movimiento automático en caja.
- **Finanzas**: registro de ingresos/egresos, filtros por tipo/categoría/rango de fechas, métricas y reporte PDF estilo CRM.
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
VITE_FIREBASE_STORAGE_BUCKET=xxxxx.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=xxxxxxxxxxxx
VITE_FIREBASE_APP_ID=1:xxxx:web:xxxx
# Opcional para despliegues en subdirectorios (GitHub Pages)
VITE_PUBLIC_BASE_PATH=/qualitybordados.github.io/
```

### Configuración en tiempo de ejecución

Para despliegues estáticos (por ejemplo, GitHub Pages) donde no es deseable
hornear las credenciales en el bundle, la app admite cargar la configuración de
Firebase desde un archivo `firebase-config.js` ubicado junto a los assets
publicados. Copia `public/firebase-config.example.js`, renómbralo a
`firebase-config.js` y reemplaza los valores de ejemplo por los reales. Durante
el arranque la app buscará ese archivo; si existe, sus valores tendrán prioridad
sobre las variables de entorno `VITE_FIREBASE_*`.

## Instalación y uso local

```bash
npm ci
npm run dev
```

`npm run dev` inicia automáticamente el watcher `dev:publish:watch`, que levanta el servidor de desarrollo, vigila `src/`,
`public/` y la configuración clave, reconstruye la app y sincroniza `docs/` en segundo plano cada vez que guardas un archivo. En
cada iteración se ejecuta `version:bust` para generar un nuevo `data-build` y forzar el _cache busting_. El proyecto expone Vite
en http://localhost:5173 y se conecta al proyecto Firebase especificado.

Si trabajas en VSCode o Codespaces, la tarea declarada en `.vscode/tasks.json` ejecutará `npm ci` y lanzará el watcher
automáticamente al abrir la carpeta.

### Build de producción

```bash
npm run build
npm run preview
```

## Flujo de publicación automática

1. **Watcher activo:** cada guardado en `src/`, `public/` o archivos de configuración (`vite.config.ts`, `tailwind.config.js`,
   `postcss.config.js`, `tsconfig*.json`, `scripts/*.mjs`) dispara un rebuild completo (`npm run build`), sincroniza `dist/` →
   `docs/`, ejecuta `version:bust` y valida que `docs/index.html` apunte al `main.[hash].js` más reciente. Los logs indican el
   archivo publicado y el `data-build` generado (formato `YYYYMMDD-HHMMSS`).
2. **Cache busting garantizado:** `docs/index.html` siempre incluye un `data-build` nuevo. Si GitHub Pages sirve una versión
   vieja, realiza un _hard reload_ (Disable cache) o agrega `?v=<data-build>` a la URL.
3. **Hooks obligatorios:** el _pre-commit_ ejecuta `npm run release` (pipeline `clean → build → publish:docs → verify:docs →
   version:bust → verify:docs`) y añade `docs/` + `.docs-build-meta.json` al commit. El _pre-push_ bloquea el push si `docs/`
   está desincronizado (`npm run verify:docs`).
4. **Sin ediciones manuales en `docs/`:** cualquier cambio directo se sobrescribe desde los scripts. Trabaja siempre sobre
   `src/`/`public/` y deja que el watcher o `npm run release` actualicen la carpeta publicada.

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

| Rol | Clientes | Pedidos | Producción | Cobranza | Finanzas | Config |
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
