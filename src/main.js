import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar, Notify } from 'quasar'

// Import icon libraries
import '@quasar/extras/material-icons/material-icons.css'

// Import Quasar css
import 'quasar/src/css/index.sass'
import './main.css'

import App from './App.vue'
import router from './router'

const myApp = createApp(App)

myApp.use(createPinia())
myApp.use(router)

myApp.use(Quasar, {
  plugins: {
    Notify
  },
})

myApp.mount('#app')