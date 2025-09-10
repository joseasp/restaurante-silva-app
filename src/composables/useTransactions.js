// Crie este novo arquivo: src/composables/useTransactions.js

import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '../services/supabaseClient'

export function useTransactions() {
  const transactions = ref([]) // Nossa lista de transações reativa

  const fetchTransactions = async (date) => {
    try {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('transacoes')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      transactions.value = data || []; // Se a busca for bem-sucedida
    } catch (error) {
      console.error('Erro ao buscar transações:', error.message);
      transactions.value = []; // AQUI ESTÁ A MÁGICA: se a busca falhar, garanta que a lista fique vazia.
      // Opcional: Notificar o usuário sobre a falha
      // $q.notify({ type: 'negative', message: 'Falha ao carregar os lançamentos. Verifique sua conexão.' });
    }
  };

  // Função para adicionar uma nova transação (pedido)
const addTransaction = async (transactionData) => {
  try {
    const { data, error } = await supabase
      .from('transacoes')
      .insert([transactionData])
      .select();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao adicionar transação:', error.message);
  }
};

// Função genérica para atualizar qualquer campo de uma transação
const updateTransaction = async (id, updates) => {
  try {
    const { data, error } = await supabase
      .from('transacoes')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Erro ao atualizar transação:', error.message);
  }
};

  // A função retorna a lista e a função de busca para que os componentes possam usá-las
  return {
    transactions,
    fetchTransactions,
    addTransaction,
    updateTransaction
  }
}