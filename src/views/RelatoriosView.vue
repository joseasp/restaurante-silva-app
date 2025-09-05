<template>
  <div class="container">
    <h1>Relatórios</h1>

    <div class="filtro-periodo">
      <div class="campo-data">
        <label for="dataInicio">Data de Início:</label>
        <input type="date" id="dataInicio" v-model="dataInicio" />
      </div>
      <div class="campo-data">
        <label for="dataFim">Data de Fim:</label>
        <input type="date" id="dataFim" v-model="dataFim" />
      </div>
      <button class="gerar-btn" @click="gerarRelatorio">Gerar Relatório</button>
      <!-- PASSO 1: BOTÃO DE IMPRESSÃO ADICIONADO -->
      <button v-if="dadosRelatorio" @click="imprimirRelatorio" type="button" class="btn-imprimir">
        🖨️ Imprimir
      </button>
    </div>

    <!-- Seção de Resultados do Relatório -->
    <div v-if="dadosRelatorio" class="resultado-relatorio">
      <h2>Resultados para o Período</h2>

      <div class="resultados-container">
        <!-- Cards Principais -->
        <div class="resultados-grid">
          <div class="resultado-card">
            <span>Total de Vendas</span>
            <strong>{{ dadosRelatorio.totalVendas }}</strong>
          </div>
          <div class="resultado-card">
            <span>Faturamento Bruto</span>
            <strong>R$ {{ dadosRelatorio.faturamentoBruto.toFixed(2) }}</strong>
          </div>
          <div class="resultado-card">
            <span>Vendas à Vista</span>
            <strong>R$ {{ dadosRelatorio.vendasAVista.toFixed(2) }}</strong>
          </div>
        </div>

        <!-- Card Detalhado de Entradas de Caixa -->
        <div class="card-detalhado">
          <div class="card-detalhado-header">
            <span>Entradas de Caixa</span>
            <strong class="total-entrada"
              >R$ {{ dadosRelatorio.entradasDeCaixa.toFixed(2) }}</strong
            >
          </div>
          <div class="card-detalhado-body">
            <h4>Recebimentos por Forma de Pagamento:</h4>
            <div class="lista-formas-pagamento">
              <div
                v-for="(valor, forma) in dadosRelatorio.recebimentosPorForma"
                :key="forma"
                class="item-forma-pagamento"
              >
                <span>{{ forma }}:</span>
                <span>R$ {{ valor.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!dadosRelatorio && !carregando" class="relatorios-placeholder">
      <p>Selecione um período para gerar o relatório de vendas.</p>
    </div>

    <div v-if="carregando" class="loading-spinner">
      <p>Gerando relatório...</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { db } from '@/services/databaseService.js'

const dataInicio = ref('')
const dataFim = ref('')
const dadosRelatorio = ref(null)
const carregando = ref(false)

const formatarDataISO = (data) => data.toISOString().split('T')[0]

const hoje = new Date()
const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)

dataInicio.value = formatarDataISO(primeiroDiaMes)
dataFim.value = formatarDataISO(ultimoDiaMes)

const gerarRelatorio = async () => {
  if (!dataInicio.value || !dataFim.value) {
    alert('Por favor, selecione a data de início e de fim.')
    return
  }

  carregando.value = true
  dadosRelatorio.value = null

  try {
    const transacoesNoPeriodo = await db.transacoes
      .where('data_transacao')
      .between(dataInicio.value, dataFim.value, true, true)
      .toArray()

    const relatorio = {
      totalVendas: 0,
      faturamentoBruto: 0,
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
    relatorio.faturamentoBruto = vendasNoPeriodo.reduce((acc, v) => acc + v.valor, 0)
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
    alert('Ocorreu um erro ao gerar o relatório. Verifique o console.')
  } finally {
    carregando.value = false
  }
}

// PASSO 2: FUNÇÃO DE IMPRESSÃO ADICIONADA
const imprimirRelatorio = () => {
  if (!dadosRelatorio.value) return

  const printWindow = window.open('', '_blank')
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
          .card-container { display: flex; justify-content: space-around; gap: 15px; text-align: center; margin: 20px 0; padding: 10px; background-color: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6;}
          .card { padding: 10px; flex-grow: 1; }
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
          <div class="card"><span>Faturamento Bruto</span><strong>R$ ${relatorio.faturamentoBruto.toFixed(2)}</strong></div>
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

  printWindow.document.write(relatorioHTML)
  printWindow.document.close()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 250)
}
</script>

<style scoped>
.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

h1 {
  color: #333;
  text-align: center;
  margin-bottom: 30px;
}

.filtro-periodo {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  align-items: center;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 30px;
  border: 1px solid #dee2e6;
}

.campo-data {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.campo-data label {
  font-size: 0.9em;
  font-weight: bold;
  color: #555;
}

.campo-data input {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.gerar-btn,
.btn-imprimir {
  padding: 10px 25px;
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s;
  align-self: flex-end;
}
.gerar-btn {
  background-color: #28a745;
}
.gerar-btn:hover {
  background-color: #218838;
}
/* PASSO 3: ESTILO PARA O BOTÃO DE IMPRESSÃO */
.btn-imprimir {
  background-color: #6c757d; /* Cinza */
}
.btn-imprimir:hover {
  background-color: #5c636a;
}

.resultado-relatorio {
  margin-top: 30px;
}

.resultado-relatorio h2 {
  text-align: center;
  margin-top: 0;
  margin-bottom: 25px;
}

.resultados-container {
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}
.resultados-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}
.resultado-card {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  text-align: center;
}
.resultado-card span {
  display: block;
  color: #6c757d;
  margin-bottom: 5px;
}
.resultado-card strong {
  font-size: 1.8em;
  color: #343a40;
}
.card-detalhado {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  margin-top: 20px;
}
.card-detalhado-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 10px;
  margin-bottom: 10px;
}
.card-detalhado-header span {
  font-size: 1.2em;
  font-weight: bold;
  color: #495057;
}
.total-entrada {
  font-size: 2em;
  color: #198754; /* Verde para entradas */
  font-weight: bold;
}
.card-detalhado-body h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #343a40;
}
.item-forma-pagamento {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #e9ecef;
}
.item-forma-pagamento:last-child {
  border-bottom: none;
}
.item-forma-pagamento span:last-child {
  font-weight: bold;
}

.relatorios-placeholder,
.loading-spinner {
  margin-top: 30px;
  padding: 40px;
  background-color: #f8f9fa;
  border-radius: 8px;
  text-align: center;
  color: #6c757d;
}
</style>
