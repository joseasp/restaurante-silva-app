<template>
  <div class="product-selector">
    <div class="product-search">
      <q-input
        ref="searchInput"
        v-model="searchTerm"
        outlined
        label="Buscar Produto..."
        placeholder="Digite o nome do produto ou pressione ↓ para navegar"
        dense
        @keydown="handleKeydown"
        @focus="showDropdown = true"
        class="q-mb-xs"
      >
        <template v-slot:append>
          <q-icon name="search" />
          <q-btn
            flat
            dense
            round
            icon="add"
            color="primary"
            @click="openCustomItemModal"
            class="q-ml-xs"
          >
            <q-tooltip>Adicionar item avulso</q-tooltip>
          </q-btn>
        </template>
      </q-input>

      <!-- Lista de Produtos Filtrados -->
      <div v-if="showDropdown && filteredProducts.length > 0" class="products-dropdown">
        <q-list bordered separator dense class="rounded-borders">
          <q-item
            v-for="(product, index) in filteredProducts"
            :key="product.id"
            clickable
            v-ripple
            :class="{ 'bg-primary text-white': index === selectedIndex }"
            @click="addProduct(product)"
            @mouseenter="selectedIndex = index"
          >
            <q-item-section>
              <q-item-label>{{ product.nome }}</q-item-label>
              <q-item-label caption>
                R$ {{ product.preco.toFixed(2) }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                round
                dense
                size="sm"
                icon="add"
                color="primary"
                @click.stop="addProduct(product)"
              />
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </div>

    <!-- Modal for Custom Item -->
    <q-dialog v-model="showCustomItemModal" persistent>
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Adicionar Item Avulso</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            ref="customItemNameInput"
            v-model="customItem.nome"
            outlined
            label="Nome do Item"
            class="q-mb-md"
            @keyup.enter="customItemPriceInput?.focus()"
          />
          <q-input
            ref="customItemPriceInput"
            v-model.number="customItem.preco"
            outlined
            type="number"
            step="0.01"
            label="Preço (R$)"
            prefix="R$"
            @keyup.enter="addCustomItem"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancelar" color="grey" @click="closeCustomItemModal" />
          <q-btn 
            label="Adicionar" 
            color="primary" 
            @click="addCustomItem"
            :disable="!customItem.nome || !customItem.preco"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useDataStore } from '@/stores/dataStore.js'
import { useQuasar } from 'quasar'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])

const $q = useQuasar()
const dataStore = useDataStore()
const searchInput = ref(null)
const customItemNameInput = ref(null)
const customItemPriceInput = ref(null)
const searchTerm = ref('')
const selectedIndex = ref(-1)
const showDropdown = ref(false)
const showCustomItemModal = ref(false)
const selectedItems = ref([...props.modelValue])

const customItem = ref({
  nome: '',
  preco: null
})

// Computed
const filteredProducts = computed(() => {
  if (!searchTerm.value) {
    return dataStore.produtosAtivos || []
  }
  
  const term = searchTerm.value.toLowerCase()
  return (dataStore.produtosAtivos || []).filter(product =>
    product.nome.toLowerCase().includes(term)
  )
})

// Watchers
watch(selectedItems, (newValue) => {
  emit('update:modelValue', newValue)
}, { deep: true })

watch(() => props.modelValue, (newValue) => {
  selectedItems.value = [...newValue]
}, { deep: true })

watch(searchTerm, () => {
  selectedIndex.value = -1
  showDropdown.value = searchTerm.value.length > 0
})

// Methods
const addProduct = (product) => {
  // Check if product already exists in selected items
  const existingIndex = selectedItems.value.findIndex(item => item.id === product.id)
  
  if (existingIndex >= 0) {
    // Increment quantity if exists
    selectedItems.value[existingIndex].quantidade++
  } else {
    // Add new item
    selectedItems.value.push({
      id: product.id,
      nome: product.nome,
      preco_unitario_congelado: product.preco,
      quantidade: 1
    })
  }
  
  // Clear search and hide dropdown
  searchTerm.value = ''
  showDropdown.value = false
  selectedIndex.value = -1
  
  $q.notify({
    type: 'positive',
    message: `${product.nome} adicionado ao pedido`,
    timeout: 1000
  })
}

const openCustomItemModal = () => {
  customItem.value = { nome: '', preco: null }
  showCustomItemModal.value = true
  
  nextTick(() => {
    customItemNameInput.value?.focus()
  })
}

const closeCustomItemModal = () => {
  showCustomItemModal.value = false
  customItem.value = { nome: '', preco: null }
}

const addCustomItem = () => {
  if (!customItem.value.nome || !customItem.value.preco) {
    $q.notify({
      type: 'negative',
      message: 'Preencha o nome e o preço do item'
    })
    return
  }

  const newItem = {
    id: `custom-${Date.now()}`,
    nome: customItem.value.nome,
    preco_unitario_congelado: Number(customItem.value.preco),
    quantidade: 1
  }

  selectedItems.value.push(newItem)
  
  $q.notify({
    type: 'positive',
    message: `${newItem.nome} adicionado ao pedido`,
    timeout: 1000
  })
  
  closeCustomItemModal()
  
  // Focus back to search input
  nextTick(() => {
    searchInput.value?.focus()
  })
}

const handleKeydown = (event) => {
  if (!showDropdown.value && filteredProducts.value.length > 0) {
    showDropdown.value = true
    return
  }

  const totalOptions = filteredProducts.value.length

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
      if (selectedIndex.value >= 0 && selectedIndex.value < filteredProducts.value.length) {
        addProduct(filteredProducts.value[selectedIndex.value])
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
  if (!event.target.closest('.product-selector')) {
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
</script>

<style scoped>
.product-selector {
  position: relative;
}

.products-dropdown {
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

/* Keyboard navigation highlight */
.q-item.bg-primary {
  background-color: var(--q-primary) !important;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .products-dropdown {
    max-height: 150px;
  }
}
</style>