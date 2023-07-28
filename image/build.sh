export GIT_COMMIT=$(git rev-parse --short HEAD)
export GIT_COMMIT_DATE=$(git show -s --format=%cd --date=format:"%d/%m/%Y" $GIT_COMMIT)

docker build --build-arg GIT_COMMIT=$GIT_COMMIT --build-arg GIT_COMMIT_DATE=$GIT_COMMIT_DATE -t nyabase/nyabase:latest .
