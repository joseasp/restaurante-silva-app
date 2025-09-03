<template>
  <div class="contas-container">
    <div class="lista-clientes">
      <h2>Clientes com Histórico</h2>
      <ul>
        <li
          v-for="cliente in todosOsClientesComConta"
          :key="cliente.id"
          @click="selecionarCliente(cliente)"
          :class="{ active: clienteSelecionado && clienteSelecionado.id === cliente.id }"
        >
          <span>{{ cliente.nome }}</span>
          <span
            class="saldo"
            :class="{ devedor: cliente.saldo > 0.01, credor: cliente.saldo < -0.01 }"
          >
            R$ {{ cliente.saldo.toFixed(2) }}
          </span>
        </li>
      </ul>
    </div>

    <div class="extrato-cliente">
      <div v-if="!clienteSelecionado" class="placeholder-extrato">
        <h2>Selecione um cliente para ver o extrato</h2>
      </div>
      <div v-else>
        <h2>Extrato de: {{ clienteSelecionado.nome }}</h2>
        <div
          class="saldo-total"
          :class="{
            devedor: clienteSelecionado.saldo > 0.01,
            credor: clienteSelecionado.saldo < -0.01,
          }"
        >
          <span v-if="clienteSelecionado.saldo > 0.01"
            >Saldo Devedor: R$ {{ clienteSelecionado.saldo.toFixed(2) }}</span
          >
          <span v-else-if="clienteSelecionado.saldo < -0.01"
            >Crédito Disponível: R$ {{ Math.abs(clienteSelecionado.saldo).toFixed(2) }}</span
          >
          <span v-else>Saldo Zerado</span>
        </div>

        <form @submit.prevent="registrarPagamento" class="pagamento-form">
          <input
            type="number"
            step="0.01"
            placeholder="Valor do Pagamento"
            v-model="valorPagamento"
            required
          />
          <button type="submit">Registrar Pagamento</button>
        </form>

        <ul class="lista-transacoes">
          <li
            v-for="t in clienteSelecionado.transacoes"
            :key="t.id"
            :class="t.tipo_transacao.toLowerCase()"
          >
            <div class="transacao-header">
              <span>{{ new Date(t.created_at || t.data_transacao).toLocaleString('pt-BR') }}</span>
              <span class="tipo-transacao">{{ t.tipo_transacao }}</span>
              <span :class="{ 'valor-positivo': t.valor > 0, 'valor-negativo': t.valor < 0 }">
                R$ {{ t.valor > 0 ? '+' : '' }}{{ t.valor.toFixed(2) }}
              </span>
            </div>
            <!-- NOVO: Mostra os itens se for uma venda -->
            <ul v-if="t.tipo_transacao === 'VENDA' && t.itens" class="itens-da-venda">
              <li v-for="item in t.itens" :key="item.id">
                - {{ item.quantidade }}x {{ item.nome_produto_congelado }}
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useDataStore } from '@/stores/dataStore.js';
import { db } from '@/services/databaseService.js';

const dataStore = useDataStore();

const todosOsClientesComConta = ref([]);
const clienteSelecionado = ref(null);
const valorPagamento = ref('');

// Get the active clients from the store
const clientesAtivos = computed(() => dataStore.clientes);

const carregarContas = async () => {
  try {
    const todosOsClientesDoBanco = await db.clientes.toArray();
    const todasTransacoes = await db.transacoes.toArray();
    
    const clientesAtivos = todosOsClientesDoBanco.filter(c => {
      if (c.ativo === undefined) c.ativo = true;
      // --- FILTRO ADICIONADO AQUI ---
      return c.ativo === true && c.tipo !== 'AVULSO'; 
    });

    const contas = clientesAtivos.map(cliente => {
      const transacoesDoCliente = todasTransacoes.filter(t => t.cliente_id === cliente.id);
      
      const saldo = transacoesDoCliente.reduce((acc, t) => {
        if (t.tipo_transacao === 'VENDA' && t.metodo_pagamento === 'Não Pago') {
          return acc + t.valor;
        }
        if (t.tipo_transacao === 'PAGAMENTO') {
          return acc + t.valor;
        }
        return acc;
      }, 0);
      
      const transacoesComItens = transacoesDoCliente.map(t => {
        if (t.tipo_transacao === 'VENDA') {
          const itens = []; // Placeholder
          return { ...t, itens };
        }
        return t;
      }).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

      return { ...cliente, saldo, transacoes: transacoesComItens };
    });

    todosOsClientesComConta.value = contas.sort((a, b) => a.nome.localeCompare(b.nome));

  } catch (error) {
    console.error("Erro ao carregar contas:", error);
    todosOsClientesComConta.value = [];
  }
};

const selecionarCliente = (cliente) => {
  clienteSelecionado.value = cliente;
};

const registrarPagamento = async () => {
  if (!clienteSelecionado.value || !valorPagamento.value) return;
  const valor = parseFloat(valorPagamento.value);
  if (valor <= 0) {
    alert('O valor do pagamento deve ser positivo.');
    return;
  }
  try {
    const clienteId = clienteSelecionado.value.id;
    await db.transacoes.add({
      cliente_id: clienteId,
      tipo_transacao: 'PAGAMENTO',
      valor: -valor,
      data_transacao: new Date().toISOString().slice(0, 10),
      created_at: new Date(),
    });
    valorPagamento.value = '';
    await carregarContas();
    const clienteAtualizado = todosOsClientesComConta.value.find((c) => c.id === clienteId);
    selecionarCliente(clienteAtualizado);
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error);
  }
};

// Watch for changes in the store's clients and reload the accounts
watch(clientesAtivos, carregarContas, { immediate: true });

</script>

<style scoped>
.contas-container {
  display: flex;
  height: calc(100vh - 58px);
}
.lista-clientes {
  width: 350px;
  border-right: 1px solid #ddd;
  overflow-y: auto;
}
.lista-clientes h2 {
  padding: 20px;
  margin: 0;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  font-size: 1.2em;
}
.lista-clientes ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.lista-clientes li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
}
.lista-clientes li:hover {
  background: #f0f0f0;
}
.lista-clientes li.active {
  background: #ffc107;
  color: black;
  font-weight: bold;
}
.saldo {
  font-weight: bold;
}
.saldo.devedor {
  color: #dc3545;
}
.saldo.credor {
  color: #198754;
}

.extrato-cliente {
  flex-grow: 1;
  padding: 20px;
  overflow-y: auto;
}
.placeholder-extrato {
  text-align: center;
  color: #888;
  margin-top: 50px;
}
.saldo-total {
  font-size: 1.5em;
  font-weight: bold;
  margin: 10px 0 20px;
}
.saldo-total.devedor {
  color: #dc3545;
}
.saldo-total.credor {
  color: #198754;
}
.pagamento-form {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}
.pagamento-form input {
  flex-grow: 1;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.pagamento-form button {
  padding: 10px 15px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.lista-transacoes li {
  display: grid;
  grid-template-columns: 160px 100px 1fr;
  gap: 10px;
  padding: 10px;
  border-bottom: 1px solid #eee;
  align-items: center;
}
.valor-positivo {
  color: #dc3545;
  text-align: right;
}
.valor-negativo {
  color: #28a745;
  text-align: right;
}
</style>
