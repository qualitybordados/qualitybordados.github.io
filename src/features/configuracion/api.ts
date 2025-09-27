import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { ConfiguracionForm } from '@/lib/validators'
import { registrarBitacora } from '@/lib/firestore'

const configDoc = doc(db, 'configuracion', 'general')

export async function fetchConfiguracion() {
  const snapshot = await getDoc(configDoc)
  if (!snapshot.exists()) {
    const defaults: ConfiguracionForm = {
      porcentaje_anticipo: 50,
      dias_credito: 30,
      politicas_credito: 'Pagar 50% de anticipo para aprobar pedido.',
      roles_visibles: ['OWNER', 'ADMIN', 'VENTAS', 'PRODUCCION', 'COBRANZA'],
    }
    await setDoc(configDoc, {
      ...defaults,
      actualizado_en: serverTimestamp(),
    })
    return defaults
  }
  const data = snapshot.data() as ConfiguracionForm
  return data
}

export async function guardarConfiguracion(values: ConfiguracionForm, usuarioId: string) {
  await setDoc(
    configDoc,
    {
      ...values,
      actualizado_en: serverTimestamp(),
    },
    { merge: true },
  )

  await registrarBitacora({
    entidad: 'configuracion',
    entidad_id: 'general',
    accion: 'ACTUALIZAR',
    usuario: usuarioId,
    datos: values,
  })
}
