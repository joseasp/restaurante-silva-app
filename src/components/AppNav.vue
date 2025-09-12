<template>
  <!-- Header -->
  <q-header elevated class="bg-white text-dark">
    <q-toolbar>
      <!-- Menu hambúrguer (apenas mobile) -->
      <q-btn
        flat
        dense
        round
        icon="menu"
        class="lt-md q-mr-sm"
        aria-label="Abrir menu"
        @click="leftDrawerOpen = true"
      />
      <!-- Logo -->
      <q-toolbar-title class="row items-center no-wrap">
        <router-link to="/caderno" class="row items-center no-wrap logo-link" aria-label="Ir para o Caderno">
          <img
            v-if="logoOk"
            src="/logo-restaurante-completo.png"
            alt="Restaurante Silva"
            class="app-logo"
            height="22"
            @error="logoOk = false"
          />
          <span v-else class="text-subtitle1 text-weight-bold">Restaurante Silva</span>
        </router-link>
      </q-toolbar-title>
      <!-- Abas (desktop) -->
      <div class="gt-sm">
        <q-tabs
          class="text-dark"
          active-color="warning"
          indicator-color="warning"
          shrink
          no-caps
        >
          <q-route-tab to="/caderno" label="Caderno" icon="book" />
          <q-route-tab to="/produtos" label="Produtos" icon="inventory_2" />
          <q-route-tab to="/clientes" label="Clientes" icon="people" />
          <!-- Ajuste o path abaixo para o da sua rota real -->
          <q-route-tab to="/contas-a-receber" label="Contas a Receber" icon="request_quote" />
          <q-route-tab to="/relatorios" label="Relatórios" icon="summarize" />
        </q-tabs>
      </div>
    </q-toolbar>
  </q-header>
  <!-- Drawer (mobile) -->
  <q-drawer
    v-model="leftDrawerOpen"
    side="left"
    bordered
    :overlay="true"
    behavior="mobile"
    class="lt-md"
  >
    <q-list padding>
      <q-item
        v-for="it in items"
        :key="it.to"
        :to="it.to"
        clickable
        v-ripple
        @click="leftDrawerOpen = false"
      >
        <q-item-section avatar><q-icon :name="it.icon" /></q-item-section>
        <q-item-section>{{ it.label }}</q-item-section>
      </q-item>
    </q-list>
  </q-drawer>
</template>

<script setup>
import { ref } from 'vue'

const leftDrawerOpen = ref(false)
const logoOk = ref(true)

// Paths alinhados com o router (ajuste se necessário)
const items = [
  { to: '/caderno', label: 'Caderno', icon: 'book' },
  { to: '/produtos', label: 'Produtos', icon: 'inventory_2' },
  { to: '/clientes', label: 'Clientes', icon: 'people' },
  // ATENÇÃO: troque para o path real da sua rota, se for diferente
  { to: '/contas-a-receber', label: 'Contas a Receber', icon: 'request_quote' },
  { to: '/relatorios', label: 'Relatórios', icon: 'summarize' }
]
</script>

<style scoped>
/* Se quiser uma borda sutil no header */
.q-header {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.logo-link {
  text-decoration: none;
}
.app-logo {
  display: block;
  height: 22px;       /* ajuste aqui se quiser maior/menor */
  width: auto;        /* mantém proporção */
  object-fit: contain;
}
@media (min-width: 1024px) {
  .app-logo {
    height: 24px;
  }
}
</style>
