<template>
  <div style="margin: 0 24px;">
    <a-modal v-model:visible="visibleChangePassword" title="Change password" @before-ok="handleBeforeOkChangePassword">
      <a-space direction="vertical" style="width: 100%;">
        <a-form layout="vertical" :model="formChangePassword">
          <a-form-item field="newPassword" label="New Password">
            <a-input-password v-model="formChangePassword.newPassword" />
          </a-form-item>
          <a-form-item field="confirmPassword" label="Confirm Password">
            <a-input-password v-model="formChangePassword.confirmPassword" />
          </a-form-item>
        </a-form>
      </a-space>
    </a-modal>

    <a-row style="margin: 8px 12px 16px 12px; align-items: baseline;" justify="space-between">
      <a-col :span="4">
        <a-statistic title="Servers" :value="serverList.length" show-group-separator />
      </a-col>
      <a-col :span="12" style="text-align: end;">
        <a-button @click="modalChangePassword" type="text">
          <template #icon>
            <icon-lock />
          </template>
          <template #default>Change Password</template>
        </a-button>
      </a-col>
    </a-row>

    <a-list :size="'large'">
      <template #header>
        <a-row justify="space-between" style="align-items: baseline;">
          <a-col :span="4">
            <div>Statistics of {{ selectedServer }}</div>
          </a-col>
          <a-col :span="12" style="text-align: end;">
            <a-space>
              <a-button @click="getData" type="primary">
                <template #icon>
                  <icon-sync />
                </template>
                <template #default>Refresh</template>
              </a-button>
              <a-select :style="{ width: '80px' }" placeholder="Time Period" @change="getData" v-model="timePeriod"
                :trigger-props="{ autoFitPopupMinWidth: true }">
                <a-option value="3600" default>1h</a-option>
                <a-option value="21600">6h</a-option>
                <a-option value="86400">1d</a-option>
                <a-option value="604800">7d</a-option>
                <a-option value="2592000">30d</a-option>
              </a-select>
              <a-select :style="{ width: '140px' }" placeholder="Server" @change="getData" v-model="selectedServer"
                :trigger-props="{ autoFitPopupMinWidth: true }">
                <a-option v-for="server in serverList" :key="server" :value="server">
                  {{ server }}
                </a-option>
              </a-select>
            </a-space>
          </a-col>
        </a-row>
      </template>
      <a-list-item v-for="options in chartOptions" :key="options.title">
        <CanvasJSChart :options="options" :styles="styleOptions" @chart-ref="chartRef" />
      </a-list-item>
    </a-list>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import axios from 'axios'
import { Message } from '@arco-design/web-vue'
import '@arco-design/web-vue/es/message/style/css.js'

import {
  IconSync,
  IconLock,
} from '@arco-design/web-vue/es/icon'

import CanvasJS from '@canvasjs/charts'
import '../../node_modules/font-awesome/css/font-awesome.min.css'

function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)

  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

function stringToColor(str) {
  str = btoa('hash' + encodeURIComponent(str))
  const hash = cyrb53(str)

  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 255
    color += ('00' + value.toString(16)).slice(-2)
  }

  return color
}

