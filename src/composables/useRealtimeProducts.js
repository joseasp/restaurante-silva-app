// src/composables/useRealtimeProducts.js
// Realtime: Supabase -> IndexedDB (Dexie), HMR-safe
import { supabase } from '@/services/supabaseClient'
import { db } from '@/services/databaseService'

export function setupRealtimeProducts() {
  if (window.__rtProdutosChannel) return window.__rtProdutosChannel

  const channel = supabase
    .channel('rt-produtos')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'produtos' },
      async (payload) => {
        try {
          if (payload.eventType === 'DELETE') {
            await db.produtos.delete(payload.old.id)
            return
          }
          await db.produtos.put({ ...payload.new, ultima_sincronizacao: new Date() })
        } catch (e) {
          console.error('Erro ao aplicar evento realtime de produtos:', e)
        }
      },
    )
    .subscribe((status) => {
      console.log('Realtime produtos:', status)
    })

  window.__rtProdutosChannel = channel
  return channel
}
