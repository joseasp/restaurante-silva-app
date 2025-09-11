import Dexie from 'dexie'

export const db = new Dexie('restauranteSilvaDB')

// Versão 13: Adicionando suporte a created_at e updated_at para sincronização incremental
db.version(13).stores({
  // O '?' em 'ativo' indica que o índice é opcional e pode não existir em todos os registros.
  // Isso lida perfeitamente com dados antigos que não tinham o campo 'ativo'.
  clientes: 'id, nome, ativo, id_remoto, ultima_sincronizacao, created_at, updated_at',
  produtos: 'id, nome, ativo, id_remoto, ultima_sincronizacao, created_at, updated_at',
  transacoes: 'id, [data_transacao+tipo_transacao], cliente_id, status_preparo, estornado, id_remoto, ultima_sincronizacao, created_at, updated_at',
  itens_transacao: 'id, transacao_id, produto_id, id_remoto, ultima_sincronizacao, created_at, updated_at',
  configuracoes: '&id, valor',
  funcionarios: 'id, nome, cliente_id, id_remoto, ultima_sincronizacao, created_at, updated_at',
})

// Versão FINAL anterior da estrutura. Qualquer mudança futura será a partir da versão 13.
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

// Removendo as versões antigas e desnecessárias para simplificar o arquivo.
// O Dexie é inteligente e sabe como migrar da última versão salva para a nova.
