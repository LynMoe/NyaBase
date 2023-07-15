import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// import ArcoVue from '@arco-design/web-vue'
// import '@arco-design/web-vue/dist/arco.css'

import CanvasJSStockChart from '@canvasjs/vue-stockcharts'
// import '../node_modules/font-awesome/css/font-awesome.min.css'

const app = createApp(App)

app.use(router)
// app.use(ArcoVue)
app.use(CanvasJSStockChart)

app.mount('#app')
