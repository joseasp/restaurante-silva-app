<template>
  <q-layout view="hHh lpR fFf">
    <AppNav />

    <q-page-container>
      <router-view />
    </q-page-container>

    <!-- Logotipo do Desenvolvedor (sutil, no canto) -->
    <div class="logo-dev-container">
      <a href="https://seusite.com.br" target="_blank" rel="noopener noreferrer">
        <img src="/logo-dev.png" alt="Desenvolvido por Apolinário Contabilidade" />
      </a>
    </div>
  </q-layout>
</template>

<script setup>
import AppNav from '@/components/AppNav.vue'
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
