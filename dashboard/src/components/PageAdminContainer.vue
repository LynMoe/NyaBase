<template>
  <div>
    <a-row style="margin-bottom: 16px;">
      <a-col :span="8" :offset="16" style="text-align: end;">
        <a-space>
          <a-button @click="getContainerList" type="primary">
            <template #icon>
              <icon-sync />
            </template>
            <template #default>Refresh</template>
          </a-button>
        </a-space>
      </a-col>
    </a-row>
    <a-table :columns="columns" :data="tableContainerList" :pagination="pagination">
      <template #operation="{ record }">
        <a-space>
          <a-button type="outline" @click="restartContainer(record.containerId)">Restart</a-button>
          <a-popconfirm type="warning" content="Do you intend to remove the container?" @before-ok="removeContainer(record.containerId)">
            <a-button type="outline" status="danger">Remove</a-button>
          </a-popconfirm>
        </a-space>

      </template>
    </a-table>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import axios from 'axios'

import { Message } from '@arco-design/web-vue'
import '@arco-design/web-vue/es/message/style/css.js'

import {
  IconSync,
} from '@arco-design/web-vue/es/icon'

export default defineComponent({
  components: {
    IconSync,
  },
  data: () => {
    return {
      pagination: { pageSize: 10 },
      columns: [{
        title: 'Username',
        dataIndex: 'username',
        sortable: {
          sortDirections: ['ascend', 'descend']
        }
      }, {
        title: 'Server',
        dataIndex: 'server',
      }, {
        title: 'Image',
        dataIndex: 'image',
      }, {
        title: 'Operation',
        slotName: 'operation'
      }],
      containerList: [],
    }
  },
  computed: {
    tableContainerList() {
      return this.containerList.map((container) => {
        return {
          ...container,
          key: container.containerId,
        }
      })
    },
  },
  methods: {
    getContainerList() {
      return axios.get('/container/listContainers').then((res) => {
        if (res.data.status === 200) {
          // console.log(res.data.data)
          const data = res.data.data.data.containerList
          this.containerList = data.map((container) => {
            return {
              username: container.username,
              containerId: container.id,
              server: container.agentName,
              image: container.image,
            }
          })
        }
      }).catch((err) => {
        console.log(err)
      })
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
    this.getContainerList()
  },
})
</script>

<style scoped></style>
