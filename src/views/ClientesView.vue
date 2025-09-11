<!-- src/views/ClientesView.vue (SEU CÓDIGO COMPLETO + CORREÇÕES FINAIS) -->
<template>
  <q-page padding>
    <div class="text-h4 q-mb-md">Gestão de Clientes</div>
    <q-card class="q-mb-lg">
      <q-card-section>
        <div class="text-h6">
          {{ clienteEmEdicao ? `Editando: ${clienteEmEdicao.nome}` : 'Novo Cliente' }}
        </div>
      </q-card-section>
      <q-card-section>
        <q-form
          ref="formRef"
          @submit.prevent="clienteEmEdicao ? salvarEdicao() : salvarNovoCliente()"
          class="q-gutter-md"
        >
          <div class="row q-col-gutter-md">
            <div class="col-xs-12 col-sm-6 col-md-4">
              <q-input
                outlined
                v-model="form.nome"
                label="Nome do Cliente"
                :rules="[(val) => !!val || 'Campo obrigatório']"
              />
            </div>
            <div class="col-xs-12 col-sm-6 col-md-4">
              <q-input outlined v-model="form.contato" label="Contato (Telefone, etc)" />
            </div>
            <div class="col-xs-12 col-sm-6 col-md-4">
              <q-select
                outlined
                v-model="form.tipo"
                :options="['CRÉDITO', 'EMPRESA', 'AVULSO']"
                label="Tipo"
                :rules="[(val) => !!val || 'Campo obrigatório']"
              />
            </div>
            <div class="col-xs-12">
              <q-input outlined v-model="form.observacoes" type="textarea" label="Observações" />
            </div>
          </div>
          <div class="row q-gutter-sm q-mt-sm">
            <q-btn
              type="submit"
              :label="clienteEmEdicao ? 'Salvar Alterações' : 'Adicionar Cliente'"
              color="primary"
              unelevated
            />
            <q-btn
              v-if="clienteEmEdicao"
              label="Cancelar"
              @click="cancelarEdicao"
              color="grey"
              flat
            />
          </div>
        </q-form>
      </q-card-section>
      <div v-if="clienteEmEdicao && clienteEmEdicao.tipo === 'EMPRESA'">
        <q-separator class="q-my-md" />
        <q-card-section>
          <div class="text-h6">Funcionários</div>
          <q-form
            @submit.prevent="adicionarFuncionario"
            class="row items-center q-gutter-sm q-mt-sm"
          >
            <q-input
              outlined
              dense
              v-model="novoFuncionarioNome"
              label="Nome do Novo Funcionário"
              class="col"
              :rules="[(val) => !!val || 'Campo obrigatório']"
            />
            <q-btn type="submit" round color="primary" icon="add" />
          </q-form>
          <q-list bordered separator class="q-mt-md">
            <q-item-label header>Funcionários Cadastrados</q-item-label>
            <q-item v-for="func in funcionariosDoCliente" :key="func.id">
              <q-item-section>{{ func.nome }}</q-item-section>
              <q-item-section side
                ><q-btn
                  round
                  flat
                  dense
                  icon="delete"
                  color="negative"
                  @click="confirmarExcluirFuncionario(func)"
              /></q-item-section>
            </q-item>
            <q-item v-if="funcionariosDoCliente.length === 0"
              ><q-item-section class="text-grey text-center"
                >Nenhum funcionário cadastrado.</q-item-section
              ></q-item
            >
          </q-list>
        </q-card-section>
      </div>
    </q-card>
    <q-card>
      <q-card-section class="flex justify-between items-center">
        <q-input
          outlined
          dense
          v-model="busca"
          placeholder="Buscar Cliente..."
          class="col-xs-12 col-sm-auto"
        />
        <q-toggle v-model="mostrarInativos" label="Mostrar clientes inativos" />
      </q-card-section>
      <q-separator />
      <q-list separator>
        <q-item v-if="clientesFiltrados.length === 0"
          ><q-item-section class="text-grey text-center"
            >Nenhum cliente encontrado.</q-item-section
          ></q-item
        >
        <q-item
          v-for="cliente in clientesFiltrados"
          :key="cliente.id"
          :class="{ 'bg-grey-3': !cliente.ativo }"
        >
          <q-item-section>
            <q-item-label>{{ cliente.nome }}</q-item-label>
            <q-item-label caption
              >{{ cliente.tipo }}{{ cliente.contato ? ' - ' + cliente.contato : '' }}</q-item-label
            >
          </q-item-section>
          <q-item-section side>
            <div class="row q-gutter-xs" v-if="cliente.tipo !== 'AVULSO'">
              <q-btn round flat dense icon="edit" color="info" @click="iniciarEdicao(cliente)" />
              <q-btn
                v-if="cliente.ativo"
                round
                flat
                dense
                icon="delete"
                color="negative"
                @click="confirmarExclusao(cliente)"
                ><q-tooltip>Desativar</q-tooltip></q-btn
              >
              <q-btn
                v-else
                round
                flat
                dense
                icon="undo"
                color="positive"
                @click="confirmarReativacao(cliente)"
                ><q-tooltip>Reativar</q-tooltip></q-btn
              >
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { useQuasar } from 'quasar'
import { db } from '@/services/databaseService.js'
import { supabase } from '@/services/supabaseClient.js'
import { v4 as uuidv4 } from 'uuid'

