<template>
  <div>
    <a-modal v-model:visible="visibleNew" title="New Conatiner" @before-ok="handleBeforeOkNew">
      <a-form :model="formNew">
        <a-alert style="margin-bottom: 24px;" type="warning">Currently, each server only allows the creation of one
          container.</a-alert>
        <a-form-item field="server" label="Sevrer">
          <a-select v-model="formNew.server">
            <a-option v-for="server in serverList" :value="server" :key="server">{{ server }}</a-option>
          </a-select>
        </a-form-item>
        <!-- <a-alert type="info">{{ imageList.filter(i => i.name === formNew.image)[0].note }}</a-alert> -->
        <a-form-item field="image" label="Image">
          <a-select v-model="formNew.image">
            <a-option v-for="image in imageList" :value="image.name" :key="image.name">{{ image.name }}</a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-page-header :show-back="false" :title="'Quota: ' + quotaText">
      <template #extra>
        <a-space>
          <a-button @click="handleClickNew" type="primary">
            <template #icon>
              <icon-plus-circle />
            </template>
            <template #default>New</template>
          </a-button>
          <a-button @click="handleClickRefresh" type="primary">
            <template #icon>
              <icon-sync />
            </template>
            <template #default>Refresh</template>
          </a-button>
          <a-button @click="handleClickHelp" type="primary" status="warning">
            <template #icon>
              <icon-exclamation-circle />
            </template>
            <template #default>Need Help?</template>
          </a-button>
        </a-space>
      </template>
    </a-page-header>

    <a-card v-for="info in containerList" :key="info.name" :style="{ width: 'auto', margin: '8px 12px' }" :title="info.name"
      hoverable>
      <template #extra>

        <a-button type="text" @click="modalRestartContainer(info.containerId)">
          <template #icon>
            <icon-refresh />
          </template>
          <template #default>Restart</template>
        </a-button>
        <a-button type="text" status="danger" @click="modalRemoveContainer(info.containerId)">
          <template #icon>
            <icon-delete />
          </template>
          <template #default>Remove</template>
        </a-button>

      </template>
      <a-descriptions :data="[
        ...(() => {
          return Object.entries(info.data).map((data) => {
            return {
              label: data[0],
              value: data[1],
            }
          })
        })(),
      ]" :size="'medium'" :column="2" />
    </a-card>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import { Modal, Message } from '@arco-design/web-vue'
import '@arco-design/web-vue/es/message/style/css.js'
import '@arco-design/web-vue/es/modal/style/css.js'

import axios from 'axios'
import {
  IconPlusCircle,
  IconExclamationCircle,
  IconRefresh,
  IconDelete,
  IconSync,
} from '@arco-design/web-vue/es/icon'

export default defineComponent({
  components: {
    IconPlusCircle,
    IconExclamationCircle,
    IconRefresh,
    IconDelete,
    IconSync,
  },
  data: () => {
    return {
      formNew: {
        server: '',
        image: '',
      },
      visibleNew: false,
      containerList: [],
      imageList: [],
      group: {},
    }
  },
  computed: {
    serverList() {
      const usedServer = this.containerList.map((item) => {
        return item.agentName
      })
      const serverList = Array.from((this.group.data && this.group.data.server) || []).filter((item) => {
        return !usedServer.includes(item)
      })

      return serverList
    },
    quotaText() {
      const used = this.containerList.length
      const total = (this.group.data && this.group.data.server.length) || 0
      return `${used}/${total}`
    },
  },
  methods: {
    getMeta() {
      return axios.get('/container/getMeta').then((res) => {
        if (res.data.status === 200) {
          const data = res.data.data
          // console.log(data)

          this.imageList = Object.values(data.images)
          this.group = data.group

          this.containerList = data.containerList.map((item) => {
            let imageName = item.name.split('_').slice(6).join('_')
            return {
              name: item.agentName,
              containerId: item.id,
              data: {
                'State': item.state,
                'Image': imageName,
                'Username': item.username,
                'Password': item.password,
                'IP Address': item.ip,
                'Base Port': item.basePort,
                'CPU Usage': `${parseFloat(item.cpuPercent).toFixed(3)}%`,
                'Memory Usage': `${(item.memUsage / 1024 / 1024 / 1024).toFixed(3)} GB`,
                'Process Number': item.pids,
              },
            }
          })
        }
      }).catch((err) => {
        console.log(err)
      })
    },
    handleClickNew() {
      this.visibleNew = true
      this.formNew.server = this.serverList[0]
      this.formNew.image = this.imageList[0].name
    },
    handleClickRefresh() {
      this.getMeta()
      Message.success('Refreshed')
    },
    handleClickHelp() {
      Modal.info({
        title: 'Contact Admin',
        content: 'Should you require any assistance, kindly reach out to the administrator at i@lyn.moe.'
      })
    },
    modalRestartContainer(containerId) {
      Modal.confirm({
        title: 'Restart Container',
        content: 'Are you sure to restart this container?',
        escToClose: false,
        maskClosable: false,
        onBeforeOk: () => {
          return this.restartContainer(containerId).then(() => this.modalWait())
        },
      })
    },
    modalRemoveContainer(containerId) {
      Modal.confirm({
        title: 'Remove Container',
        content: 'Are you sure to remove this container?',
        escToClose: false,
        maskClosable: false,
        onBeforeOk: () => {
          return this.removeContainer(containerId).then(() => this.modalWait())
        },
      })
    },
    modalWait() {
      const modal = Modal.confirm({
        title: 'Syncing',
        content: 'It might take 20 seconds, please wait...',
        escToClose: false,
        maskClosable: false,
        hideCancel: true,
        okLoading: true,
      })

      axios.get('/container/wait').then((res) => {
        if (res.data.status === 200) {
          this.getMeta()
          Message.success('Data synced')
          modal.close()
        }
      }).catch((err) => {
        console.log(err)
        this.getMeta()
        Message.error('Data synced with error')
        modal.close()
      })

      return true
    },
    handleBeforeOkNew() {
      return axios.get('/container/create', {
        params: {
          server: this.formNew.server,
          image: this.formNew.image,
        },
      }).then((res) => {
        if (res.data.status === 200) {
          // console.log(res.data, res.data.data)
          Message.success('Created')
        }
      }).catch((err) => {
        console.log(err)
        if (err.response.data.status === 400) {
          Message.error(err.response.data.data.msg)
        }
      }).then(() => this.modalWait())
    },
    restartContainer(containerId) {
      return axios.get('/container/restart', {
        params: {
          containerId,
        },
      }).then((res) => {
        if (res.data.status === 200) {
          Message.success('Restarted')
        }
      }).catch((err) => {
        console.log(err)
      })
    },
    removeContainer(containerId) {
      return axios.get('/container/stopAndRemove', {
        params: {
          containerId,
        },
      }).then((res) => {
        if (res.data.status === 200) {
          Message.success('Removed')
        }
      }).catch((err) => {
        console.log(err)
      })
    },
  },
  mounted() {
    this.getMeta()
  },
})
</script>

<style scoped></style>
