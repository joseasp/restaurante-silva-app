// src/App.vue

<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated class="bg-primary text-white" height-hint="60">
      <q-toolbar>
        <!-- Logotipo do Restaurante (imagem completa) -->
        <img
          src="/logo-restaurante-completo.png"
          class="logo-restaurante"
          @click="recarregarPagina"
          style="cursor: pointer"
        />

        <q-space />

        <q-tabs align="left">
          <q-route-tab to="/caderno" icon="book" label="Caderno" />
          <q-route-tab to="/produtos" icon="inventory_2" label="Produtos" />
          <q-route-tab to="/clientes" icon="people" label="Clientes" />
          <q-route-tab to="/contas-a-receber" icon="account_balance_wallet" label="Contas a Receber" />
          <q-route-tab to="/relatorios" icon="assessment" label="Relatórios" />
        </q-tabs>

        <!-- BOTÃO DE SYNC MANTIDO (pode ser útil para debug) -->
        <q-btn flat round dense icon="sync" @click="forcarSync" class="q-ml-md">
          <q-tooltip>Forçar Sincronização Manual</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>

    <!-- Logotipo do Desenvolvedor (sutil, no canto) -->
    <div class="logo-dev-container">
      <a
        href="https://www.instagram.com/dudu_apolinario/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src="/logo-dev.png" alt="Desenvolvido por Apolinário Contabilidade" />
      </a>
    </div>
  </q-layout>
</template>

<script setup>
import { useDataStore } from '@/stores/dataStore.js'
import { onMounted } from 'vue'

const dataStore = useDataStore()

onMounted(() => {
  // Initialize the data store
  dataStore.initialize()
})

const recarregarPagina = () => {
  window.location.href = '/caderno'
}

// Mantivemos esta função. Embora a sincronização agora seja automática,
// ter um botão manual pode ser útil para forçar uma checagem.
const forcarSync = () => {
  console.log('Sincronização manual acionada!')
  // Force a manual sync by calling initialize
  dataStore.initialize()
}
</script>

<style>
/* Estilos Globais */
body {
  --q-primary: #ffc107;
  --q-secondary: #26a69a;
  --q-accent: #9c27b0;
  --q-dark: #1d1d1d;
  --q-positive: #21ba45;
  --q-negative: #c10015;
  --q-info: #31ccec;
  --q-warning: #f2c037;
}

/* Estilos para os Logotipos */
.logo-restaurante {
  height: 45px; /* Altura do logotipo no cabeçalho. Ajuste se necessário. */
  width: auto;
}

.logo-dev-container {
  position: fixed;
  bottom: 10px;
  left: 10px;
  z-index: 2000; /* Para ficar sobre outros elementos */
}

.logo-dev-container img {
  height: 35px; /* Tamanho do seu logotipo no canto. Ajuste se necessário. */
  width: auto;
  opacity: 0.5; /* Efeito de transparência */
  transition: opacity 0.3s ease;
}

.logo-dev-container img:hover {
  opacity: 1; /* Fica 100% visível ao passar o mouse */
}
</style>
