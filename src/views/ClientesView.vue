<template>
  <q-page padding>
    <h1 class="text-h4 text-center q-mb-md">Gestão de Clientes</h1>

    <!-- FORMULÁRIO DE CLIENTE -->
    <q-card flat bordered class="q-pa-md q-mb-lg">
      <q-form @submit.prevent="salvarCliente">
        <div class="row q-col-gutter-md">
          <div class="col-12 col-md-6">
            <q-input
              outlined
              v-model="formCliente.nome"
              label="Nome do Cliente"
              :rules="[(val) => !!val || 'O nome é obrigatório']"
              lazy-rules
            />
          </div>
          <div class="col-12 col-md-6">
            <q-input outlined v-model="formCliente.contato" label="Contato (Telefone, etc)" />
          </div>
          <div class="col-12 col-md-6">
            <q-select
              outlined
              v-model="formCliente.tipo"
              :options="['CRÉDITO', 'EMPRESA']"
              label="Tipo"
              :rules="[(val) => !!val || 'O tipo é obrigatório']"
              lazy-rules
            />
          </div>
          <div class="col-12">
            <q-input
              outlined
              v-model="formCliente.observacoes"
              type="textarea"
              label="Observações"
            />
          </div>

          <!-- SEÇÃO DE FUNCIONÁRIOS (APENAS PARA EMPRESAS EM EDIÇÃO) -->
          <div class="col-12" v-if="clienteEmEdicao && formCliente.tipo === 'EMPRESA'">
            <q-separator class="q-my-md" />
            <h6 class="text-h6 q-mb-sm">Funcionários</h6>
            <div class="row items-start q-col-gutter-sm q-mb-md">
              <div class="col">
                <q-input
                  outlined
                  dense
                  v-model="novoFuncionarioNome"
                  label="Novo Funcionário"
                  @keyup.enter="adicionarFuncionario"
                />
              </div>
              <div class="col-auto">
                <q-btn color="primary" icon="add" label="Adicionar" @click="adicionarFuncionario" />
              </div>
            </div>

            <q-list bordered separator v-if="funcionariosDoCliente.length > 0">
              <q-item-label header>Funcionários Cadastrados</q-item-label>
              <q-item v-for="func in funcionariosDoCliente" :key="func.id">
                <q-item-section>{{ func.nome }}</q-item-section>
                <q-item-section side>
                  <q-btn
                    flat
                    round
                    dense
                    color="negative"
                    icon="delete"
                    @click="removerFuncionario(func.id)"
                  />
                </q-item-section>
              </q-item>
            </q-list>
            <q-banner v-else class="bg-grey-2 text-grey-8">
              Nenhum funcionário cadastrado para esta empresa.
            </q-banner>
          </div>

          <div class="col-12 q-gutter-sm q-mt-md">
            <q-btn
              color="primary"
              :label="clienteEmEdicao ? 'Salvar Alterações' : 'Adicionar Cliente'"
              type="submit"
            />
            <q-btn
              flat
              color="grey"
              label="Cancelar"
              v-if="clienteEmEdicao"
              @click="cancelarEdicao"
            />
          </div>
        </div>
      </q-form>
    </q-card>

    <!-- LISTA DE CLIENTES -->
    <q-card flat bordered>
      <q-list bordered separator>
        <q-item>
          <q-item-section>
            <q-toggle v-model="mostrarInativos" label="Mostrar clientes inativos" />
          </q-item-section>
        </q-item>

        <q-item v-if="clientes.length === 0">
          <q-item-section class="text-grey-8"> Nenhum cliente encontrado. </q-item-section>
        </q-item>

        <q-item
          v-for="cliente in clientes"
          :key="cliente.id"
          :class="{ 'bg-grey-2': !cliente.ativo }"
          clickable
          v-ripple
        >
          <q-item-section>
            <q-item-label>{{ cliente.nome }}</q-item-label>
            <q-item-label caption>
              {{ cliente.tipo }} {{ cliente.contato ? ' - ' + cliente.contato : '' }}
            </q-item-label>
          </q-item-section>

          <q-item-section side>
            <div class="row items-center">
              <!-- *** CORREÇÃO 2: Botão de editar não aparece para o Cliente Avulso *** -->
              <q-btn
                v-if="cliente.nome !== 'Cliente Avulso'"
                flat
                round
                dense
                icon="edit"
                color="info"
                @click.stop="iniciarEdicao(cliente)"
              >
                <q-tooltip>Editar</q-tooltip>
              </q-btn>
              <q-btn
                v-if="cliente.ativo"
                flat
                round
                dense
                color="negative"
                icon="delete"
                @click.stop="desativarCliente(cliente)"
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
                @click.stop="reativarCliente(cliente)"
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
import { db } from '@/services/databaseService.js'
import { useDataStore } from '@/stores/dataStore.js'
import PinModal from '@/components/PinModal.vue'
import { useQuasar } from 'quasar'
import { v4 as uuidv4 } from 'uuid';

// *** CORREÇÃO 1: Garante que o $q do Quasar seja inicializado corretamente ***
const $q = useQuasar()
const dataStore = useDataStore()

const getInitialForm = () => ({
  nome: '',
  contato: '',
  tipo: 'CRÉDITO',
  observacoes: '',
})

const formCliente = ref(getInitialForm())
const clientes = ref([])
const mostrarInativos = ref(false)
const clienteEmEdicao = ref(null)

// Refs para Funcionários
const funcionariosDoCliente = ref([])
const novoFuncionarioNome = ref('')

// Refs para o Modal de PIN
const mostrarPinModal = ref(false)
const acaoPendente = ref(null)

