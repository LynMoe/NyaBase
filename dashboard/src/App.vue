<template>
  <a-layout class="layout">
    <div v-if="isLogin">
      <a-layout-header>
        <a-menu v-model:selected-keys="selectedKeys" @menuItemClick="onClickMenuItem" mode='horizontal'>
          <a-menu-item key="0" :style="{ padding: 0, marginRight: '38px' }" disabled>
            <div :style="{
              width: '30px',
              height: '30px',
            }">
              <a-avatar :size="30" :style="{ backgroundColor: '#3370ff' }">
                Nya
              </a-avatar>
            </div>
          </a-menu-item>
          <a-menu-item key="0_1">
            <IconHome />
            Home
          </a-menu-item>
          <a-menu-item key="0_2">
            <IconStorage />
            Container
          </a-menu-item>
          <a-menu-item key="0_3" v-if="isAdmin">
            <IconSettings />
            Admin
          </a-menu-item>
          <a-menu-item key="0_4">
            <IconLock />
            Logout
          </a-menu-item>
        </a-menu>
      </a-layout-header>
      <a-layout-content style="padding: 12px 24px;">
        <RouterView />
      </a-layout-content>
      <a-layout-footer>
        <!-- <Footer></Footer> -->
      </a-layout-footer>
    </div>
    <div v-else>
      <a-layout-content class="loginContainer">
        <a-card class="loginDiv" title="Login" hoverable>
          <a-form :model="formLogin" :style="{ width: 'auto' }" @submit="handleLogin">
            <a-form-item field="username" label="Username">
              <a-input v-model="formLogin.username" placeholder="Please enter your username." />
            </a-form-item>
            <a-form-item field="password" label="Password">
              <a-input-password v-model="formLogin.password" placeholder="Please enter your password." />
            </a-form-item>
            <a-form-item>
              <a-button type="primary" html-type="submit">Login</a-button>
            </a-form-item>
          </a-form>
        </a-card>
      </a-layout-content>
    </div>
  </a-layout>
</template>
<script>
import { defineComponent, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import axios from 'axios'

import {
  IconHome,
  IconStorage,
  IconSettings,
  IconLock,
} from '@arco-design/web-vue/es/icon'

import { useRouter } from 'vue-router'

export default defineComponent({
  components: {
    IconHome,
    IconStorage,
    IconSettings,
    IconLock,
  },
  data: () => {
    return {
      formLogin: {},
      selectedKeys: ['0_1'],
    }
  },
  methods: {
    handleLogin() {
      console.log(this.formLogin)
      return axios.get('/user/login', {
        params: {
          loginUsername: this.formLogin.username,
          password: this.formLogin.password,
        }
      }).then((res) => {
        if (res.data.status === 200) {
          this.isLogin = true
          localStorage.setItem('auth', res.data.data.token)
          axios.defaults.headers.common['x-auth'] = res.data.data.token
          Message.success({ content: 'Login success', showIcon: true })
          this.checkLogin()
        } else {
          Message.error({ content: res.data.message, showIcon: true })
        }

      }).catch((err) => {
        console.log(err)
        Message.error({ content: err.message, showIcon: true })
      })
    },
    checkLogin() {
      return axios.get('/container/getMeta').then((res) => {
        this.isLogin = true
        const data = res.data.data
        console.log(data)

        const group = data.group
        if (group.name === 'ADMIN') this.isAdmin = true
      }).catch((err) => {
        console.log(err)
        const status = err.response.status
        if (status === 401) {
          this.isLogin = false
          Message.error({ content: 'Unauthorized', showIcon: true })
        } else {
          Message.error({ content: 'Unknown error', showIcon: true })
        }
      })
    },
  },
  setup() {
    const isLogin = ref(false)
    const isAdmin = ref(false)

    const router = useRouter()
    return {
      onClickMenuItem: (key) => {
        Message.info({ content: `You select ${key}`, showIcon: true })

        switch (key) {
          case '0_1':
            router.push({ path: '/' })
            break
          case '0_2':
            router.push({ path: '/container' })
            break
          case '0_3':
            router.push({ path: '/admin' })
            break
          case '0_4':
            localStorage.setItem('auth', '')
            axios.defaults.headers.common['x-auth'] = ''
            Message.success({ content: 'Logout success', showIcon: true })
            isLogin.value = false
            break
          default:
            break
        }
      },
      isLogin,
      isAdmin,
    }
  },
  watch: {
    '$route'(to) {
      if (to.path === '/container') this.selectedKeys[0] = '0_2'
      else if (to.path === '/admin') this.selectedKeys[0] = '0_3'
    }
  },
  mounted() {
    axios.defaults.baseURL = '/api'
    axios.defaults.headers.common['x-auth'] = localStorage.getItem('auth') || '123'

    this.checkLogin()
  },
})
</script>
<style scoped>
.layout {
  height: 100%;
}

.loginContainer {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}

.loginDiv {
  width: 40%;
  margin-bottom: 6%;
}
</style>
