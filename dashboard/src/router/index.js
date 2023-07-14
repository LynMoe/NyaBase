import { createRouter, createWebHistory } from 'vue-router'
import PageHome from '../components/PageHome.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: PageHome
    },
    {
      path: '/container',
      name: 'container',
      component: () => import('../components/PageContainer.vue')
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../components/PageAdmin.vue')
    }
  ]
})

export default router
