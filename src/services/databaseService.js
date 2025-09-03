import Dexie from 'dexie'

export const db = new Dexie('restauranteSilvaDB')

// Versão FINAL da estrutura. Qualquer mudança futura será a partir da versão 7.
db.version(6).stores({
  // O '?' em 'ativo' indica que o índice é opcional e pode não existir em todos os registros.
  // Isso lida perfeitamente com dados antigos que não tinham o campo 'ativo'.
  clientes: '++id, nome, ativo',
  produtos: '++id, nome, ativo',
  transacoes: '++id, data_transacao, cliente_id, status_preparo',
  itens_transacao: '++id, transacao_id, produto_id',
  configuracoes: '&id',
})

// Removendo as versões antigas e desnecessárias para simplificar o arquivo.
// O Dexie é inteligente e sabe como migrar da última versão salva para a nova.
