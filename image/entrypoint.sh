#!/bin/bash -eu
### ENV ###
# NB_USER
# NB_USER_ID
# NB_GROUP
# NB_GROUP_ID
# NB_HOSTNAME
# NB_SSHPORT
# NB_USER_PASSWORD
# TZ

# Set timezone
ln -fs /usr/share/zoneinfo/${TZ} /etc/localtime
exec "$@"


### Create user and group
# Check if the user exists
if id "$NB_USER" >/dev/null 2>&1; then
    echo "User $NB_USER already exists"
else
    echo "User $NB_USER does not exist, creating now"
    # Create user with specific UID and set the password
    useradd -u $NB_USER_ID -m -d /home/$NB_USER -s /bin/bash $NB_USER
    echo "$NB_USER:$(echo $NB_USER_PASSWORD)" | chpasswd
    echo "User $NB_USER has been created"
    echo "$NB_USER ALL=(ALL:ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/$NB_USER
fi

# Check if the group exists
if getent group $NB_GROUP >/dev/null; then
    echo "Group $NB_GROUP already exists"
else
    echo "Group $NB_GROUP does not exist, creating now"
    # Create group with specific GID and add the user to the group
    groupadd -g $NB_GROUP_ID $NB_GROUP
    usermod -g $NB_GROUP $NB_USER
    echo "Group $NB_GROUP has been created and $NB_USER has been added to the group"
fi

# Set permission for user directory
chown $NB_USER:$NB_GROUP /home/$NB_USER
chmod 770 /home/$NB_USER

# Output the user and group info
id $NB_USER

# Copy bashrc if not exist
if [ ! -f "/home/$NB_USER/.bashrc" ]; then
    cp /root/.bashrc /home/$NB_USER/.bashrc
fi

# Mamba init
runuser -l $NB_USER -c "mamba init"

# Check if the hostname is already in the /etc/hosts file
hostname_check=$(grep "^.*[[:space:]]$NB_HOSTNAME" /etc/hosts || true)

# If the hostname is not found in the file, add it
if [ -z "$hostname_check" ]; then
  # Get the IP address of the server
  ip_address="127.0.0.1"

  # Add the IP address and hostname to the /etc/hosts file
  echo "$ip_address $NB_HOSTNAME" | sudo tee -a /etc/hosts
  echo "Hostname added to /etc/hosts."
else
  echo "Hostname already in /etc/hosts."
fi

# Wipe dead screen
screen -wipe 2>&1 || true
runuser -l $NB_USER -c "screen -wipe 2>&1 || true"


# Reset ssh port
if [ -z "${NB_SSHPORT}" ]; then
    NB_SSHPORT=2222
fi
echo "Port ${NB_SSHPORT}" > /etc/ssh/sshd_config.d/10-port.conf


# The path to the directory where the SSH host keys are expected to be
key_dir="/home/$NB_USER/.config/nyabase/ssh_key/$NB_HOSTNAME"
# Check if the directory exists
if [ -d "$key_dir" ]; then
    echo "Directory $key_dir exists."

    # The directory exists, so we set the host keys to be those found in the directory
    cp $key_dir/ssh_host_* /etc/ssh/
    chown root:root /etc/ssh/ssh_host_*
    chmod 600 /etc/ssh/ssh_host_*
else
    echo "Directory $key_dir does not exist."

    # The directory does not exist, so we generate new SSH host keys
    rm -fr /etc/ssh/ssh_host_*
    ssh-keygen -A

    # Make the directory
    runuser -l $NB_USER -c "mkdir -p $key_dir"

    # Copy the generated SSH host keys to the directory
    cp /etc/ssh/ssh_host_* $key_dir/
fi


# Check if the file is created, if not, change the password
FILE_PATH="/home/$NB_USER/.config/nb/$NB_HOSTNAME/.password_set"

if [ -f "$FILE_PATH" ]; then
  echo "Password has been set previously."
else
  echo "$NB_USER:$NB_USER_PASSWORD" | chpasswd
  runuser -l $NB_USER -c "touch "$FILE_PATH""
  echo "Password updated successfully and file created."
fi


# Run user's init shell
FILE_PATH="/home/$NB_USER/init/$NB_HOSTNAME.sh"
if [ -f "$FILE_PATH" ]; then
  echo "Init file exists. Executing..."
  chmod +x "$FILE_PATH" 
  runuser -l $NB_USER -c "$FILE_PATH"
else
  echo "Init file does not exist, creating one"
  runuser -l $NB_USER -c "mkdir -p "/home/$NB_USER/init""
  runuser -l $NB_USER -c "echo '# This file will be executed once when the system is up' >> $FILE_PATH"
fi


# Unset all NB_ environment variables
for var in $(env | grep "^NB_" | cut -d '=' -f1); do
    unset $var
done


# Start daemon
/usr/sbin/sshd -D -e
