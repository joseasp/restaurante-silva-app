import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      // Rota raiz: redireciona para o caderno diário
      path: '/',
      redirect: '/caderno'
    },
    {
      path: '/caderno',
      name: 'caderno',
      component: () => import('../views/CadernoDiarioView.vue')
    },
    {
      path: '/produtos',
      name: 'produtos',
      component: () => import('../views/ProdutosView.vue')
    },
    {
      path: '/clientes',
      name: 'clientes',
      component: () => import('../views/ClientesView.vue')
    },
    {
      path: '/contas-receber',
      name: 'contas-receber',
      component: () => import('../views/ContasReceberView.vue')
    }
  ]
})

export default router