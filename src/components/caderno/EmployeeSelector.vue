<template>
  <div class="employee-selector">
    <q-select
      v-model="selectedEmployee"
      :options="employeeOptions"
      outlined
      dense
      use-input
      fill-input
      hide-selected
      input-debounce="0"
      @filter="filterEmployees"
      @new-value="addNewEmployee"
      @update:model-value="handleEmployeeChange"
      new-value-mode="add"
      placeholder="Digite o nome do funcionário"
      label="Nome do Funcionário"
      :loading="loading"
    >
      <template v-slot:prepend>
        <q-icon name="badge" />
      </template>
      
      <template v-slot:no-option>
        <q-item>
          <q-item-section class="text-grey">
            Nenhum funcionário encontrado. Digite para adicionar.
          </q-item-section>
        </q-item>
      </template>
      
      <template v-slot:option="scope">
        <q-item v-bind="scope.itemProps">
          <q-item-section>
            <q-item-label>{{ scope.opt.label }}</q-item-label>
            <q-item-label caption v-if="scope.opt.isNew">
              Novo funcionário
            </q-item-label>
          </q-item-section>
        </q-item>
      </template>
    </q-select>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { db } from '@/services/databaseService.js'
import { useQuasar } from 'quasar'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  clienteId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

const $q = useQuasar()
const selectedEmployee = ref(props.modelValue)
const employeesList = ref([])
const loading = ref(false)
const employeeOptions = ref([])

// Computed
const savedEmployees = computed(() => {
  return employeesList.value.map(emp => ({
    label: emp.nome,
    value: emp.nome,
    isNew: false
  }))
})

// Watchers
watch(selectedEmployee, (newValue) => {
  emit('update:modelValue', newValue)
})

watch(() => props.modelValue, (newValue) => {
  selectedEmployee.value = newValue
})

watch(() => props.clienteId, () => {
  loadEmployees()
})

// Methods
const loadEmployees = async () => {
  if (!props.clienteId) return
  
  try {
    loading.value = true
    const employees = await db.funcionarios
      .where('cliente_id')
      .equals(props.clienteId)
      .toArray()
    
    employeesList.value = employees
    employeeOptions.value = savedEmployees.value
  } catch (error) {
    console.error('Erro ao carregar funcionários:', error)
    $q.notify({
      type: 'negative',
      message: 'Erro ao carregar funcionários'
    })
  } finally {
    loading.value = false
  }
}

const filterEmployees = (val, update) => {
  update(() => {
    if (val === '') {
      employeeOptions.value = savedEmployees.value
    } else {
      const needle = val.toLowerCase()
      const filtered = savedEmployees.value.filter(emp => 
        emp.label.toLowerCase().includes(needle)
      )
      
      // If the input doesn't match any existing employee, add it as a new option
      const exactMatch = filtered.find(emp => 
        emp.label.toLowerCase() === needle
      )
      
      if (!exactMatch && val.trim()) {
        filtered.push({
          label: val,
          value: val,
          isNew: true
        })
      }
      
      employeeOptions.value = filtered
    }
  })
}

const addNewEmployee = (val, done) => {
  // The val is the new employee name
  if (val.trim()) {
    // Save to database
    saveNewEmployee(val.trim())
    done(val.trim())
  }
}

const saveNewEmployee = async (employeeName) => {
  try {
    // Check if employee already exists
    const existing = await db.funcionarios
      .where('cliente_id')
      .equals(props.clienteId)
      .and(funcionario => funcionario.nome.toLowerCase() === employeeName.toLowerCase())
      .first()
    
    if (!existing) {
      await db.funcionarios.add({
        nome: employeeName,
        cliente_id: props.clienteId,
        created_at: new Date(),
      })
      
      // Reload employees list
      await loadEmployees()
      
      $q.notify({
        type: 'positive',
        message: `Funcionário "${employeeName}" salvo`,
        timeout: 1500
      })
    }
  } catch (error) {
    console.error('Erro ao salvar funcionário:', error)
    $q.notify({
      type: 'negative',
      message: 'Erro ao salvar funcionário'
    })
  }
}

const handleEmployeeChange = (value) => {
  selectedEmployee.value = value
}

// Lifecycle
onMounted(() => {
  loadEmployees()
})
</script>

<style scoped>
.employee-selector {
  width: 100%;
}

/* Custom styling for new employee options */
:deep(.q-item-label) {
  font-weight: 500;
}

:deep(.q-item-label[caption]) {
  font-style: italic;
  color: var(--q-primary);
}
</style>