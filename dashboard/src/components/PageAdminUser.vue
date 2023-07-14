<template>
  <div>
    <a-modal v-model:visible="visibleNew" title="Create User" @before-ok="handleBeforeOkNew">
      <a-space direction="vertical">
        <a-alert>Please provide the info for each user to be created below. Separate each entry with a comma and ensure
          that each line follows the format: username, password, group, comment.</a-alert>
        <a-form :model="formNew">
          <a-textarea v-model="formNew.data" placeholder="username,password,group,comment..." :auto-size="{
            minRows: 5,
          }" />
        </a-form>
      </a-space>
    </a-modal>

    <a-modal v-model:visible="visibleUpdate" title="Update User" @before-ok="handleBeforeOkUpdate">
      <a-space direction="vertical" style="width: 100%;">
        <a-alert type="warning">Updating user {{ formUpdate.username }}</a-alert>
        <a-form :model="formUpdate">
          <a-form-item field="username" label="Username">
            <a-input v-model="formUpdate.username" />
          </a-form-item>
          <a-form-item field="password" label="Password">
            <a-input v-model="formUpdate.password" />
          </a-form-item>
          <a-form-item field="group" label="Group">
            <a-input v-model="formUpdate.groupName" />
          </a-form-item>
        </a-form>
      </a-space>
    </a-modal>

    <a-row style="margin-bottom: 16px;">
      <a-col :span="8" :offset="16" style="text-align: end;">
        <a-space>
          <a-button @click="handleClickNew" type="primary">
            <template #icon>
              <icon-plus-circle />
            </template>
            <template #default>Create User</template>
          </a-button>
          <a-button @click="getUserList" type="primary">
            <template #icon>
              <icon-sync />
            </template>
            <template #default>Refresh</template>
          </a-button>
        </a-space>
      </a-col>
    </a-row>
    <a-table :columns="columns" :data="tableUserList" :pagination="pagination">
      <template #operation="{ record }">
        <a-space>
          <a-button type="outline" @click="updateUserModal(record)">Update</a-button>
          <a-popconfirm type="warning" content="Do you intend to delete the user?" @before-ok="handleBeforeOkDelete(record.username)">
            <a-button type="outline" status="danger">Delete</a-button>
          </a-popconfirm>
        </a-space>

      </template>
    </a-table>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import axios from 'axios'

import {
  IconPlusCircle,
  IconSync,
} from '@arco-design/web-vue/es/icon'

export default defineComponent({
  components: {
    IconPlusCircle,
    IconSync,
  },
  data: () => {
    return {
      visibleNew: false,
      formNew: {
        data: '',
      },
      visibleUpdate: false,
      formUpdate: {
        username: '',
        password: '',
        groupName: '',
      },
      pagination: { pageSize: 10 },
      columns: [{
        title: 'Username',
        dataIndex: 'username',
        sortable: {
          sortDirections: ['ascend', 'descend']
        }
      }, {
        title: 'Group',
        dataIndex: 'group',
      }, {
        title: 'Comment',
        dataIndex: 'comment',
      }, {
        title: 'Created At',
        dataIndex: 'created',
      }, {
        title: 'Operation',
        slotName: 'operation'
      }],
      userList: [],
      groupList: [],
    }
  },
  computed: {
    tableUserList() {
      return this.userList.map((user) => {
        return {
          ...user,
          created: new Date(user.created / 1000).toLocaleString(),
          key: user.username,
        }
      })
    },
  },
  methods: {
    getUserList() {
      console.log('get user list')
      return axios.get('/admin/listUsers').then((res) => {
        if (res.data.status === 200) {
          console.log(res.data, res.data.data)
          const data = res.data.data.data.userList
          this.userList = data.map((user) => {
            return {
              userId: user.userId,
              username: user.username,
              group: user.group.name,
              comment: user.comment || '',
              created: user.created,
            }
          })
        }
      }).catch((err) => {
        console.log(err)
      })
    },
    updateUserModal(record) {
      console.log(record)
      this.formUpdate.username = record.username
      this.formUpdate.password = ''
      this.formUpdate.groupName = record.group
      this.visibleUpdate = true
    },
    handleBeforeOkNew() {
      let users = this.formNew.data.split('\n')
      users = users.map((user) => {
        const [username, password, group, comment] = user.split(',')
        if (!username || !password || !group) return
        return {
          username,
          password,
          group,
          comment: comment || '',
        }
      }).filter((user) => user)
      return this.createUser(users).then(() => {
        this.getUserList()
      })
    },
    handleBeforeOkUpdate() {
      console.log(this.formUpdate)
      return this.updateUser(this.formUpdate.username, this.formUpdate.password, this.formUpdate.groupName)
        .then(() => {
          this.getUserList()
        })
    },
    handleBeforeOkDelete(username) {
      console.log(username)
      return this.removeUser(username)
        .then(() => {
          this.getUserList()
        })
    },
    createUser(users) {
      console.log(users)
      return Promise.all(users.map((user) => {
        return axios.get('/admin/createUser', {
          params: {
            createUsername: user.username,
            createPassword: user.password,
            createGroupName: user.group,
            // comment: user.comment,
          }
        }).then((res) => {
          if (res.data.status === 200) {
            console.log(res.data, res.data.data)
          }
        }).catch((err) => {
          console.log(err)
        })
      }))
    },
    updateUser(username, password, groupName) {
      const params = {
        createUsername: username,
      }
      if (password) params.createPassword = password
      if (groupName) params.createGroupName = groupName

      return axios.get('/admin/updateUser', {
        params,
      }).then((res) => {
        if (res.data.status === 200) {
          console.log(res.data, res.data.data)
        }
      }).catch((err) => {
        console.log(err)
      })
    },
    removeUser(username) {
      return axios.get('/admin/removeUser', {
        params: {
          createUsername: username,
        },
      }).then((res) => {
        if (res.data.status === 200) {
          console.log(res.data, res.data.data)
        }
      }).catch((err) => {
        console.log(err)
      })
    },
    handleClickNew() {
      this.formNew.data = ''
      this.visibleNew = true
    },

  },
  mounted() {
    this.getUserList()
  },
})
</script>

<style scoped></style>