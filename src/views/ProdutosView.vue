<!-- src/views/ProdutosView.vue -->

<template>
  <q-page padding>
    <q-banner v-if="!online" class="bg-red text-white q-mb-md">
      Você está offline. Alguns dados podem não estar atualizados.
    </q-banner>
    <q-banner v-if="erroCarregamento" class="bg-red text-white q-mb-md">
      {{ erroCarregamento }}
    </q-banner>
    <q-inner-loading :showing="loading">
      <q-spinner size="50px" color="primary" />
      <div>Carregando dados...</div>
    </q-inner-loading>
    <div class="text-h4 q-mb-md">Gestão de Produtos</div>

    <!-- Seção para adicionar/editar produtos -->
    <q-card class="q-mb-lg">
      <q-card-section>
        <div class="text-h6">
          {{ produtoEmEdicao ? 'Editando Produto' : 'Adicionar Novo Produto' }}
        </div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-form
          ref="formRef"
          @submit="produtoEmEdicao ? salvarEdicao() : salvarNovoProduto()"
          class="row q-col-gutter-md items-end"
        >
          <div class="col-xs-12 col-sm-6">
            <q-select
              outlined
              v-model="form.funcionario"
              :options="opcoesFuncionarios"
              use-input
              fill-input
              hide-selected
              input-debounce="0"
              label="Nome do Funcionário"
              new-value-mode="add"
              @new-value="onNewFuncionario"
              clearable
              dense
              :rules="[]"
            />
          </div>
          <div class="col-xs-12 col-sm-6">
            <q-input
              outlined
              v-model="form.nome"
              label="Nome do Produto"
              :rules="[(val) => !!val || 'Campo obrigatório']"
            />
          </div>
          <div class="col-xs-12 col-sm-4">
            <q-input
              outlined
              type="number"
              step="0.01"
              v-model.number="form.preco"
              label="Preço (R$)"
              :rules="[(val) => val > 0 || 'Preço deve ser maior que zero']"
            />
          </div>
          <div class="col-xs-12 col-sm-2">
            <q-btn
              v-if="!produtoEmEdicao"
              type="submit"
              label="Adicionar"
              color="primary"
              class="full-width"
              size="lg"
              unelevated
            />
            <div v-else class="row q-gutter-sm">
              <q-btn label="Salvar" type="submit" color="positive" class="col" unelevated />
              <q-btn label="Cancelar" @click="cancelarEdicao" color="grey" class="col" flat />
            </div>
          </div>
        </q-form>
      </q-card-section>
    </q-card>

    <!-- Seção da lista de produtos -->
    <q-card>
      <q-card-section class="flex justify-between items-center">
        <div class="text-h6">Lista de Produtos</div>
        <q-input outlined dense v-model="busca" placeholder="Buscar..." class="q-ml-md">
          <template v-slot:append>
            <q-icon name="search" />
          </template>
        </q-input>
      </q-card-section>

      <q-separator />

      <q-list separator>
        <q-item v-if="produtosFiltrados.length === 0">
          <q-item-section class="text-center text-grey">Nenhum produto encontrado.</q-item-section>
        </q-item>

        <q-item v-for="produto in produtosFiltrados" :key="produto.id">
          <q-item-section>
            <q-item-label>{{ produto.nome }}</q-item-label>
            <q-item-label caption>R$ {{ produto.preco.toFixed(2) }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <div class="row q-gutter-sm">
              <q-btn round flat icon="edit" color="info" @click="iniciarEdicao(produto)" />
              <q-btn
                round
                flat
                icon="delete"
                color="negative"
                @click="confirmarExclusao(produto)"
              />
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'

const dataStore = useDataStore()
const $q = useQuasar()
const { loading, erroCarregamento, online } = storeToRefs(dataStore)

onMounted(() => {
  window.addEventListener('online', () => (dataStore.online = true))
  window.addEventListener('offline', () => (dataStore.online = false))
})
onUnmounted(() => {
  window.removeEventListener('online', () => (dataStore.online = true))
  window.removeEventListener('offline', () => (dataStore.online = false))
})

const formRef = ref(null)
const produtos = computed(() => dataStore.produtosAtivos)

// Lista de funcionários cadastrados (apenas sugestões, texto livre)
const opcoesFuncionarios = ref([
  'Ana',
  'Carlos',
  'João'
])

const getInitialForm = () => ({ funcionario: '', nome: '', preco: null })

const form = ref(getInitialForm())
// Aceita qualquer valor digitado no campo funcionário
function onNewFuncionario(val, done) {
  // Aceita qualquer valor digitado
  done(val)
}
const produtoEmEdicao = ref(null)
const busca = ref('')

const produtosFiltrados = computed(() => {
  if (!busca.value) {
    return produtos.value
  }
  return produtos.value.filter((p) => p.nome.toLowerCase().includes(busca.value.toLowerCase()))
})

function iniciarEdicao(produto) {
  window.scrollTo(0, 0)
  produtoEmEdicao.value = { ...produto }
  form.value = { ...produto }
}

function cancelarEdicao() {
  produtoEmEdicao.value = null
  form.value = getInitialForm()
  nextTick(() => {
    if (formRef.value) {
      formRef.value.resetValidation()
    }
  })
}

async function salvarNovoProduto() {
  try {
    await dataStore.adicionarProduto(form.value)
    $q.notify({ type: 'positive', message: 'Produto adicionado com sucesso!' })
    cancelarEdicao()
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  }
}

async function salvarEdicao() {
  try {
    await dataStore.atualizarProduto(form.value)
    $q.notify({ type: 'positive', message: 'Produto atualizado com sucesso!' })
    cancelarEdicao()
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  }
}

function confirmarExclusao(produto) {
  $q.dialog({
    title: 'Confirmar Exclusão',
    message: `Tem certeza que deseja excluir o produto "${produto.nome}"? Esta ação o tornará inativo.`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await dataStore.excluirProduto(produto)
      $q.notify({ type: 'info', message: 'Produto excluído.' })
    } catch (error) {
      $q.notify({ type: 'negative', message: error.message })
    }
  })
}
</script>
