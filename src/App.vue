<template>
  <header class="app-wide-header">
    <nav class="main-nav">
      <RouterLink to="/caderno">Caderno</RouterLink>
      <RouterLink to="/produtos">Produtos</RouterLink>
      <RouterLink to="/clientes">Clientes</RouterLink>
      <RouterLink to="/contas-receber">Contas a Receber</RouterLink>
    </nav>
  </header>
  <main>
    <RouterView />
  </main>
</template>

<script setup>
import { RouterLink, RouterView } from 'vue-router';
import { useDataStore } from '@/stores/dataStore.js';
import { onMounted } from 'vue';

const dataStore = useDataStore();

onMounted(() => {
  dataStore.initialize();
});
</script>

<style>
  /* Estilos globais para a aplicação */
  body {
    margin: 0;
    font-family: sans-serif;
  }

  .app-wide-header {
    background-color: #333;
    padding: 10px 20px;
  }
  
  .main-nav a {
    color: white;
    text-decoration: none;
    margin-right: 20px;
    font-size: 1.1em;
    padding: 5px 0;
  }

  .main-nav a.router-link-exact-active {
    color: #ffc107;
    font-weight: bold;
    border-bottom: 2px solid #ffc107;
  }
</style>