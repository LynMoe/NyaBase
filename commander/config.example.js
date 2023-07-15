module.exports = {
  key: 'a-random-string',
  db: {
    uri: 'mongodb://root:root@127.0.0.1:27017/',
    name: 'nyabase',
  },
  envs: {
    '%GLOBAL_ENV%': '-v'
  },
  agent: {
    'A800-1': {
      name: 'A800-1',
      basePort: 32000,
      shownIp: '202.0.0.1',
      url: 'http://127.0.0.1:3001',
      key: 'a-string-of-32-characters',
      envs: {
        '%DATA_VOL%': '/data/userContainerData/',
      },
    },
  },
  images: {
    'NyaBase': {
      name: 'NyaBase',
      note: 'Includes SSH, Conda, Python 3.10.',
      cmd: [
        '-d -i',
        '--name %CONTAINER_NAME%',
        '--hostname %AGENT_NAME%_%USERNAME%',

        '-e NB_USER=%USERNAME%',
        '-e NB_USER_ID=%UID%',
        '-e NB_GROUP=%USERNAME%',
        '-e NB_GROUP_ID=%UID%',
        '-e NB_HOSTNAME=%AGENT_NAME%_%USERNAME%',
        '-e NB_SSHPORT=%BASEPORT%',
        '-e NB_USER_PASSWORD=%PASSWORD%',

        '-p %BASEPORT%:%BASEPORT%',
        '-p %PORTRANGE%:%PORTRANGE%',

        '-e TZ=Asia/Shanghai',

        '|%GPUNUM%|--runtime=nvidia --gpus %GPUNUM%',
        '|%CPU_LIMIT%|--cpus=%CPU_LIMIT%',
        
        'nyabase:latest',
      ],
    },
  },
  user: {
    uidStarts: 3000,
  },
}
