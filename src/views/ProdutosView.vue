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

    <!-- Formulário -->
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
          <div class="col-xs-12 col-sm-8">
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
              type="text"
              v-model="precoTexto"
              label="Preço (R$)"
              :rules="[(val) => normalizaPreco(val) > 0 || 'Preço deve ser maior que zero']"
              hint="Use vírgula ou ponto"
            />
          </div>

          <div class="col-xs-12 col-sm-3">
            <q-btn
              v-if="!produtoEmEdicao"
              type="submit"
              label="Adicionar"
              color="primary"
              class="full-width"
              size="lg"
              unelevated
              @click="sincronizaPrecoNoForm"
            />
            <div v-else class="row q-gutter-sm">
              <q-btn label="Salvar" type="submit" color="positive" class="col" unelevated @click="sincronizaPrecoNoForm" />
              <q-btn label="Cancelar" @click="cancelarEdicao" color="grey" class="col" flat />
            </div>
          </div>
        </q-form>
      </q-card-section>
    </q-card>

    <!-- Lista + Ações -->
    <q-card>
      <q-card-section class="row items-center q-col-gutter-md">
        <div class="col">
          <div class="text-h6">Lista de Produtos</div>
        </div>
        <div class="col-auto row items-center q-gutter-sm">
          <q-btn dense flat icon="sync" label="Sincronizar agora" @click="sincronizarAgora" />
        </div>
        <div class="col-12 col-sm-auto">
          <q-toggle v-model="mostrarInativos" label="Mostrar inativos" />
        </div>
        <div class="col-12 col-sm">
          <q-input outlined dense v-model="busca" placeholder="Buscar...">
            <template v-slot:append><q-icon name="search" /></template>
          </q-input>
        </div>
      </q-card-section>

      <q-separator />

      <q-list separator>
        <q-item v-if="produtosFiltrados.length === 0">
          <q-item-section class="text-center text-grey">Nenhum produto encontrado.</q-item-section>
        </q-item>

        <q-item v-for="produto in produtosFiltrados" :key="produto.id">
          <q-item-section>
            <q-item-label>{{ produto.nome }}</q-item-label>
            <q-item-label caption>{{ formatCurrency(produto.preco) }}</q-item-label>
            <q-badge v-if="produto.ativo === false" color="grey" class="q-mt-xs">Inativo</q-badge>
          </q-item-section>
          <q-item-section side>
            <div class="row q-gutter-sm">
              <q-btn v-if="produto.ativo !== false" round flat icon="edit" color="info" @click="iniciarEdicao(produto)" />
              <q-btn v-if="produto.ativo !== false" round flat icon="delete" color="negative" @click="confirmarExclusao(produto)" />
              <q-btn v-else round flat icon="restore" color="positive" @click="reativar(produto)" />
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'

const dataStore = useDataStore()
const $q = useQuasar()
const { loading, erroCarregamento, online } = storeToRefs(dataStore)

const formRef = ref(null)
const mostrarInativos = ref(false)

const produtosBase = computed(() => (mostrarInativos.value ? dataStore.produtos : dataStore.produtosAtivos))

const getInitialForm = () => ({ id: null, nome: '', preco: null })
const form = ref(getInitialForm())
const precoTexto = ref('') // aceita vírgula ou ponto

const produtoEmEdicao = ref(null)
const busca = ref('')

const formatCurrency = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0)

const normalizaPreco = (t) => {
  if (t === null || t === undefined) return 0
  if (typeof t !== 'string') return Number(t) || 0
  return Number(t.replace(',', '.')) || 0
}
const sincronizaPrecoNoForm = () => {
  form.value.preco = normalizaPreco(precoTexto.value)
}

const produtosFiltrados = computed(() => {
  const termo = (busca.value || '').toLowerCase()
  const base = produtosBase.value
  const filtrada = termo ? base.filter((p) => p.nome.toLowerCase().includes(termo)) : base
  return [...filtrada].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
})

function iniciarEdicao(produto) {
  window.scrollTo(0, 0)
  produtoEmEdicao.value = { ...produto }
  form.value = { id: produto.id, nome: produto.nome, preco: produto.preco }
  precoTexto.value = String(produto.preco).replace('.', ',')
}

function cancelarEdicao() {
  produtoEmEdicao.value = null
  form.value = getInitialForm()
  precoTexto.value = ''
  nextTick(() => {
    if (formRef.value) formRef.value.resetValidation()
  })
}

async function salvarNovoProduto() {
  try {
    sincronizaPrecoNoForm()
    await dataStore.adicionarProduto(form.value)
    $q.notify({ type: 'positive', message: 'Produto adicionado com sucesso!' })
    cancelarEdicao()
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  }
}

async function salvarEdicao() {
  try {
    sincronizaPrecoNoForm()
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
      await dataStore.excluirProduto(produto.id)
      $q.notify({ type: 'info', message: 'Produto excluído.' })
    } catch (error) {
      $q.notify({ type: 'negative', message: error.message })
    }
  })
}

async function reativar(produto) {
  try {
    await dataStore.reativarProduto(produto.id)
    $q.notify({ type: 'positive', message: 'Produto reativado!' })
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  }
}

// Botão único: sincroniza (envia pendentes -> baixa/mescla)
async function sincronizarAgora() {
  try {
    const qtd = await dataStore.sincronizarProdutosAgora()
    $q.notify({
      type: 'positive',
      message: `Sincronização concluída. ${qtd ? `Enviados ${qtd} pendentes. ` : ''}`,
    })
  } catch (e) {
    $q.notify({ type: 'negative', message: e.message || 'Falha na sincronização agora.' })
  }
}
</script>
