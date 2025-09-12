
import Dexie from 'dexie'

// 1) Name first — do NOT reference `db` here
const DB_NAME = 'restauranteSilvaDB'

// 2) Create the instance before any use
export const db = new Dexie(DB_NAME)

// 3) KEEP YOUR CURRENT SCHEMA HERE (unchanged)
db.version(12).stores({
  // O '?' em 'ativo' indica que o índice é opcional e pode não existir em todos os registros.
  // Isso lida perfeitamente com dados antigos que não tinham o campo 'ativo'.
  clientes: 'id, nome, ativo, id_remoto, ultima_sincronizacao',
  produtos: 'id, nome, ativo, id_remoto, ultima_sincronizacao',
  transacoes: 'id, [data_transacao+tipo_transacao], cliente_id, status_preparo, estornado, id_remoto, ultima_sincronizacao',
  itens_transacao: 'id, transacao_id, produto_id, id_remoto, ultima_sincronizacao',
  configuracoes: '&id',
  funcionarios: 'id, nome, cliente_id, id_remoto, ultima_sincronizacao',
})

// 4) Recovery/open helper AFTER db exists
export async function openDbWithRecovery() {
  try {
    await db.open()
  } catch (err) {
    const msg = String(err?.message || '')
    const isRecoverable =
      err?.name === 'UpgradeError' ||
      err?.name === 'DatabaseClosedError' ||
      msg.includes('Not yet support for changing primary key')

    if (!isRecoverable) throw err

    const guardKey = `${db.name}-dexie-reset-guard-v${db.verno || 'x'}`
    if (!localStorage.getItem(guardKey)) {
      try {
        console.warn('[Dexie] Incompatible schema. Resetting local DB once...', err)
        localStorage.setItem(guardKey, '1')
        await db.delete()
        await db.open()
        console.info('[Dexie] Local DB recreated successfully.')
      } catch (re) {
        console.error('[Dexie] Failed to recover DB after delete/open.', re)
        throw re
      }
    } else {
      console.error('[Dexie] Recovery already attempted once. Rethrowing.', err)
      throw err
    }
  }
}

// 5) Eager open (with recovery) on module load
void openDbWithRecovery()

// 6) DEV helper to wipe DB manually if needed
if (typeof window !== 'undefined') {
  window.__wipeLocalDb = async () => {
    try {
      const guardKey = `${db.name}-dexie-reset-guard-v${db.verno || 'x'}`
      localStorage.removeItem(guardKey)
      await db.delete()
      location.reload()
    } catch (e) {
      console.error('Failed to wipe local DB:', e)
    }
  }
}
