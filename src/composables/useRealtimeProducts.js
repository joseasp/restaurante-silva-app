// src/composables/useRealtimeProducts.js
import { ref } from 'vue'
import { liveQuery } from 'dexie'
import { db } from '@/services/databaseService.js'
import { useObservable } from '@vueuse/rxjs'

export function useRealtimeProducts({ onlyActive = true } = {}) {
  const loading = ref(true)
  const error = ref(null)

  const observable = liveQuery(async () => {
    loading.value = true
    try {
      let lista = await db.produtos.toArray()
      if (onlyActive) {
        lista = lista.filter((p) => p.ativo !== false)
      }
      // Ordene como preferir (por nome/preço/data)
      lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
      return lista
    } catch (err) {
      error.value = err
      return []
    } finally {
      loading.value = false
    }
  })

  const products = useObservable(observable, { initialValue: [] })
  return { products, loading, error }
}
