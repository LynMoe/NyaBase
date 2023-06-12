# NyaBase

一个可以日用的Docker容器，应用场景：轻量虚拟机、实验室等。

## 特性

- [x] 基于 Ubuntu 22.04
- [x] 支持 SSH
- [x] 支持开机自启
- [x] 保留主机SSH密钥
- [x] 预装Mamba/Conda环境
- [x] NVIDIA GPU Healthcheck
- [ ] 支持 xfce/gnome/xrdp(折腾了一下没弄出来，求个PR)

## 使用

直接创建容器即可，不需要额外的配置。

```bash
docker build . -t nyabase:lastest
docker run -d --name nya -p 22:22 -v ./home:/home --env-file .env nyabase:lastest
```

### 环境变量

```
# NB_USER
# NB_USER_ID
# NB_GROUP
# NB_GROUP_ID
# NB_HOSTNAME
# NB_SSHPORT
# NB_USER_PASSWORD
# TZ
```

用户、组、密码仅会在重新创建容器时升成。所有`NB_`开头的环境变量将在entrypoint结束后清除。

## LICENSE

MIT
