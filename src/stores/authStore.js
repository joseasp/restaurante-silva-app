import { defineStore } from 'pinia';
import { ref } from 'vue';

// O PIN correto. Em um app real, isso viria de um lugar mais seguro,
// mas para um sistema local, está ótimo.
const ADMIN_PIN = '1234';

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false); // O admin está logado?

  function checkPin(pin) {
    if (pin === ADMIN_PIN) {
      isAuthenticated.value = true;
      return true;
    }
    return false;
  }

  function logout() {
    isAuthenticated.value = false;
  }

  return { isAuthenticated, checkPin, logout };
});