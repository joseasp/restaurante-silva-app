<template>
  <div class="container">
    <h1>Gestão de Clientes</h1>

    <!-- Formulário para adicionar novos clientes -->
    <form @submit.prevent="adicionarCliente" class="client-form">
      <input v-model="novoCliente.nome" type="text" placeholder="Nome do Cliente" required />
      <input v-model="novoCliente.contato" type="text" placeholder="Contato (Telefone)" />
      <select v-model="novoCliente.tipo" required>
        <option disabled value="">Selecione o tipo</option>
        <option>CRÉDITO</option>
        <option>EMPRESA</option>
      </select>
      <textarea v-model="novoCliente.observacoes" placeholder="Observações..."></textarea>
      <button type="submit">Adicionar Cliente</button>
    </form>

    <!-- Lista de clientes existentes -->
    <ul class="client-list">
      <li v-for="cliente in clientes" :key="cliente.id">
        <span
          ><strong>{{ cliente.nome }}</strong> ({{ cliente.tipo }})</span
        >
        <span>{{ cliente.contato }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useDataStore } from '@/stores/dataStore.js';
import { db } from '@/services/databaseService.js';

const dataStore = useDataStore();

// Estado reativo para o formulário
const novoCliente = ref({
  nome: '',
  contato: '',
  tipo: '',
  observacoes: '',
  ativo: true // Adicionado para consistência
});

// Busca os clientes do store central
const clientes = computed(() => dataStore.clientes);

// Função para adicionar um novo cliente
const adicionarCliente = async () => {
  if (!novoCliente.value.nome || !novoCliente.value.tipo) {
    alert('Por favor, preencha pelo menos o nome e o tipo.');
    return;
  }

  const nomeExistente = await db.clientes
    .where('nome')
    .equalsIgnoreCase(novoCliente.value.nome.trim())
    .first();

  if (nomeExistente) {
    alert(`O cliente "${novoCliente.value.nome}" já existe no cadastro.`);
    return;
  }

  try {
    await db.clientes.add({ ...novoCliente.value, nome: novoCliente.value.nome.trim() });
    
    // Limpa o formulário
    novoCliente.value = { nome: '', contato: '', tipo: '', observacoes: '', ativo: true };
    
    // ATUALIZA O STORE, que vai notificar todos os componentes
    await dataStore.fetchClientes();

  } catch (error) {
    console.error("Erro ao adicionar cliente:", error);
  }
};
</script>

<style scoped>
/* Estilos similares aos de Produtos, com pequenos ajustes */
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: sans-serif;
}

h1 {
  color: #ffc107;
  text-align: center;
}

.client-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
}

.client-form input,
.client-form select,
.client-form textarea {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.client-form textarea {
  grid-column: 1 / -1; /* Ocupa a largura toda */
}

.client-form button {
  grid-column: 1 / -1; /* Ocupa a largura toda */
  padding: 10px;
  background-color: #ffc107;
  color: black;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.client-list li {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  border-bottom: 1px solid #eee;
}
</style>