const dataStore = useDataStore()
const $q = useQuasar()
const formRef = ref(null)
const getInitialForm = () => ({ nome: '', tipo: 'CRÉDITO', contato: '', observacoes: '' })
const form = ref(getInitialForm())
const clienteEmEdicao = ref(null)
const busca = ref('')
const mostrarInativos = ref(false)
const novoFuncionarioNome = ref('')
const funcionariosDoCliente = ref([])

const clientesFiltrados = computed(() => {
  const listaBase = mostrarInativos.value ? dataStore.todosOsClientes : dataStore.clientesAtivos
  if (!busca.value) return listaBase
  return listaBase.filter((c) => c.nome.toLowerCase().includes(busca.value.toLowerCase()))
})

watch(clienteEmEdicao, async (novoCliente) => {
  if (novoCliente && novoCliente.tipo === 'EMPRESA') await carregarFuncionarios(novoCliente.id)
  else funcionariosDoCliente.value = []
})

async function carregarFuncionarios(clienteId) {
  funcionariosDoCliente.value = await db.funcionarios.where({ cliente_id: clienteId }).toArray()
}

function iniciarEdicao(cliente) {
  window.scrollTo(0, 0)
  clienteEmEdicao.value = { ...cliente }
  form.value = { ...cliente }
}

function cancelarEdicao() {
  clienteEmEdicao.value = null
  form.value = getInitialForm()
  nextTick(() => {
    if (formRef.value) formRef.value.resetValidation()
  })
}

async function salvarNovoCliente() {
  try {
    await dataStore.adicionarCliente(form.value)
    $q.notify({ type: 'positive', message: 'Cliente adicionado!' })
    cancelarEdicao()
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  }
}

async function salvarEdicao() {
  try {
    await dataStore.atualizarCliente(form.value)
    $q.notify({ type: 'positive', message: 'Cliente atualizado!' })
    cancelarEdicao()
  } catch (error) {
    $q.notify({ type: 'negative', message: error.message })
  }
}

function confirmarExclusao(cliente) {
  $q.dialog({ title: 'Confirmar', message: `Desativar "${cliente.nome}"?`, cancel: true }).onOk(
    async () => {
      try {
        await dataStore.excluirCliente(cliente)
        $q.notify({ type: 'info', message: 'Cliente desativado.' })
      } catch (error) {
        $q.notify({ type: 'negative', message: error.message })
      }
    },
  )
}

function confirmarReativacao(cliente) {
  $q.dialog({ title: 'Confirmar', message: `Reativar "${cliente.nome}"?`, cancel: true }).onOk(
    async () => {
      try {
        await dataStore.reativarCliente(cliente)
        $q.notify({ type: 'positive', message: 'Cliente reativado.' })
      } catch (error) {
        $q.notify({ type: 'negative', message: error.message })
      }
    },
  )
}

async function adicionarFuncionario() {
  if (!novoFuncionarioNome.value) return
  const novoFunc = {
    id: uuidv4(),
    nome: novoFuncionarioNome.value,
    cliente_id: clienteEmEdicao.value.id,
  }
  const { error } = await supabase.from('funcionarios').insert(novoFunc)
  if (error) {
    $q.notify({ type: 'negative', message: 'Erro ao salvar funcionário.' })
  } else {
    await db.funcionarios.put(novoFunc)
    funcionariosDoCliente.value.push(novoFunc)
    novoFuncionarioNome.value = ''
    $q.notify({ type: 'positive', message: 'Funcionário adicionado.' })
  }
}

async function confirmarExcluirFuncionario(funcionario) {
  $q.dialog({ title: 'Confirmar', message: `Excluir "${funcionario.nome}"?`, cancel: true }).onOk(
    async () => {
      const { error } = await supabase.from('funcionarios').delete().eq('id', funcionario.id)
      if (error) {
        $q.notify({ type: 'negative', message: 'Erro ao excluir funcionário.' })
      } else {
        await db.funcionarios.delete(funcionario.id)
        funcionariosDoCliente.value = funcionariosDoCliente.value.filter(
          (f) => f.id !== funcionario.id,
        )
        $q.notify({ type: 'info', message: 'Funcionário excluído.' })
      }
    },
  )
}
</script>
