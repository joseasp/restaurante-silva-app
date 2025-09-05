<template>
  <div class="container">
    <h1>Gestão de Clientes</h1>

    <form @submit.prevent="salvarCliente" class="client-form">
      <input v-model="formCliente.nome" type="text" placeholder="Nome do Cliente" required />
      <input v-model="formCliente.contato" type="text" placeholder="Contato (Telefone)" />
      <select v-model="formCliente.tipo" required>
        <option disabled value="">Selecione o tipo</option>
        <option>CRÉDITO</option>
        <option>EMPRESA</option>
      </select>
      <textarea v-model="formCliente.observacoes" placeholder="Observações..."></textarea>

      <div class="form-actions">
        <button type="submit" class="btn-salvar">
          {{ clienteEmEdicao ? 'Salvar Alterações' : 'Adicionar Cliente' }}
        </button>
        <button v-if="clienteEmEdicao" type="button" @click="cancelarEdicao" class="btn-cancelar">
          Cancelar
        </button>
      </div>
    </form>

    <div class="filter-container">
      <label>
        <input type="checkbox" v-model="mostrarInativos" @change="carregarClientes" />
        Mostrar clientes inativos
      </label>
    </div>

    <h2>Clientes Cadastrados</h2>
    <ul class="client-list">
      <li v-if="clientes.length === 0">Nenhum cliente encontrado.</li>
      <li v-for="cliente in clientes" :key="cliente.id" :class="{ inativo: !cliente.ativo }">
        <div class="info-cliente">
          <span
            ><strong>{{ cliente.nome }}</strong> ({{ cliente.tipo }})</span
          >
          <span>{{ cliente.contato }}</span>
        </div>
        <div class="acoes-cliente">
          <button @click="iniciarEdicao(cliente)" class="btn-editar">✏️</button>
          <button v-if="cliente.ativo" @click="desativarCliente(cliente)" class="btn-desativar">
            Desativar
          </button>
          <button v-else @click="reativarCliente(cliente)" class="btn-reativar">Reativar</button>
        </div>
      </li>
    </ul>

    <!-- Modal de PIN -->
    <PinModal
      :visible="mostrarPinModal"
      @close="mostrarPinModal = false"
      @success="executarAcaoPendente"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { db } from '@/services/databaseService.js'
import { useDataStore } from '@/stores/dataStore.js'
import PinModal from '@/components/PinModal.vue'

const dataStore = useDataStore()

const getInitialForm = () => ({
  nome: '',
  contato: '',
  tipo: '',
  observacoes: '',
})

const formCliente = ref(getInitialForm())
const clientes = ref([])
const mostrarInativos = ref(false)
const clienteEmEdicao = ref(null)

// Refs para o Modal de PIN
const mostrarPinModal = ref(false)
const acaoPendente = ref(null)

const carregarClientes = () => {
  let clientesDoStore = dataStore.todosOsClientes

  if (mostrarInativos.value) {
    clientes.value = [...clientesDoStore].sort((a, b) => a.nome.localeCompare(b.nome))
  } else {
    clientes.value = clientesDoStore.filter((c) => c.ativo === true)
  }
}

watch(
  () => dataStore.todosOsClientes,
  () => {
    carregarClientes()
  },
  { deep: true, immediate: true },
)

onMounted(() => {
  dataStore.fetchClientes()
})

const iniciarEdicao = (cliente) => {
  clienteEmEdicao.value = cliente
  formCliente.value = { ...cliente }
}

const cancelarEdicao = () => {
  clienteEmEdicao.value = null
  formCliente.value = getInitialForm()
}

const salvarCliente = async () => {
  if (!formCliente.value.nome || !formCliente.value.tipo) {
    alert('Por favor, preencha pelo menos o nome e o tipo.')
    return
  }

  if (clienteEmEdicao.value) {
    try {
      const dadosParaAtualizar = {
        nome: formCliente.value.nome.trim(),
        contato: formCliente.value.contato,
        tipo: formCliente.value.tipo,
        observacoes: formCliente.value.observacoes,
      }
      await db.clientes.update(clienteEmEdicao.value.id, dadosParaAtualizar)
      await dataStore.fetchClientes()
      cancelarEdicao()
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error)
    }
  } else {
    const nomeExistente = await db.clientes
      .where('nome')
      .equalsIgnoreCase(formCliente.value.nome.trim())
      .first()

    if (nomeExistente) {
      alert(`O cliente "${formCliente.value.nome}" já existe no cadastro.`)
      return
    }

    try {
      await db.clientes.add({
        ...formCliente.value,
        nome: formCliente.value.nome.trim(),
        ativo: true,
      })
      await dataStore.fetchClientes()
      formCliente.value = getInitialForm()
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error)
    }
  }
}

// Função para executar a ação após sucesso no PIN
const executarAcaoPendente = () => {
  if (acaoPendente.value) {
    acaoPendente.value()
  }
  mostrarPinModal.value = false
  acaoPendente.value = null
}

// CÓDIGO NOVO E CORRETO
const desativarCliente = (cliente) => {
  if (cliente.tipo === 'AVULSO' || cliente.nome === 'Cliente Avulso') {
    alert("O 'Cliente Avulso' não pode ser desativado.")
    return
  }
  acaoPendente.value = async () => {
    // A lógica de desativação agora é executada diretamente após o PIN
    await db.clientes.update(cliente.id, { ativo: false })
    await dataStore.fetchClientes() // Atualiza o store global
  }
  mostrarPinModal.value = true
}

// Função de reativar
const reativarCliente = async (cliente) => {
  try {
    await db.clientes.update(cliente.id, { ativo: true })
    await dataStore.fetchClientes() // Atualiza o store global
  } catch (error) {
    console.error('Erro ao reativar cliente:', error)
  }
}
</script>

<style scoped>
.container {
  max-width: 800px;
  margin: 20px auto;
  padding: 20px;
  font-family: sans-serif;
}
h1,
h2 {
  text-align: center;
}
h2 {
  margin-top: 30px;
}
.client-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}
.client-form input,
.client-form select,
.client-form textarea {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.client-form textarea {
  grid-column: 1 / -1;
  resize: vertical;
  min-height: 60px;
}
.form-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
}
.form-actions button {
  padding: 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.btn-salvar {
  flex-grow: 1;
  background-color: #ffc107;
  color: black;
}
.btn-cancelar {
  background-color: #6c757d;
  color: white;
}
.filter-container {
  margin: 20px 0;
  text-align: center;
}
.client-list {
  list-style: none;
  padding: 0;
}
.client-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #eee;
}
.client-list li:last-child {
  border-bottom: none;
}
.client-list li.inativo {
  background-color: #f8f9fa;
  color: #adb5bd;
}
.client-list li.inativo .info-cliente span {
  text-decoration: line-through;
}
.info-cliente {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.acoes-cliente {
  display: flex;
  gap: 10px;
}
.acoes-cliente button {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: white;
  font-weight: bold;
}
.btn-editar {
  background-color: #0d6efd;
}
.btn-desativar {
  background-color: #dc3545;
}
.btn-reativar {
  background-color: #198754;
}
</style>
