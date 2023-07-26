<template>
  <div>
    <a-modal v-model:visible="visibleNew" title="Create Group" @before-ok="handleBeforeOkNew">
      <a-space direction="vertical" style="width: 100%;">
        <a-alert>Please provide the info of the group to be created below.</a-alert>
        <a-form :model="formNew">
          <a-space direction="vertical">
            <a-input v-model="formNew.groupName" placeholder="Group Name" allow-clear />
            <a-input v-model="formNew.groupNote" placeholder="Group Comment" allow-clear />
            <a-textarea v-model="formNew.groupData" placeholder="{...}" :auto-size="{
              minRows: 5,
              maxRows: 20,
            }" />
          </a-space>
        </a-form>
      </a-space>
    </a-modal>

    <a-modal v-model:visible="visibleUpdate" title="Update Group" @before-ok="handleBeforeOkUpdate">
      <a-space direction="vertical" style="width: 100%;">
        <a-alert type="warning">Updating group {{ formUpdate.groupName }}</a-alert>
        <a-form :model="formUpdate">
          <a-form-item field="groupName" label="Group Name">
            <a-input v-model="formUpdate.groupName" />
          </a-form-item>
          <a-form-item field="groupNote" label="Group Note">
            <a-input v-model="formUpdate.groupNote" />
          </a-form-item>
          <a-form-item field="group" label="Group">
            <a-textarea v-model="formUpdate.groupData" placeholder="{...}" :auto-size="{
              minRows: 5,
              maxRows: 20,
            }" />
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
            <template #default>Create Group</template>
          </a-button>
          <a-button @click="getGroupList" type="primary">
            <template #icon>
              <icon-sync />
            </template>
            <template #default>Refresh</template>
          </a-button>
        </a-space>
      </a-col>
    </a-row>
    <a-table :columns="columns" :data="tableGroupList" :pagination="pagination" :expandable="expandable">
      <template #operation="{ record }">
        <a-space>
          <a-button type="outline" @click="updateGroupModal(record)">Update</a-button>
          <a-popconfirm type="warning" content="Do you intend to remove the group?"
            @before-ok="handleBeforeOkDelete(record.name)">
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
      expandable: {
        title: '',
        width: 60,
      },
      visibleNew: false,
      formNew: {
        groupName: '',
        groupNote: '',
        groupData: '',
      },
      visibleUpdate: false,
      formUpdate: {
        groupName: '',
        groupNote: '',
        groupData: '',
      },
      pagination: { pageSize: 10 },
      columns: [{
        title: 'Group Name',
        dataIndex: 'name',
        sortable: {
          sortDirections: ['ascend', 'descend']
        }
      }, {
        title: 'Note',
        dataIndex: 'note',
      }, {
        title: 'Created At',
        dataIndex: 'created',
      }, {
        title: 'Operation',
        slotName: 'operation'
      }],
      groupList: [],
    }
  },
  computed: {
    tableGroupList() {
      return this.groupList.map((group) => {
        return {
          ...group,
          created: new Date(group.created / 1000).toLocaleString(),
          key: group.name,
          expand: JSON.stringify(group, null, 2)
        }
      })
    },
  },
  methods: {
    getGroupList() {
      return axios.get('/admin/listGroups').then((res) => {
        if (res.data.status === 200) {
          // console.log(res.data, res.data.data)
          const data = res.data.data.data.groupList
          this.groupList = data.map((group) => {
            return {
              name: group.name,
              note: group.note || '',
              data: group.data,
              created: group.created,
            }
          })
        }
      }).catch((err) => {
        console.log(err)
      })
    },
    updateGroupModal(record) {
      this.formUpdate.groupName = record.name
      this.formUpdate.groupNote = record.note
      this.formUpdate.groupData = JSON.stringify(record.data, null, 2)
      this.visibleUpdate = true
    },
    handleBeforeOkNew() {
      return this.createGroup(this.formNew.groupName, this.formNew.groupNote, this.formNew.groupData).then(() => {
        this.getGroupList()
      })
    },
    handleBeforeOkUpdate() {
      return this.updateGroup(this.formUpdate.groupName, this.formUpdate.groupNote, this.formUpdate.groupData)
        .then(() => {
          this.getGroupList()
        })
    },
    handleBeforeOkDelete(groupName) {
      return this.removeGroup(groupName)
        .then(() => {
          this.getGroupList()
        })
    },
    createGroup(groupName, groupNote, groupData) {
      groupData = groupData.split('\n').join('')
      return axios.get('/admin/createGroup', {
          params: {
            groupName,
            groupNote,
            groupData: JSON.stringify(JSON.parse(groupData)),
          }
        }).then((res) => {
          if (res.data.status === 200) {
            // console.log(res.data, res.data.data)
          }
        }).catch((err) => {
          console.log(err)
        })
    },
    updateGroup(groupName, groupNote, groupData) {
      groupData = groupData.split('\n').join('')
      // console.log(groupData)
      return axios.get('/admin/updateGroup', {
          params: {
            groupName,
            groupNote,
            groupData: JSON.stringify(JSON.parse(groupData)),
          }
        }).then((res) => {
          if (res.data.status === 200) {
            // console.log(res.data, res.data.data)
          }
        }).catch((err) => {
          console.log(err)
        })
    },
    removeGroup(groupName) {
      return axios.get('/admin/removeGroup', {
        params: {
          groupName,
        },
      }).then((res) => {
        if (res.data.status === 200) {
          // console.log(res.data, res.data.data)
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
    this.getGroupList()
  },
})
</script>

<style scoped></style>
