// src/stores/dataStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue' // Adiciona 'computed'
import { db, openDbWithRecovery } from '@/services/databaseService.js'
import { supabase } from '@/services/supabaseClient.js';
import { v4 as uuidv4 } from 'uuid';

export const useDataStore = defineStore('data', () => {
  // --- ESTADO (STATE) ---
  const todosOsClientes = ref([]) // Armazena TODOS os clientes (ativos e inativos)
  const produtos = ref([])
  const transacoes = ref([])

  // --- GETTERS (COMPUTED) ---
  // Propriedade computada que deriva a lista de ativos da lista principal
  const clientesAtivos = computed(() => todosOsClientes.value.filter((c) => c.ativo !== false))
  // Os produtos também podem ter um computed para consistência
  const produtosAtivos = computed(() => produtos.value.filter((p) => p.ativo !== false))

  // --- AÇÕES (ACTIONS) ---


  async function fetchClientes() {
    try {
      todosOsClientes.value = await db.clientes.toArray()
    } catch (err) {
      const recoverable = err?.name === 'UpgradeError' || err?.name === 'DatabaseClosedError'
      if (recoverable) {
        await openDbWithRecovery()
        todosOsClientes.value = await db.clientes.toArray()
      } else {
        console.error('Erro CRÍTICO ao buscar clientes no store:', err)
        todosOsClientes.value = []
      }
    }
  }


  async function fetchProdutos() {
    try {
      produtos.value = await db.produtos.toArray()
    } catch (err) {
      const recoverable = err?.name === 'UpgradeError' || err?.name === 'DatabaseClosedError'
      if (recoverable) {
        await openDbWithRecovery()
        produtos.value = await db.produtos.toArray()
      } else {
        console.error('Erro CRÍTICO ao buscar produtos no store:', err)
        produtos.value = []
      }
    }
  }
  // Garante que o Dexie está aberto (ou recuperado) antes de ler
  const carregarDadosIniciais = async () => {
    await openDbWithRecovery()
    await dataStore.fetchClientes()
    await dataStore.fetchProdutos()
    await dataStore.fetchTransacoesDoDia(dataSelecionada.value)
  }

  async function fetchTransacoesDoDia(dataISO) {
    try {
      const transacoesDoDB = await db.transacoes
        .where({ data_transacao: dataISO, tipo_transacao: 'VENDA' })
        .toArray()

      // Usa a lista completa de clientes para encontrar o nome, mesmo que inativo
      const clientesCarregados = todosOsClientes.value

      const lancamentosCompletos = await Promise.all(
        transacoesDoDB.map(async (t) => {
          const itens = await db.itens_transacao.where('transacao_id').equals(t.id).toArray()
          const cliente = clientesCarregados.find((c) => c.id === t.cliente_id)
          return {
            ...t,
            itens,
            cliente_nome: cliente ? cliente.nome : 'Cliente Avulso',
            mostrarSeletorFP: false,
          }
        }),
      )

      lancamentosCompletos.sort((a, b) => {
        if (a.estornado && !b.estornado) return 1
        if (!a.estornado && b.estornado) return -1
        if (!a.estornado) {
          if (a.status_preparo === 'PENDENTE' && b.status_preparo === 'PRONTO') return -1
          if (a.status_preparo === 'PRONTO' && b.status_preparo === 'PENDENTE') return 1
        }
        return (a.id || 0) - (b.id || 0)
      })

      transacoes.value = lancamentosCompletos
    } catch (error) {
      console.error('Erro ao buscar transações do dia:', error)
      transacoes.value = []
    }
  }

  async function lancarPedido(transacao, itens) {
    const transacaoId = uuidv4();
    await db.transacoes.add({ ...transacao, id: transacaoId });
    const itensParaSalvar = itens.map((item) => {
      const { id, ...itemSemId } = item
      return { ...itemSemId, id: uuidv4(), transacao_id: transacaoId }
    })
    await db.itens_transacao.bulkAdd(itensParaSalvar)
    await fetchTransacoesDoDia(transacao.data_transacao)
  }

  async function estornarLancamento(lancamento) {
    await db.transacoes.update(lancamento.id, { estornado: true })
    await fetchTransacoesDoDia(lancamento.data_transacao)
  }

  async function atualizarStatus(lancamento, updates) {
    await db.transacoes.update(lancamento.id, updates)
    await fetchTransacoesDoDia(lancamento.data_transacao)
  }

  async function syncData() {
  return  // PAUSADO TEMPORARIAMENTE
  // console.log("Iniciando rotina de sincronização...");
    try {
      // Sincroniza em ordem de dependência

      // 1. Clientes
      const clientesParaSync = await db.clientes.filter(c => !c.ultima_sincronizacao).toArray();
      if (clientesParaSync.length > 0) {
        const { error } = await supabase.from('clientes').upsert(clientesParaSync.map(({ ultima_sincronizacao, ...rest }) => rest));
        if (error) throw error;
        await db.clientes.bulkUpdate(clientesParaSync.map(c => ({ key: c.id, changes: { ultima_sincronizacao: new Date() } })));
        console.log(`${clientesParaSync.length} clientes sincronizados.`);
      }

      // 2. Produtos
      const produtosParaSync = await db.produtos.filter(p => !p.ultima_sincronizacao).toArray();
      if (produtosParaSync.length > 0) {
        const { error } = await supabase.from('produtos').upsert(produtosParaSync.map(({ ultima_sincronizacao, ...rest }) => rest));
        if (error) throw error;
        await db.produtos.bulkUpdate(produtosParaSync.map(p => ({ key: p.id, changes: { ultima_sincronizacao: new Date() } })));
        console.log(`${produtosParaSync.length} produtos sincronizados.`);
      }

      // 3. Transações
      const transacoesParaSync = await db.transacoes.filter(t => !t.ultima_sincronizacao).toArray();
      if (transacoesParaSync.length > 0) {
        // Renomeia cliente_id para o campo correto no Supabase se for diferente, ou garante que ele exista
        const payload = transacoesParaSync.map(({ ultima_sincronizacao, ...rest }) => rest);
        const { error } = await supabase.from('transacoes').upsert(payload);
        if (error) throw error;
        await db.transacoes.bulkUpdate(transacoesParaSync.map(t => ({ key: t.id, changes: { ultima_sincronizacao: new Date() } })));
        console.log(`${transacoesParaSync.length} transações sincronizadas.`);
      }

      // 4. Itens de Transação
      const itensParaSync = await db.itens_transacao.filter(i => !i.ultima_sincronizacao).toArray();
      if (itensParaSync.length > 0) {
        const payload = itensParaSync.map(({ ultima_sincronizacao, ...rest }) => rest);
        const { error } = await supabase.from('itens_transacao').upsert(payload);
        if (error) throw error;
        await db.itens_transacao.bulkUpdate(itensParaSync.map(i => ({ key: i.id, changes: { ultima_sincronizacao: new Date() } })));
        console.log(`${itensParaSync.length} itens de transação sincronizados.`);
      }

      console.log("Sincronização concluída.");
    } catch (error) {
      console.error("ERRO DURANTE A SINCRONIZAÇÃO:", error);
    }
  }

  async function criarClienteAvulsoPadrao() {
    const clienteAvulsoExiste = await db.clientes.where('nome').equalsIgnoreCase('Cliente Avulso').first();
    if (!clienteAvulsoExiste) {
      console.log("Criando 'Cliente Avulso' padrão...");
      try {
        await db.clientes.add({
          id: uuidv4(),
          nome: 'Cliente Avulso',
          tipo: 'AVULSO',
          ativo: true,
        });
      } catch (error) {
        if (error.name !== 'ConstraintError') {
          console.error('Erro ao criar cliente avulso:', error);
        }
      }
    }
  }

  async function restaurarBackupDaNuvem() {
  console.log("Banco de dados local vazio. Tentando restaurar da nuvem...");
  let sucessoGeral = true;

  const restaurarTabela = async (nomeTabela, dbTable) => {
    try {
      const { data, error } = await supabase.from(nomeTabela).select('*');
      if (error) throw error;
      if (data.length > 0) {
        await dbTable.bulkPut(data.map(d => ({ ...d, ultima_sincronizacao: new Date() })));
        console.log(`${data.length} registros restaurados para '${nomeTabela}'.`);
      }
    } catch (error) {
      console.error(`Falha ao restaurar tabela '${nomeTabela}':`, error);
      sucessoGeral = false;
    }
  };

  await restaurarTabela('clientes', db.clientes);
  await restaurarTabela('produtos', db.produtos);
  await restaurarTabela('transacoes', db.transacoes);
  await restaurarTabela('itens_transacao', db.itens_transacao);
  await restaurarTabela('funcionarios', db.funcionarios);

  console.log(`Restauração da nuvem concluída. Sucesso: ${sucessoGeral}`);
  return sucessoGeral;
}

  async function initialize() {
  console.log("Inicializando o Data Store...");

  const contagemClientes = await db.clientes.count();

  // Lógica crucial:
  // 1. Verifica se o banco local está vazio.
  if (contagemClientes === 0) {
    console.log("Banco local vazio detectado.");

    // 2. Tenta restaurar da nuvem.
    const restauradoComSucesso = await restaurarBackupDaNuvem();

    // 3. SOMENTE se a restauração falhar (ex: primeiro uso, sem internet),
    //    cria os dados padrão.
    if (!restauradoComSucesso) {
      console.log("Restauração falhou ou não havia dados. Criando padrões.");
      await criarClienteAvulsoPadrao();
    }
  }

  // 4. Após garantir que os dados locais existem (seja por restauração ou criação),
  //    carrega-os para a memória da aplicação.
  await fetchClientes();
  await fetchProdutos();

  // 5. Inicia a rotina de sincronização de UPLOAD.
  console.log("Iniciando a primeira sincronização de upload.");
  await syncData();
  setInterval(syncData, 120000); // E a cada 2 minutos
}

  // --- RETORNO ---
  return {
    // Listas completas
    todosOsClientes,
    produtos,
    // Listas computadas (filtradas)
    clientesAtivos,
    produtosAtivos,
    // Outros estados
    transacoes,
    // Ações
    fetchClientes,
    fetchProdutos,
    initialize,
    fetchTransacoesDoDia,
    lancarPedido,
    estornarLancamento,
    atualizarStatus,
    syncData,
    restaurarBackupDaNuvem,
  }
})
