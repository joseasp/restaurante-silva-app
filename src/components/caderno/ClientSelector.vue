<template>
  <div class="client-selector">
    <!-- Cliente não selecionado -->
    <div v-if="!selectedClient" class="client-search">
      <q-input
        ref="searchInput"
        v-model="searchTerm"
        outlined
        label="Buscar Cliente..."
        placeholder="Digite o nome do cliente ou pressione ↓ para navegar"
        dense
        @keydown="handleKeydown"
        @focus="showDropdown = true"
        class="q-mb-xs"
      >
        <template v-slot:append>
          <q-icon name="search" />
        </template>
      </q-input>

      <!-- Lista de Clientes Filtrados -->
      <div v-if="showDropdown && filteredClients.length > 0" class="clients-dropdown">
        <q-list bordered separator dense class="rounded-borders">
          <q-item
            v-for="(client, index) in filteredClients"
            :key="client.id"
            clickable
            v-ripple
            :class="{ 'bg-primary text-white': index === selectedIndex }"
            @click="selectClient(client)"
            @mouseenter="selectedIndex = index"
          >
            <q-item-section avatar>
              <q-icon :name="client.tipo === 'EMPRESA' ? 'business' : 'person'" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ client.nome }}</q-item-label>
              <q-item-label caption v-if="client.tipo === 'EMPRESA'">
                Empresa
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <!-- Botão Venda Avulsa -->
      <q-btn
        outline
        color="primary"
        icon="shopping_cart"
        label="Venda Avulsa"
        @click="selectCashSale"
        class="full-width q-mt-sm"
        :class="{ 'bg-primary text-white': selectedIndex === filteredClients.length }"
      />
    </div>

    <!-- Cliente selecionado -->
    <div v-else class="client-selected">
      <q-chip
        removable
        @remove="removeClient"
        color="primary"
        text-color="white"
        size="lg"
        class="full-width"
      >
        <q-avatar :icon="selectedClient.tipo === 'EMPRESA' ? 'business' : 'person'" />
        {{ selectedClient.nome }}
      </q-chip>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useDataStore } from '@/stores/dataStore.js'

const props = defineProps({
  modelValue: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

const dataStore = useDataStore()
const searchInput = ref(null)
const searchTerm = ref('')
const selectedClient = ref(props.modelValue)
const selectedIndex = ref(-1)
const showDropdown = ref(false)

// Computed
const filteredClients = computed(() => {
  if (!searchTerm.value) {
    return dataStore.clientesAtivos || []
  }
  
  const term = searchTerm.value.toLowerCase()
  return (dataStore.clientesAtivos || []).filter(client =>
    client.nome.toLowerCase().includes(term)
  )
})

// Watchers
watch(selectedClient, (newValue) => {
  emit('update:modelValue', newValue)
})

watch(() => props.modelValue, (newValue) => {
  selectedClient.value = newValue
})

watch(searchTerm, () => {
  selectedIndex.value = -1
  showDropdown.value = true
})

// Methods
const selectClient = (client) => {
  selectedClient.value = client
  searchTerm.value = ''
  showDropdown.value = false
  selectedIndex.value = -1
}

const removeClient = () => {
  selectedClient.value = null
  searchTerm.value = ''
  showDropdown.value = false
  selectedIndex.value = -1
  
  // Focus back to search input
  nextTick(() => {
    searchInput.value?.focus()
  })
}

const selectCashSale = () => {
  // Find or create "Cliente Avulso"
  let clienteAvulso = dataStore.clientesAtivos?.find(c => 
    c.nome.toLowerCase() === 'cliente avulso'
  )
  
  if (!clienteAvulso) {
    // Create a temporary cliente avulso if not found
    clienteAvulso = {
      id: 'avulso',
      nome: 'Cliente Avulso',
      tipo: 'PESSOA_FISICA',
      ativo: true
    }
  }
  
  selectClient(clienteAvulso)
}

const handleKeydown = (event) => {
  if (!showDropdown.value) {
    showDropdown.value = true
    return
  }

  const totalOptions = filteredClients.value.length + 1 // +1 for cash sale option

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      selectedIndex.value = selectedIndex.value < totalOptions - 1 
        ? selectedIndex.value + 1 
        : 0
      break
      
    case 'ArrowUp':
      event.preventDefault()
      selectedIndex.value = selectedIndex.value > 0 
        ? selectedIndex.value - 1 
        : totalOptions - 1
      break
      
    case 'Enter':
      event.preventDefault()
      if (selectedIndex.value >= 0 && selectedIndex.value < filteredClients.value.length) {
        selectClient(filteredClients.value[selectedIndex.value])
      } else if (selectedIndex.value === filteredClients.value.length) {
        selectCashSale()
      }
      break
      
    case 'Escape':
      event.preventDefault()
      showDropdown.value = false
      selectedIndex.value = -1
      break
  }
}

const handleClickOutside = (event) => {
  if (!event.target.closest('.client-selector')) {
    showDropdown.value = false
    selectedIndex.value = -1
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Focus on mount if no client selected
onMounted(() => {
  if (!selectedClient.value) {
    nextTick(() => {
      searchInput.value?.focus()
    })
  }
})
</script>

<style scoped>
.client-selector {
  position: relative;
}

.clients-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
  background: white;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.client-selected {
  width: 100%;
}

.client-selected .q-chip {
  justify-content: space-between;
  min-height: 40px;
}

/* Keyboard navigation highlight */
.q-item.bg-primary {
  background-color: var(--q-primary) !important;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .clients-dropdown {
    max-height: 150px;
  }
}
</style>