export default defineComponent({
  components: {
    CanvasJSChart: CanvasJS.vue,
    IconSync,
    IconLock,
  },
  methods: {
    chartRef(chartInstance) {
      this.charts.push(chartInstance)
    },
    syncCharts(charts, syncToolTip, syncCrosshair, syncAxisXRange) {
      if (!this.onToolTipUpdated) {
        this.onToolTipUpdated = function (e) {
          for (var j = 0; j < charts.length; j++) {
            if (charts[j] != e.chart)
              charts[j].toolTip.showAtX(e.entries[0].xValue, e.entries[0].dataSeriesIndex);
          }
        }
      }

      if (!this.onToolTipHidden) {
        this.onToolTipHidden = function (e) {
          for (var j = 0; j < charts.length; j++) {
            if (charts[j] != e.chart)
              charts[j].toolTip.hide();
          }
        }
      }

      if (!this.onCrosshairUpdated) {
        this.onCrosshairUpdated = function (e) {
          for (var j = 0; j < charts.length; j++) {
            if (charts[j] != e.chart)
              charts[j].axisX[0].crosshair.showAt(e.value);
          }
        }
      }

      if (!this.onCrosshairHidden) {
        this.onCrosshairHidden = function (e) {
          for (var j = 0; j < charts.length; j++) {
            if (charts[j] != e.chart)
              charts[j].axisX[0].crosshair.hide();
          }
        }
      }

      if (!this.onRangeChanged) {
        this.onRangeChanged = function (e) {
          for (var j = 0; j < charts.length; j++) {
            if (e.trigger === "reset") {
              charts[j].options.axisX.viewportMinimum = charts[j].options.axisX.viewportMaximum = null;
              charts[j].options.axisY.viewportMinimum = charts[j].options.axisY.viewportMaximum = null;
              charts[j].render();
            } else if (charts[j] !== e.chart) {
              charts[j].options.axisX.viewportMinimum = e.axisX[0].viewportMinimum;
              charts[j].options.axisX.viewportMaximum = e.axisX[0].viewportMaximum;
              charts[j].render();
            }
          }
        }
      }

      for (var i = 0; i < charts.length; i++) {

        //Sync ToolTip
        if (syncToolTip) {
          if (!charts[i].options.toolTip)
            charts[i].options.toolTip = {};

          charts[i].options.toolTip.updated = this.onToolTipUpdated;
          charts[i].options.toolTip.hidden = this.onToolTipHidden;
        }

        //Sync Crosshair
        if (syncCrosshair) {
          if (!charts[i].options.axisX)
            charts[i].options.axisX = { labelAngle: 0, valueFormatString: "MMM D", crosshair: { enabled: true, snapToDataPoint: true, valueFormatString: "HH:mm" } };

          charts[i].options.axisX.crosshair.updated = this.onCrosshairUpdated;
          charts[i].options.axisX.crosshair.hidden = this.onCrosshairHidden;
        }

        //Sync Zoom / Pan
        if (syncAxisXRange) {
          charts[i].options.zoomEnabled = true;
          charts[i].options.rangeChanged = this.onRangeChanged;
        }

        charts[i].render();
      }
    },
    getServer() {
      return axios.get('/home/getServer').then((res) => {
        if (res.data.status === 200) {
          // console.log(res.data)
          this.serverList = res.data.data.serverList
          this.selectedServer = this.serverList[0]
          this.getData()
        }
      }).catch((err) => {
        console.log(err)
        Message.error('Failed to get server list')
      })
    },
    getData() {
      if (!this.intervalId) {
        this.intervalId = setInterval(() => {
          this.getData()
        }, 12000)
      }
      const serverName = this.selectedServer
      const period = this.timePeriod
      return axios.get('/home/systemInformation', {
        params: {
          serverName,
          period,
        },
      }).then((res) => {
        if (res.data.status === 200) {
          // console.log(res.data)

          const data = res.data.data.data
          const chartsList = {
            'CPU Utilization': data.cpu,
            'Memory Utilization': data.mem,
            'Disk Utilization': data.disk,
            'Network Utilization': data.network,
            ...data.gpu,
          }
          // console.log(chartsList)
          let minTime = Object.values(data.cpu).map(i => i[0].x).sort((a, b) => a - b)[0]
          let maxTime = Object.values(data.cpu).map(i => i[i.length - 1].x).sort((a, b) => b - a)[0]
          minTime = new Date(minTime)
          maxTime = new Date(maxTime)

          this.chartOptions = []

          for (const name in chartsList) {
            const points = []
            for (const label in chartsList[name]) {
              const value = chartsList[name][label]
              points.push({
                type: name.includes('NVIDIA') || name.includes('Memory') ? 'stackedArea': 'splineArea',
                name: label,
                color: stringToColor(label),
                xValueType: 'dateTime',
                xValueFormatString: "DD MMM YY HH:mm",
                showInLegend: true,
                dataPoints: value,
              })
            }

            const chartOptions = {
              theme: "light2",
              animationEnabled: false,
              title: {
                text: name,
                fontSize: 16,
              },
              axisX: {
                minimum: minTime,
                maximum: maxTime,
              },
              axisY: {
                title: "Percentage",
                titleFontSize: 14,
              },
              toolTip: {
                shared: true,
                contentFormatter: function (e) {
                  let formatter = (num) => {
                    return num.toFixed(2)
                  }

                  if (name.includes('NVIDIA')) {
                    formatter = (num) => {
                      return (num / 1024).toFixed(2) + " GB"
                    }
                  } else if (name.includes('CPU')) {
                    formatter = (num) => {
                      return num.toFixed(2) + " %"
                    }
                  } else if (name.includes('Memory')) {
                    formatter = (num) => {
                      return (num / 1024 / 1024).toFixed(2) + " GB"
                    }
                  } else if (name.includes('Network')) {
                    formatter = (num) => {
                      return (num / 1000 / 1000).toFixed(2) + " MB/s"
                    }
                  } else if (name.includes('Disk')) {
                    formatter = (num, item) => {
                      let suffix = ''
                      if (item && item.use) {
                        suffix = ' (' + item.use.toFixed(2) + '%)'
                      }

                      return (num / 1024 / 1024 / 1024).toFixed(2) + " GB" + suffix
                    }
                  }

                  let content = ''
                  let total = 0
                  for (let i = 0; i < e.entries.length; i++) {
                    content += `<span style="color: ${e.entries[i].dataSeries.color}">${e.entries[i].dataSeries.name}</span>` + ": " + formatter(e.entries[i].dataPoint.y, e.entries[i].dataPoint) + '<br/>'
                    total += e.entries[i].dataPoint.y
                  }

                  if (e.entries.length > 1) content += `<hr/><span style="color: #4F81BC">Total</span>` + ": " + formatter(total)
                  return content
                },
              },
              data: points,
            }

            if (name.includes('NVIDIA')) {
              chartOptions.axisY.title = 'Memory'
              chartOptions.axisY.minimum = 0
              chartOptions.axisY.maximum = 80 * 1024
              chartOptions.axisY.labelFormatter = function (e) {
                return (e.value / 1024).toFixed(2) + " GB"
              }
            } else if (name.includes('CPU')) {
              chartOptions.axisY.title = 'Percentage'
              chartOptions.axisY.minimum = 0
              chartOptions.axisY.labelFormatter = function (e) {
                return (e.value).toFixed(2) + "%"
              }
            } else if (name.includes('Memory')) {
              chartOptions.axisY.title = 'Memory'
              chartOptions.axisY.minimum = 0
              chartOptions.axisY.labelFormatter = function (e) {
                return (e.value / 1024 / 1024).toFixed(2) + " GB"
              }
            } else if (name.includes('Network')) {
              chartOptions.axisY.title = 'Network'
              chartOptions.axisY.minimum = 0
              chartOptions.axisY.labelFormatter = function (e) {
                return (e.value / 1000 / 1000).toFixed(2) + " MB/s"
              }
            } else if (name.includes('Disk')) {
              chartOptions.axisY.title = 'Disk'
              chartOptions.axisY.minimum = 0
              chartOptions.axisY.labelFormatter = function (e) {
                return (e.value / 1024 / 1024 / 1024).toFixed(2) + " GB"
              }
            }

            this.chartOptions.push(chartOptions)
          }

          setTimeout(() => {
            // this.syncCharts(this.charts, true, true, true)
          }, 500)
        }
      }).catch((err) => {
        console.log(err)
        Message.error('Failed to get data')
      })
    },
    modalChangePassword() {
      this.visibleChangePassword = true
    },
    handleBeforeOkChangePassword() {
      if (this.formChangePassword.newPassword !== this.formChangePassword.confirmPassword) {
        Message.error('Password not match')
        return false
      }

      return axios.get('/user/changePassword', {
        params: {
          password: this.formChangePassword.newPassword,
        },
      }).then((res) => {
        if (res.data.status === 200) {
          Message.success('Password changed')
        }
      }).catch((err) => {
        console.log(err)
      }).finally(() => {
        this.formChangePassword.newPassword = ''
        this.formChangePassword.confirmPassword = ''
      })
    },

  },
  data: () => {
    return {
      charts: [],
      styleOptions: {
        width: "100%",
        height: "360px"
      },
      chartOptions: [],
      serverList: [],
      selectedServer: '',
      timePeriod: '3600',
      intervalId: null,
      formChangePassword: {
        newPassword: '',
        confirmPassword: '',
      },
      visibleChangePassword: false,
    }
  },
  mounted() {
    this.getServer()
  },
  beforeUnmount() {
    clearInterval(this.intervalId)
  },
})
</script>

<style scoped></style>
