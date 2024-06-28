# export BASE_CONTAINER=ubuntu:22.04
# export BASE_CONTAINER_NAME=base

export BASE_CONTAINER=nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04
export BASE_CONTAINER_NAME=cuda12.4.1-cudnn

cp motd.txt motd.txt.tmp

DATE=$(date +'%Y%m%d')
LEFT="Build: $DATE"
RIGHT="Image: $BASE_CONTAINER_NAME"
TOTAL_LENGTH=46
LEFT_LENGTH=${#LEFT}
RIGHT_LENGTH=${#RIGHT}
SPACE_COUNT=$((TOTAL_LENGTH - LEFT_LENGTH - RIGHT_LENGTH))
SPACES=$(printf "%${SPACE_COUNT}s")
NEW_LINE="$LEFT$SPACES$RIGHT"

sed -i -e "\$i\\$NEW_LINE" motd.txt.tmp

echo "Building image nyabase/nyabase:$BASE_CONTAINER_NAME"

sudo docker build -t nyabase/nyabase:$BASE_CONTAINER_NAME --build-arg BASE_CONTAINER=$BASE_CONTAINER .

rm motd.txt.tmp

sudo docker push nyabase/nyabase:$BASE_CONTAINER_NAME
