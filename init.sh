#!/bin/sh

git clone https://github.com/xsystems8/jtl-infra-public.git ./
touch storage.db;
touch .env;
echo 'APP_PORT=8888' > .env;
docker compose pull;

echo 'Success install! Next step run.sh or daemon mode ran_daemon.sh'