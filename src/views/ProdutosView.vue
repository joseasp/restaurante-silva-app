<template>
  <div class="container">
    <h1>Gestão de Produtos</h1>

    <form @submit.prevent="adicionarProduto" class="product-form">
      <input v-model="novoProduto.nome" type="text" placeholder="Nome do Produto" required />
      <input
        v-model="novoProduto.preco"
        type="number"
        step="0.01"
        placeholder="Preço (R$)"
        required
      />
      <button type="submit">Adicionar Produto</button>
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
          <button v-if="produto.ativo" @click="desativarProduto(produto)" class="btn-desativar">
            Desativar
          </button>
          <button v-else @click="reativarProduto(produto)" class="btn-reativar">Reativar</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useDataStore } from '@/stores/dataStore.js';
import { db } from '@/services/databaseService.js';

const dataStore = useDataStore();
const novoProduto = ref({ nome: '', preco: '' });
const produtos = ref([]); // This will be our local, reactive list
const mostrarInativos = ref(false);

// Computed property to get products from the store, but we won't use it directly for the list
// because the list needs to be able to show inactive products.
const produtosAtivosDoStore = computed(() => dataStore.produtos);

const carregarProdutos = async () => {
  if (mostrarInativos.value) {
    try {
      let todosOsProdutos = await db.produtos.orderBy('nome').toArray();
      // Garante que todos os produtos tenham a propriedade 'ativo'
      todosOsProdutos.forEach((p) => {
        if (p.ativo === undefined) {
          p.ativo = true;
        }
      });
      produtos.value = todosOsProdutos;
    } catch (error) {
      console.error('Erro ao carregar todos os produtos:', error);
    }
  } else {
    // If not showing inactives, just use the data from the store
    produtos.value = produtosAtivosDoStore.value;
  }
};

// Watch for changes in the store's products and update the local list if not showing inactives
watch(produtosAtivosDoStore, (newProdutos) => {
    if (!mostrarInativos.value) {
        produtos.value = newProdutos;
    }
});

// Watch for changes on the checkbox
watch(mostrarInativos, carregarProdutos);

onMounted(carregarProdutos);

const adicionarProduto = async () => {
  if (!novoProduto.value.nome || !novoProduto.value.preco) {
    alert('Por favor, preencha o nome e o preço.');
    return;
  }
  try {
    await db.produtos.add({
      nome: novoProduto.value.nome,
      preco: parseFloat(novoProduto.value.preco),
      ativo: true,
    });
    novoProduto.value = { nome: '', preco: '' };
    // First, refresh the store
    await dataStore.fetchProdutos();
    // Then, reload the local list, which will either be all products or the updated active list from the store
    await carregarProdutos();
  } catch (error) {
    console.error('Erro ao adicionar produto:', error);
  }
};

const desativarProduto = async (produto) => {
  try {
    await db.produtos.update(produto.id, { ativo: false });
    await dataStore.fetchProdutos();
    await carregarProdutos();
  } catch (error) {
    console.error('Erro ao desativar produto:', error);
  }
};

const reativarProduto = async (produto) => {
  try {
    await db.produtos.update(produto.id, { ativo: true });
    await dataStore.fetchProdutos();
    await carregarProdutos();
  } catch (error) {
    console.error('Erro ao reativar produto:', error);
  }
};
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
.product-form {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}
.product-form input {
  flex-grow: 1;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.product-form button {
  padding: 8px 12px;
  background-color: #ffc107;
  color: black;
  border: none;
  border-radius: 4px;
  cursor: pointer;
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
  padding: 10px;
  border-bottom: 1px solid #eee;
}
.product-list li.inativo {
  background-color: #f8f9fa;
  color: #adb5bd;
  text-decoration: line-through;
}
.info-produto {
  display: flex;
  flex-direction: column;
}
.acoes-produto button {
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: white;
}
.btn-desativar {
  background-color: #ffc107;
  color: black;
}
.btn-reativar {
  background-color: #28a745;
}
</style>
