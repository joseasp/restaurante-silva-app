<template>
  <q-page padding>
    <h1 class="text-h4 text-center q-mb-md">Gestão de Produtos</h1>

    <!-- FORMULÁRIO DE PRODUTO -->
    <q-card flat bordered class="q-pa-md q-mb-lg">
      <q-form @submit.prevent="salvarProduto">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-8">
            <q-input
              outlined
              v-model="formProduto.nome"
              label="Nome do Produto"
              :rules="[(val) => !!val || 'O nome é obrigatório']"
              lazy-rules
            />
          </div>
          <div class="col-12 col-md-4">
            <q-input
              outlined
              v-model.number="formProduto.preco"
              type="number"
              step="0.01"
              label="Preço"
              prefix="R$"
              :rules="[(val) => val !== null && val > 0, 'O preço deve ser maior que zero']"
              lazy-rules
            />
          </div>
        </div>
        <div class="q-mt-md q-gutter-sm">
          <q-btn
            color="primary"
            :label="produtoEmEdicao ? 'Salvar Alterações' : 'Adicionar Produto'"
            type="submit"
          />
          <q-btn
            flat
            color="grey"
            label="Cancelar"
            v-if="produtoEmEdicao"
            @click="cancelarEdicao"
          />
        </div>
      </q-form>
    </q-card>

    <!-- LISTA DE PRODUTOS -->
    <q-card flat bordered>
      <q-list bordered separator>
        <q-item>
          <q-item-section>
            <q-toggle v-model="mostrarInativos" label="Mostrar produtos inativos" />
          </q-item-section>
        </q-item>

        <q-item v-if="produtos.length === 0">
          <q-item-section class="text-grey-8"> Nenhum produto encontrado. </q-item-section>
        </q-item>

        <q-item
          v-for="produto in produtos"
          :key="produto.id"
          :class="{ 'bg-grey-2': !produto.ativo }"
          clickable
          v-ripple
        >
          <q-item-section>
            <q-item-label>{{ produto.nome }}</q-item-label>
            <q-item-label caption>
              {{
                produto.preco
                  ? produto.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  : 'R$ 0,00'
              }}
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="row items-center">
              <q-btn flat round dense icon="edit" color="info" @click.stop="iniciarEdicao(produto)">
                <q-tooltip>Editar</q-tooltip>
              </q-btn>
              <q-btn
                v-if="produto.ativo"
                flat
                round
                dense
                color="negative"
                icon="delete"
                @click.stop="desativarProduto(produto)"
              >
                <q-tooltip>Desativar</q-tooltip>
              </q-btn>
              <q-btn
                v-else
                flat
                round
                dense
                color="positive"
                icon="undo"
                @click.stop="reativarProduto(produto)"
              >
                <q-tooltip>Reativar</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>

    <!-- Modal de PIN -->
    <PinModal
      :visible="mostrarPinModal"
      @close="mostrarPinModal = false"
      @success="executarAcaoPendente"
    />
  </q-page>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useDataStore } from '@/stores/dataStore.js'
import { db } from '@/services/databaseService.js' // Importando o db
import PinModal from '@/components/PinModal.vue'
import { useQuasar } from 'quasar'
import { v4 as uuidv4 } from 'uuid';

const $q = useQuasar()
const dataStore = useDataStore()

const getInitialForm = () => ({ nome: '', preco: null })
const formProduto = ref(getInitialForm())
const produtoEmEdicao = ref(null)
const produtos = ref([])
const mostrarInativos = ref(false)

// Refs para o Modal de PIN
const mostrarPinModal = ref(false)
const acaoPendente = ref(null)

// *** FUNÇÃO ATUALIZADA PARA ORDENAR ALFABETICAMENTE ***
const carregarProdutos = () => {
  if (!dataStore.produtos) {
    produtos.value = []
    return
  }

  let produtosFiltrados = []
  if (mostrarInativos.value) {
    // Pega todos os produtos
    produtosFiltrados = [...dataStore.produtos]
  } else {
    // Pega apenas os produtos ativos
    produtosFiltrados = dataStore.produtos.filter((p) => p.ativo === true)
  }

  // Ordena a lista filtrada (seja ela qual for) por nome
  produtos.value = produtosFiltrados.sort((a, b) => a.nome.localeCompare(b.nome))
}

watch(() => dataStore.produtos, carregarProdutos, { deep: true, immediate: true })
watch(mostrarInativos, carregarProdutos)

onMounted(() => {
  dataStore.fetchProdutos()
})

const iniciarEdicao = (produto) => {
  produtoEmEdicao.value = produto
  formProduto.value = { ...produto }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const cancelarEdicao = () => {
  produtoEmEdicao.value = null
  formProduto.value = getInitialForm()
}

const salvarProduto = async () => {
  if (produtoEmEdicao.value) {
    try {
      await db.produtos.update(produtoEmEdicao.value.id, {
        nome: formProduto.value.nome,
        preco: parseFloat(formProduto.value.preco),
      })
      await dataStore.fetchProdutos()
      $q.notify({
        color: 'positive',
        message: 'Produto atualizado com sucesso!',
        icon: 'check_circle',
      })
      cancelarEdicao()
    } catch (error) {
      console.error('Erro ao atualizar produto:', error)
      $q.notify({
        color: 'negative',
        message: 'Erro ao atualizar produto.',
        icon: 'report_problem',
      })
    }
  } else {
    try {
      await db.produtos.add({
        id: uuidv4(),
        nome: formProduto.value.nome,
        preco: parseFloat(formProduto.value.preco),
        ativo: true,
      })
      await dataStore.fetchProdutos()
      $q.notify({
        color: 'positive',
        message: 'Produto adicionado com sucesso!',
        icon: 'check_circle',
      })
      formProduto.value = getInitialForm()
    } catch (error) {
      console.error('Erro ao adicionar produto:', error)
      $q.notify({
        color: 'negative',
        message: 'Erro ao adicionar produto.',
        icon: 'report_problem',
      })
    }
  }
}

const desativarProduto = (produto) => {
  acaoPendente.value = async () => {
    try {
      await db.produtos.update(produto.id, { ativo: false })
      await dataStore.fetchProdutos()
      $q.notify({
        color: 'positive',
        message: 'Produto desativado com sucesso.',
        icon: 'toggle_off',
      })
    } catch (error) {
      console.error('Erro ao desativar produto:', error)
    }
  }
  mostrarPinModal.value = true
}

const reativarProduto = async (produto) => {
  try {
    await db.produtos.update(produto.id, { ativo: true })
    await dataStore.fetchProdutos()
    $q.notify({
      color: 'positive',
      message: 'Produto reativado com sucesso.',
      icon: 'toggle_on',
    })
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
/* Todo o CSS customizado foi removido. A estilização agora é controlada pelo Quasar. */
</style>