const carregarClientes = () => {
  if (!dataStore.todosOsClientes) {
    clientes.value = []
    return
  }

  let clientesFiltrados = []
  if (mostrarInativos.value) {
    clientesFiltrados = [...dataStore.todosOsClientes]
  } else {
    clientesFiltrados = dataStore.todosOsClientes.filter((c) => c.ativo === true)
  }

  clientes.value = clientesFiltrados.sort((a, b) => a.nome.localeCompare(b.nome))
}

watch(() => dataStore.todosOsClientes, carregarClientes, { deep: true, immediate: true })
watch(mostrarInativos, carregarClientes)

onMounted(() => {
  dataStore.fetchClientes()
})

const carregarFuncionarios = async (clienteId) => {
  if (!clienteId) return
  try {
    funcionariosDoCliente.value = await db.funcionarios
      .where('cliente_id')
      .equals(clienteId)
      .toArray()
  } catch (error) {
    console.error('Erro ao carregar funcionários:', error)
    $q.notify({ color: 'negative', message: 'Falha ao carregar funcionários.' })
  }
}

const adicionarFuncionario = async () => {
  const nome = novoFuncionarioNome.value.trim()
  if (!nome) {
    $q.notify({ color: 'warning', message: 'Digite o nome do funcionário.' })
    return
  }
  if (!clienteEmEdicao.value) return

  try {
    await db.funcionarios.add({
      id: uuidv4(),
      nome: nome,
      cliente_id: clienteEmEdicao.value.id,
    })
    novoFuncionarioNome.value = ''
    await carregarFuncionarios(clienteEmEdicao.value.id)
    $q.notify({ color: 'positive', message: 'Funcionário adicionado.' })
  } catch (error) {
    console.error('Erro ao adicionar funcionário:', error)
    $q.notify({ color: 'negative', message: 'Falha ao adicionar funcionário.' })
  }
}

const removerFuncionario = async (funcionarioId) => {
  $q.dialog({
    title: 'Confirmar',
    message: 'Tem certeza que deseja remover este funcionário?',
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await db.funcionarios.delete(funcionarioId)
      await carregarFuncionarios(clienteEmEdicao.value.id)
      $q.notify({ color: 'positive', message: 'Funcionário removido.' })
    } catch (error) {
      console.error('Erro ao remover funcionário:', error)
      $q.notify({ color: 'negative', message: 'Falha ao remover funcionário.' })
    }
  })
}

// *** CORREÇÃO 2: Adiciona a verificação para bloquear a edição do Cliente Avulso ***
const iniciarEdicao = (cliente) => {
  if (cliente.nome === 'Cliente Avulso') {
    $q.notify({
      color: 'warning',
      message: 'O Cliente Avulso não pode ser editado.',
      icon: 'warning',
    })
    return
  }
  clienteEmEdicao.value = cliente
  formCliente.value = { ...cliente }
  funcionariosDoCliente.value = []
  if (cliente.tipo === 'EMPRESA') {
    carregarFuncionarios(cliente.id)
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const cancelarEdicao = () => {
  clienteEmEdicao.value = null
  formCliente.value = getInitialForm()
  funcionariosDoCliente.value = []
  novoFuncionarioNome.value = ''
}

const salvarCliente = async () => {
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
      $q.notify({
        color: 'positive',
        message: 'Cliente atualizado com sucesso!',
        icon: 'check_circle',
      })
      cancelarEdicao()
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error)
      $q.notify({
        color: 'negative',
        message: 'Erro ao atualizar cliente.',
        icon: 'report_problem',
      })
    }
  } else {
    const nomeExistente = await db.clientes
      .where('nome')
      .equalsIgnoreCase(formCliente.value.nome.trim())
      .first()

    if (nomeExistente) {
      $q.notify({
        color: 'negative',
        message: `O cliente "${formCliente.value.nome}" já existe.`,
        icon: 'warning',
      })
      return
    }

    try {
      await db.clientes.add({
        id: uuidv4(),
        ...formCliente.value,
        nome: formCliente.value.nome.trim(),
        ativo: true,
      })
      await dataStore.fetchClientes()
      $q.notify({
        color: 'positive',
        message: 'Cliente adicionado com sucesso!',
        icon: 'check_circle',
      })
      formCliente.value = getInitialForm()
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error)
      $q.notify({
        color: 'negative',
        message: 'Erro ao adicionar cliente.',
        icon: 'report_problem',
      })
    }
  }
}

const executarAcaoPendente = () => {
  if (acaoPendente.value) {
    acaoPendente.value()
  }
  mostrarPinModal.value = false
  acaoPendente.value = null
}

const desativarCliente = (cliente) => {
  if (cliente.tipo === 'AVULSO' || cliente.nome === 'Cliente Avulso') {
    $q.notify({
      color: 'warning',
      message: "O 'Cliente Avulso' não pode ser desativado.",
      icon: 'warning',
    })
    return
  }
  acaoPendente.value = async () => {
    try {
      await db.clientes.update(cliente.id, { ativo: false })
      await dataStore.fetchClientes()
      $q.notify({
        color: 'positive',
        message: 'Cliente desativado com sucesso.',
        icon: 'toggle_off',
      })
    } catch (error) {
      console.error('Erro ao desativar cliente:', error)
    }
  }
  mostrarPinModal.value = true
}

const reativarCliente = async (cliente) => {
  try {
    await db.clientes.update(cliente.id, { ativo: true })
    await dataStore.fetchClientes()
    $q.notify({
      color: 'positive',
      message: 'Cliente reativado com sucesso.',
      icon: 'toggle_on',
    })
  } catch (error) {
    console.error('Erro ao reativar cliente:', error)
  }
}
</script>

<style scoped>
/* Estilos mantidos pelo Quasar */
</style>
