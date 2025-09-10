// src/stores/dataStore.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '@/services/databaseService.js'
import { supabase } from '@/services/supabaseClient.js';
import { v4 as uuidv4 } from 'uuid';

export const useDataStore = defineStore('data', () => {
  // --- ESTADO (STATE) ---
  const todosOsClientes = ref([])
  const produtos = ref([])

  // --- GETTERS (COMPUTED) ---
  const clientesAtivos = computed(() => todosOsClientes.value.filter((c) => c.ativo !== false))
  const produtosAtivos = computed(() => produtos.value.filter((p) => p.ativo !== false))

  // --- AÇÕES (ACTIONS) ---

  async function fetchClientes() {
    try {
      todosOsClientes.value = await db.clientes.toArray()
    } catch (error) {
      console.error('Erro CRÍTICO ao buscar clientes no store:', error)
      todosOsClientes.value = []
    }
  }

  async function fetchProdutos() {
    try {
      produtos.value = await db.produtos.toArray()
    } catch (error) {
      console.error('Erro CRÍTICO ao buscar produtos no store:', error)
      produtos.value = []
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
    console.log("Banco de dados local vazio. Tentando restaurar Clientes e Produtos da nuvem...");
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
    await restaurarTabela('funcionarios', db.funcionarios);
    
    console.log(`Restauração da nuvem concluída. Sucesso: ${sucessoGeral}`);
    return sucessoGeral;
  }

  async function initialize() {
    console.log("Inicializando o Data Store...");
    
    const contagemClientes = await db.clientes.count();
    
    if (contagemClientes === 0) {
      console.log("Banco local vazio detectado.");
      const restauradoComSucesso = await restaurarBackupDaNuvem();
      if (!restauradoComSucesso) {
        console.log("Restauração falhou ou não havia dados. Criando padrões.");
        await criarClienteAvulsoPadrao();
      }
    }

    await fetchClientes();
    await fetchProdutos();
  }

  // --- RETORNO ---
  return {
    // Listas completas
    todosOsClientes,
    produtos,
    // Listas computadas (filtradas)
    clientesAtivos,
    produtosAtivos,
    // Ações
    fetchClientes,
    fetchProdutos,
    initialize,
    restaurarBackupDaNuvem,
  }
})