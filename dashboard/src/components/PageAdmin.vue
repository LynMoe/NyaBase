<template>
  <div>
    <a-collapse :default-active-key="['1',]">
      <a-collapse-item header="User Management" key="1">
        <PageAdminUser style="margin-top: 8px;" />
      </a-collapse-item>
      <a-collapse-item header="Group Management" key="2">
        <PageAdminGroup style="margin-top: 8px;" />
      </a-collapse-item>
      <a-collapse-item header="Container Management" key="3">
        <PageAdminContainer style="margin-top: 8px;" />
      </a-collapse-item>
    </a-collapse>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import PageAdminUser from './PageAdminUser.vue'
import PageAdminGroup from './PageAdminGroup.vue'
import PageAdminContainer from './PageAdminContainer.vue'

export default defineComponent({
  components: {
    PageAdminUser,
    PageAdminGroup,
    PageAdminContainer,
  },
  data: () => {
    return {

    }
  },
  methods: {
  },
})
</script>

<style scoped></style>
