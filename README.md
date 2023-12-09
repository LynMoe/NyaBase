# NyaBase

一个实验室容器管理平台。

## 特性

- [x] 用户管理
- [x] 容器管理
- [x] 容器模板
- [x] 群组资源管理
- [x] 服务器使用统计

## 使用

待补充...

用户使用说明请查看：[用户指南](docs/USER_MANUAL.md)

目录下agent为运行在资源服务器上的agent，用于管理容器。需要以root权限运行。

commander为管理平台后端，用于收集容器信息，用户管理等，提供API接口。

dashboard为管理平台前端。

## 服务器配置(Ubuntu 22.04)

### 安装 Docker 及显卡驱动

```bash
curl https://get.docker.com | sudo bash
sudo apt update && sudo apt install nvidia-driver-535 nvidia-dkms-535
```

### 安装 Container Toolkit

> 参考 https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/sample-workload.html

```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
  && curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
    sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
    sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list \
  && \
    sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
# sudo docker run --rm --runtime=nvidia --gpus all ubuntu nvidia-smi
```

### 格式化硬盘

```bash
sudo gparted /dev/nvme0n1
# o, n
sudo makefs.xfs /dev/nvme0n1p1
sudo mkdir /data1
sudo echo "/dev/nvme0n1p1 /data1 xfs defaults 0 0" >> /etc/fstab
sudo mount -a
```

### 配置 Docker

```json
{
    "data-root": "/data1/dockerData",
    "exec-opts": [
        "native.cgroupdriver=cgroupfs"
    ],
    "log-driver": "syslog",
    "log-opts": {
        "syslog-address": "tcp://10.0.4.5:5140"
    },
    "runtimes": {
        "nvidia": {
            "args": [],
            "path": "nvidia-container-runtime"
        }
    }
}
```

### 配置防火墙

更改 `SRC` 为本机容器的 IP 段, 最好是一个独立且不重复的网段, 并根据自身需求修改其余内容, 然后将下列命令保存为脚本执行

> 请注意, 本脚本会清空 `DOCKER-USER` 链, 请确保该链没有被其他程序使用

```bash
export SRC="10.88.101.0/24"

sudo docker network create --driver bridge --subnet $SRC nyatainer_network

sudo iptables -F DOCKER-USER
sudo iptables -A DOCKER-USER -j RETURN

# Fobidden access to all internal network
sudo iptables -I DOCKER-USER -s $SRC -d 10.0.0.0/8 -j DROP
sudo iptables -I DOCKER-USER -s $SRC -d 172.16.0.0/12 -j DROP

# Allow established and related connections
sudo iptables -I DOCKER-USER -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow tcp access to 10.0.4.$ip:30000-40000
for ip in $(seq 11 19) $(seq 31 39); do
    sudo iptables -I DOCKER-USER -s $SRC -d 10.0.4.$ip -p tcp --dport 30000:40000 -j ACCEPT
done
```

### 配置 Rsyslog

```bash
echo "*.* @@10.0.4.5:5140" | sudo tee /etc/rsyslog.d/99-all.conf
sudo systemctl restart rsyslog
```

### 配置时区

```bash
sudo timedatectl set-timezone Asia/Shanghai
```

### 配置 NyaBase Agent

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
nvm alias default 14
nvm install 14
nvm use default

git clone https://github.com/LynMoe/NyaBase.git
cd NyaBase/agent
npm install

cp config.example.js config.js
vi config.js

echo "# /etc/systemd/system/nyabase-agent.service

[Unit]
Description=NyaBase Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=/home/lyn/.nvm/versions/node/v14.21.3/bin/node /home/lyn/infra/NyaBase/agent/app.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
" | sudo tee /etc/systemd/system/nyabase-agent.service

sudo systemctl daemon-reload
sudo systemctl enable nyabase-agent
sudo systemctl start nyabase-agent
```

### 配置 NyaBase Commander

```json
...
    'A800-3': {
      name: 'A800-3',
      basePort: 34000,
      shownIp: '1.1.1.1',
      url: 'http://10.0.4.14:3001',
      key: 'key',
      envs: {
        '%DATA_VOL%': '/data1/containerData',
        '%NETWORK%': 'nyatainer_network',
      },
    },
...
```

```bash
sudo systemctl restart nyabase-commander
```

参考镜像配置
```js
  {
    'NyaBase': {
      name: 'NyaBase',
      note: 'Includes SSH, Conda, Python 3.10. CUDA is not included.',
      cmd: [
        '-d -i',
        '--name %CONTAINER_NAME%',
        '--hostname %AGENT_NAME%_%USERNAME%',
        '--restart always',

        '-e NB_USER=%USERNAME%',
        '-e NB_USER_ID=%UID%',
        '-e NB_GROUP=%USERNAME%',
        '-e NB_GROUP_ID=%UID%',
        '-e NB_HOSTNAME=%AGENT_NAME%_%USERNAME%',
        '-e NB_SSHPORT=%BASEPORT%',
        '-e NB_USER_PASSWORD=%PASSWORD%',

        '-p %BASEPORT%:%BASEPORT%',
        '-p %PORTRANGE%:%PORTRANGE%',

        '|%NETWORK%|--network=%NETWORK%',


        '-v /dev/shm:/dev/shm',
        '-v %DATA_VOL%/%AGENT_NAME%_%USERNAME%:/home',

        '-e TZ=Asia/Shanghai',

        '|%GPUNUM%|--runtime=nvidia --gpus %GPUNUM%',
        '|%CPU_LIMIT%|--cpus=%CPU_LIMIT%',
        
        'nyabase/nyabase:latest',
      ],
    },
  }
```

## LICENSE

MIT
