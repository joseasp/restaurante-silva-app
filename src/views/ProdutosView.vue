<template>
  <div class="container">
    <h1>Gestão de Produtos</h1>

    <form @submit.prevent="salvarProduto" class="product-form">
      <input v-model="formProduto.nome" type="text" placeholder="Nome do Produto" required />
      <input
        v-model="formProduto.preco"
        type="number"
        step="0.01"
        placeholder="Preço (R$)"
        required
      />
      <div class="form-actions">
        <button type="submit" class="btn-salvar">
          {{ produtoEmEdicao ? 'Salvar Alterações' : 'Adicionar Produto' }}
        </button>
        <button v-if="produtoEmEdicao" type="button" @click="cancelarEdicao" class="btn-cancelar">
          Cancelar
        </button>
      </div>
    </form>

    <div class="filter-container">
      <label>
        <input type="checkbox" v-model="mostrarInativos" />
        Mostrar produtos inativos
      </label>
    </div>

    <h2>Produtos Cadastrados</h2>
    <ul class="product-list">
      <li v-if="produtos.length === 0">Nenhum produto encontrado.</li>
      <li v-for="produto in produtos" :key="produto.id" :class="{ inativo: !produto.ativo }">
        <div class="info-produto">
          <span>{{ produto.nome }}</span>
          <span>R$ {{ produto.preco ? produto.preco.toFixed(2) : '0.00' }}</span>
        </div>
        <div class="acoes-produto">
          <button @click="iniciarEdicao(produto)" class="btn-editar">✏️</button>
          <button v-if="produto.ativo" @click="desativarProduto(produto)" class="btn-desativar">
            Desativar
          </button>
          <button v-else @click="reativarProduto(produto)" class="btn-reativar">Reativar</button>
        </div>
      </li>
    </ul>

    <!-- Modal de PIN adicionado -->
    <PinModal
      :visible="mostrarPinModal"
      @close="mostrarPinModal = false"
      @success="executarAcaoPendente"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useDataStore } from '@/stores/dataStore.js'
import { db } from '@/services/databaseService.js'
import PinModal from '@/components/PinModal.vue'

const dataStore = useDataStore()

const getInitialForm = () => ({ nome: '', preco: '' })
const formProduto = ref(getInitialForm())
const produtoEmEdicao = ref(null)
const produtos = ref([])
const mostrarInativos = ref(false)

// Refs para o Modal de PIN
const mostrarPinModal = ref(false)
const acaoPendente = ref(null)

// Função que lê do store e popula a lista local
const carregarProdutos = () => {
  if (mostrarInativos.value) {
    produtos.value = [...dataStore.produtos].sort((a, b) => a.nome.localeCompare(b.nome))
  } else {
    produtos.value = dataStore.produtosAtivos
  }
}

// Observa o checkbox para recarregar a lista
watch(mostrarInativos, carregarProdutos)

// Observa as listas do store para manter a tela atualizada
watch(
  () => dataStore.produtos,
  () => {
    carregarProdutos()
  },
  { deep: true },
)

onMounted(() => {
  // Garante que os dados do store sejam buscados ao montar
  dataStore.fetchProdutos().then(() => {
    carregarProdutos()
  })
})

const iniciarEdicao = (produto) => {
  produtoEmEdicao.value = produto
  formProduto.value = { ...produto }
}

const cancelarEdicao = () => {
  produtoEmEdicao.value = null
  formProduto.value = getInitialForm()
}

const salvarProduto = async () => {
  if (!formProduto.value.nome || !formProduto.value.preco) {
    alert('Por favor, preencha o nome e o preço.')
    return
  }

  if (produtoEmEdicao.value) {
    try {
      await db.produtos.update(produtoEmEdicao.value.id, {
        nome: formProduto.value.nome,
        preco: parseFloat(formProduto.value.preco),
      })
      await dataStore.fetchProdutos() // Apenas atualiza o store
      cancelarEdicao()
    } catch (error) {
      console.error('Erro ao atualizar produto:', error)
    }
  } else {
    try {
      await db.produtos.add({
        nome: formProduto.value.nome,
        preco: parseFloat(formProduto.value.preco),
        ativo: true,
      })
      await dataStore.fetchProdutos() // Apenas atualiza o store
      formProduto.value = getInitialForm()
    } catch (error) {
      console.error('Erro ao adicionar produto:', error)
    }
  }
}

const desativarProduto = (produto) => {
  acaoPendente.value = async () => {
    // A lógica agora é executada após o PIN
    await db.produtos.update(produto.id, { ativo: false })
    await dataStore.fetchProdutos() // Atualiza o store
  }
  mostrarPinModal.value = true
}

const reativarProduto = async (produto) => {
  try {
    await db.produtos.update(produto.id, { ativo: true })
    await dataStore.fetchProdutos() // Atualiza o store
  } catch (error) {
    console.error('Erro ao reativar produto:', error)
  }
}

const executarAcaoPendente = () => {
  if (acaoPendente.value) {
    acaoPendente.value()
  }
  mostrarPinModal.value = false
  acaoPendente.value = null
}
</script>

<style scoped>
.container {
  max-width: 600px;
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
.product-form {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.product-form input {
  flex-grow: 1;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.filter-container {
  margin-bottom: 20px;
  text-align: center;
}
.product-list {
  list-style: none;
  padding: 0;
}
.product-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid #eee;
}
.product-list li.inativo {
  background-color: #f8f9fa;
  color: #adb5bd;
}
.product-list li.inativo .info-produto span {
  text-decoration: line-through;
}
.info-produto {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.acoes-produto {
  display: flex;
  gap: 10px;
}
.acoes-produto button {
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: white;
  font-weight: bold;
}
.form-actions {
  width: 100%;
  display: flex;
  gap: 10px;
  margin-top: 10px;
}
.form-actions button {
  padding: 10px;
  border-radius: 4px;
  border: none;
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
