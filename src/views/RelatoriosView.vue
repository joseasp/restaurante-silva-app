<template>
  <q-page padding>
    <div class="text-h4 q-mb-md">Relatórios</div>

    <q-card flat bordered class="q-pa-md q-mb-lg">
      <div class="row q-col-gutter-md items-center">
        <div class="col-12 col-sm-4">
          <q-input outlined v-model="dataInicio" label="Data de Início" type="date" stack-label />
        </div>
        <div class="col-12 col-sm-4">
          <q-input outlined v-model="dataFim" label="Data de Fim" type="date" stack-label />
        </div>
        <div class="col-12 col-sm-auto">
          <q-btn
            color="primary"
            label="Gerar Relatório"
            @click="solicitarGeracaoRelatorio"
            class="full-width"
          />
        </div>
        <div class="col-12 col-sm-auto">
          <q-btn
            v-if="dadosRelatorio"
            @click="imprimirRelatorio"
            type="button"
            color="grey-7"
            icon="print"
            label="Imprimir"
            class="full-width"
          />
        </div>
      </div>
    </q-card>

    <!-- Estado de Carregamento -->
    <div v-if="carregando" class="flex flex-center q-py-xl">
      <q-spinner-dots color="primary" size="40px" />
      <div class="q-ml-md text-primary">Gerando relatório...</div>
    </div>

    <!-- Seção de Resultados do Relatório -->
    <div v-else-if="dadosRelatorio" class="resultado-relatorio">
      <div class="text-h5 q-mb-md">Resultados para o Período</div>

      <!-- Cards de Métricas -->
      <div class="row q-col-gutter-lg q-mb-lg">
        <div class="col-12 col-sm-6 col-md-4">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-caption text-grey">Total de Vendas</div>
              <div class="text-h5">{{ dadosRelatorio.totalVendas }}</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-sm-6 col-md-4">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-caption text-grey">Valor Total de Vendas</div>
              <div class="text-h5">R$ {{ dadosRelatorio.valorTotalVendas.toFixed(2) }}</div>
            </q-card-section>
          </q-card>
        </div>
        <div class="col-12 col-sm-6 col-md-4">
          <q-card flat bordered>
            <q-card-section>
              <div class="text-caption text-grey">Vendas à Vista</div>
              <div class="text-h5">R$ {{ dadosRelatorio.vendasAVista.toFixed(2) }}</div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Card Detalhado de Entradas de Caixa -->
      <div class="row">
        <div class="col-12">
          <q-card flat bordered>
            <q-card-section>
              <div class="row items-center no-wrap">
                <div class="col">
                  <div class="text-h6">Entradas de Caixa</div>
                  <div class="text-subtitle2 text-grey">Total recebido no período</div>
                </div>
                <div class="col-auto text-h5 text-positive text-weight-bold">
                  R$ {{ dadosRelatorio.entradasDeCaixa.toFixed(2) }}
                </div>
              </div>
            </q-card-section>

            <q-separator />

            <q-card-section>
              <div class="text-subtitle1 q-mb-sm">Recebimentos por Forma de Pagamento:</div>
              <q-list bordered separator>
                <q-item
                  v-for="(valor, forma) in dadosRelatorio.recebimentosPorForma"
                  :key="forma"
                  class="q-py-sm"
                >
                  <q-item-section>
                    <q-item-label>{{ forma }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-item-label class="text-body1 text-weight-medium"
                      >R$ {{ valor.toFixed(2) }}</q-item-label
                    >
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- Placeholder Inicial -->
    <div v-else class="flex flex-center q-py-xl">
      <q-card flat bordered class="q-pa-xl text-center text-grey bg-grey-2">
        <q-icon name="summarize" size="4em" />
        <div class="text-h6 q-mt-md">Selecione um período</div>
        <p>Escolha as datas de início e fim e clique em "Gerar Relatório".</p>
      </q-card>
    </div>

    <!-- Modal de PIN -->
    <PinModal
      :visible="mostrarPinModal"
      @close="mostrarPinModal = false"
      @success="executarAcaoPendente"
    />
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { db } from '@/services/databaseService.js'
import PinModal from '@/components/PinModal.vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()

const dataInicio = ref('')
const dataFim = ref('')
const dadosRelatorio = ref(null)
const carregando = ref(false)

// Refs para o Modal de PIN
const mostrarPinModal = ref(false)
const acaoPendente = ref(null)

const formatarDataISO = (data) => data.toISOString().split('T')[0]

const hoje = new Date()
const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)

dataInicio.value = formatarDataISO(primeiroDiaMes)
dataFim.value = formatarDataISO(ultimoDiaMes)

const solicitarGeracaoRelatorio = () => {
  if (!dataInicio.value || !dataFim.value) {
    $q.notify({
      color: 'warning',
      message: 'Por favor, selecione a data de início e de fim.',
      icon: 'warning',
    })
    return
  }
  acaoPendente.value = gerarRelatorio
  mostrarPinModal.value = true
}

