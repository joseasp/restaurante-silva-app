<template>
  <div class="container">
    <h1>Configurações do Restaurante</h1>
    <p>As informações preenchidas aqui aparecerão no cabeçalho dos seus comprovantes e relatórios.</p>

    <form @submit.prevent="salvarConfiguracoes" class="config-form">
      <label for="nomeRestaurante">Nome do Restaurante:</label>
      <input id="nomeRestaurante" type="text" v-model="config.nomeRestaurante" />

      <label for="cnpj">CNPJ:</label>
      <input id="cnpj" type="text" v-model="config.cnpj" />

      <label for="endereco">Endereço:</label>
      <input id="endereco" type="text" v-model="config.endereco" />

      <label for="telefone">Telefone:</label>
      <input id="telefone" type="text" v-model="config.telefone" />

      <button type="submit">Salvar Configurações</button>
    </form>
    <p v-if="mensagemSucesso" class="success-message">{{ mensagemSucesso }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { db } from '@/services/databaseService.js';

const config = ref({
  id: 1, // Usaremos um ID fixo para sempre atualizar o mesmo registro
  nomeRestaurante: '',
  cnpj: '',
  endereco: '',
  telefone: ''
});

const mensagemSucesso = ref('');

const carregarConfiguracoes = async () => {
  const dadosSalvos = await db.configuracoes.get(1);
  if (dadosSalvos) {
    config.value = dadosSalvos;
  }
};

const salvarConfiguracoes = async () => {
  try {
    await db.configuracoes.put(config.value);
    mensagemSucesso.value = 'Configurações salvas com sucesso!';
    setTimeout(() => mensagemSucesso.value = '', 3000); // Limpa a mensagem após 3 segundos
  } catch (error) {
    console.error("Erro ao salvar configurações:", error);
    alert("Houve um erro ao salvar. Tente novamente.");
  }
};

onMounted(carregarConfiguracoes);
</script>

<style scoped>
.container {
  max-width: 700px;
  margin: 20px auto;
  padding: 20px;
  font-family: sans-serif;
}
.config-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.config-form label {
  font-weight: bold;
}
.config-form input {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.config-form button {
  padding: 12px;
  background-color: #0d6efd; /* Azul para ações de sistema */
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1.1em;
  cursor: pointer;
  margin-top: 10px;
}
.success-message {
  margin-top: 15px;
  color: #198754;
  font-weight: bold;
}
</style>