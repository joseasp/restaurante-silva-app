// src/stores/dataStore.js
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { db } from '@/services/databaseService.js';

export const useDataStore = defineStore('data', () => {
  const clientes = ref([]);
  const produtos = ref([]);

  async function fetchClientes() {
    try {
      // ABORDAGEM SEGURA: Busca todos e filtra depois.
      const todosOsClientes = await db.clientes.toArray();
      // Filtra apenas os que não estão explicitamente inativos.
      clientes.value = todosOsClientes.filter(c => c.ativo !== false);
    } catch (error) {
      console.error("Erro CRÍTICO ao buscar clientes no store:", error);
      clientes.value = []; // Em caso de erro, retorna um array vazio para não quebrar a UI.
    }
  }

  async function fetchProdutos() {
    try {
      // ABORDAGEM SEGURA: Busca todos e filtra depois.
      const todosOsProdutos = await db.produtos.toArray();
      // Filtra apenas os que não estão explicitamente inativos.
      produtos.value = todosOsProdutos.filter(p => p.ativo !== false);
    } catch (error) {
      console.error("Erro CRÍTICO ao buscar produtos no store:", error);
      produtos.value = []; // Em caso de erro, retorna um array vazio.
    }
  }

  // Função inicial para carregar tudo
  async function initialize() {
    await fetchClientes();
    await fetchProdutos();

    // --- LÓGICA ADICIONADA ---
    // Verifica se o cliente avulso já foi criado
    const clienteAvulsoExiste = clientes.value.some(c => c.nome === 'Cliente Avulso');

    if (!clienteAvulsoExiste) {
      console.log("Criando 'Cliente Avulso' padrão...");
      try {
        await db.clientes.add({
          nome: 'Cliente Avulso',
          tipo: 'AVULSO',
          ativo: true
        });
        await fetchClientes(); // Recarrega a lista de clientes para incluir o novo
      } catch (error) {
        // Ignora o erro caso o cliente já exista (uma segurança extra)
        if (error.name !== 'ConstraintError') {
          console.error("Erro ao criar cliente avulso:", error);
        }
      }
    }
  }

  return { clientes, produtos, fetchClientes, fetchProdutos, initialize };
});