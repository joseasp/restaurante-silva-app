// Crie este novo arquivo: src/composables/useTransactions.js

import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '../services/supabaseClient'

export function useTransactions() {
  const transactions = ref([]) // Nossa lista de transações reativa

  // Função para buscar os dados iniciais
  const fetchTransactions = async (date) => {
    // Formata a data para o início e fim do dia
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    try {
      const { data, error } = await supabase
        .from('transacoes')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      transactions.value = data;
    } catch (error) {
      console.error('Erro ao buscar transações:', error.message)
    }
  }

  // A função retorna a lista e a função de busca para que os componentes possam usá-las
  return {
    transactions,
    fetchTransactions
  }
}