const gerarRelatorio = async () => {
  carregando.value = true
  dadosRelatorio.value = null

  try {
    const transacoesNoPeriodo = await db.transacoes
      .where('data_transacao')
      .between(dataInicio.value, dataFim.value, true, true)
      .toArray()

    const relatorio = {
      totalVendas: 0,
      valorTotalVendas: 0,
      vendasAVista: 0,
      entradasDeCaixa: 0,
      recebimentosPorForma: {
        Dinheiro: 0,
        PIX: 0,
        Cartão: 0,
        'Não especificado': 0,
      },
    }

    const pagamentosNoPeriodo = transacoesNoPeriodo.filter(
      (t) => t.tipo_transacao === 'PAGAMENTO' && !t.estornado,
    )
    const vendasNoPeriodo = transacoesNoPeriodo.filter(
      (t) => t.tipo_transacao === 'VENDA' && !t.estornado,
    )

    relatorio.totalVendas = vendasNoPeriodo.length
    relatorio.valorTotalVendas = vendasNoPeriodo.reduce((acc, v) => acc + v.valor, 0)
    relatorio.vendasAVista = vendasNoPeriodo
      .filter((v) => v.metodo_pagamento === 'Pago')
      .reduce((acc, v) => acc + v.valor, 0)

    const totalDePagamentos = pagamentosNoPeriodo.reduce((acc, p) => acc + Math.abs(p.valor), 0)
    relatorio.entradasDeCaixa = relatorio.vendasAVista + totalDePagamentos

    const transacoesRecebidas = [
      ...vendasNoPeriodo.filter((v) => v.metodo_pagamento === 'Pago'),
      ...pagamentosNoPeriodo,
    ]

    for (const t of transacoesRecebidas) {
      const valor = t.tipo_transacao === 'VENDA' ? t.valor : Math.abs(t.valor)
      const forma = t.forma_pagamento || 'Não especificado'
      if (relatorio.recebimentosPorForma[forma] !== undefined) {
        relatorio.recebimentosPorForma[forma] += valor
      } else {
        relatorio.recebimentosPorForma['Não especificado'] += valor
      }
    }

    dadosRelatorio.value = relatorio
  } catch (error) {
    console.error('Erro ao gerar relatório:', error)
    $q.notify({
      color: 'negative',
      message: 'Ocorreu um erro ao gerar o relatório.',
      icon: 'report_problem',
    })
  } finally {
    carregando.value = false
  }
}

const executarAcaoPendente = () => {
  if (acaoPendente.value) {
    acaoPendente.value()
  }
  mostrarPinModal.value = false
  acaoPendente.value = null
}

const imprimirRelatorio = () => {
  if (!dadosRelatorio.value) return

  const relatorio = dadosRelatorio.value
  const inicio = new Date(dataInicio.value).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  const fim = new Date(dataFim.value).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

  const relatorioHTML = `
    <html>
      <head>
        <title>Relatório do Período</title>
        <style>
          body { font-family: sans-serif; margin: 20px; }
          h1, h2 { text-align: center; }
          .card-container { display: flex; flex-wrap: wrap; justify-content: space-around; gap: 15px; text-align: center; margin: 20px 0; padding: 10px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6;}
          .card { padding: 10px; flex-grow: 1; min-width: 150px; }
          .card span { font-size: 1.2em; color: #6c757d; }
          .card strong { font-size: 2em; display: block; }
          .detalhes-pagamento { margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Relatório Financeiro</h1>
        <h2>Período: ${inicio} a ${fim}</h2>

        <div class="card-container">
          <div class="card"><span>Total de Vendas</span><strong>${relatorio.totalVendas}</strong></div>
          <div class="card"><span>Valor Total de Vendas</span><strong>R$ ${relatorio.valorTotalVendas.toFixed(2)}</strong></div>
          <div class="card"><span>Vendas à Vista</span><strong>R$ ${relatorio.vendasAVista.toFixed(2)}</strong></div>
          <div class="card"><span>Entradas de Caixa</span><strong>R$ ${relatorio.entradasDeCaixa.toFixed(2)}</strong></div>
        </div>

        <div class="detalhes-pagamento">
          <h3>Recebimentos por Forma de Pagamento</h3>
          <table>
            <thead><tr><th>Forma</th><th>Valor Recebido</th></tr></thead>
            <tbody>
              ${Object.entries(relatorio.recebimentosPorForma)
                .map(
                  ([forma, valor]) => `
                <tr>
                  <td>${forma}</td>
                  <td>R$ ${valor.toFixed(2)}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `

  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'

  document.body.appendChild(iframe)

  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(relatorioHTML)
  doc.close()

  iframe.contentWindow.focus()
  iframe.contentWindow.print()

  setTimeout(() => {
    document.body.removeChild(iframe)
  }, 1000)
}
</script>

<style scoped>
/* Todos os estilos anteriores foram removidos, pois os componentes do Quasar e suas classes de utilitário agora controlam a aparência. */
</style>
