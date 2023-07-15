FROM ubuntu:22.04

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

USER root

# Set timezone
RUN ln -fs /usr/share/zoneinfo/Asia/Shanghai /etc/localtime

# Replace apt source
RUN sed -i 's@//.*archive.ubuntu.com@//mirrors.bfsu.edu.cn@g' /etc/apt/sources.list
RUN apt update && apt install -y ca-certificates
# RUN sed -i 's/http/https/g' /etc/apt/sources.list
RUN cp /etc/apt/sources.list /etc/apt/sources.list.bak && \
    awk 'BEGIN{OFS=FS} $1 ~ /^deb/ && $2 !~ /^http:\/\/security/ {$2="https:" substr($2,6)} 1' /etc/apt/sources.list.bak > /etc/apt/sources.list


# Install packages
RUN apt update
RUN DEBIAN_FRONTEND=noninteractive apt install -y openssh-server sudo vim aria2 git screen \
      tini curl wget tzdata && \
    echo "en_US.UTF-8 UTF-8" > /etc/locale.gen

# Deny root login
RUN sed -i 's/^#\(PermitRootLogin\) .*/\1 no/' /etc/ssh/sshd_config; \
    sed -i 's/^\(UsePAM yes\)/# \1/' /etc/ssh/sshd_config

# Enable prompt color in the skeleton .bashrc before creating the default NB_USER
# hadolint ignore=SC2016
RUN sed -i 's/^#force_color_prompt=yes/force_color_prompt=yes/' /etc/skel/.bashrc && \
   # Add call to conda init script see https://stackoverflow.com/a/58081608/4413446
   echo 'eval "$(command conda shell.bash hook 2> /dev/null)"' >> /etc/skel/.bashrc

ENV CONDA_DIR=/var/conda \
    SHELL=/bin/bash \
    PYTHON_VERSION=3.10    

# Create NB_USER with name jovyan user with UID=1000 and in the 'users' group
# and make sure these dirs are writable by the `users` group.
RUN echo "auth requisite pam_deny.so" >> /etc/pam.d/su && \
    sed -i.bak -e 's/^%admin/#%admin/' /etc/sudoers && \
    sed -i.bak -e 's/^%sudo/#%sudo/' /etc/sudoers

# USER ${NB_UID}

# Install conda as jovyan and check the sha256 sum provided on the download site
WORKDIR /tmp

# CONDA_MIRROR is a mirror prefix to speed up downloading
# ARG CONDA_MIRROR=https://mirrors.bfsu.edu.cn/github-release/conda-forge/miniforge/LatestRelease
ARG CONDA_MIRROR=https://mirror.nju.edu.cn/github-release/conda-forge/miniforge/LatestRelease/

RUN set -x && \
    # Miniforge installer
    miniforge_arch=$(uname -m) && \
    miniforge_installer="Mambaforge-Linux-${miniforge_arch}.sh" && \
    aria2c -x 8 "${CONDA_MIRROR}/${miniforge_installer}" && \
    /bin/bash "${miniforge_installer}" -f -b -p "${CONDA_DIR}" && \
    rm "${miniforge_installer}" && \
    # Conda configuration see https://conda.io/projects/conda/en/latest/configuration.html
    $CONDA_DIR/bin/conda config --system --set auto_update_conda false && \
    $CONDA_DIR/bin/conda config --system --set show_channel_urls true && \
    if [[ "${PYTHON_VERSION}" != "default" ]]; then $CONDA_DIR/bin/mamba install --quiet --yes python="${PYTHON_VERSION}"; fi && \
    # Pin major.minor version of python
    $CONDA_DIR/bin/mamba list python | grep '^python ' | tr -s ' ' | cut -d ' ' -f 1,2 >> "${CONDA_DIR}/conda-meta/pinned" && \
    # Using conda to update all packages: https://github.com/mamba-org/mamba/issues/1092
    $CONDA_DIR/bin/conda update --all --quiet --yes && \
    $CONDA_DIR/bin/conda clean --all -f -y && \
    chmod -R 777 "${CONDA_DIR}" && \
    # mamba init && \
    rm -rf "/root/.cache"

ARG PATH=$CONDA_DIR/bin:$PATH
RUN echo "PATH=$PATH" >> /etc/profile


# entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

COPY healthcheck.sh /usr/local/bin/healthcheck.sh
HEALTHCHECK --interval=10s --timeout=15s --start-period=30s \  
    CMD sh /usr/local/bin/healthcheck.sh

COPY motd.txt /etc/motd
RUN sed -i 's/PrintMotd no/PrintMotd yes/' /etc/ssh/sshd_config

RUN echo "root:$(tr -dc 'A-Za-z0-9!@#$%^&*()' < /dev/urandom | head -c 32)" | chpasswd

# RUN apt update && apt upgrade -y
RUN service ssh start && apt clean && rm -fr /tmp/* && rm -rf /var/lib/apt/lists/*

WORKDIR /

CMD ["tini", "-g", "--", "entrypoint.sh"]
