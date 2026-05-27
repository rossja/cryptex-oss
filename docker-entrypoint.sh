#!/bin/sh
# Cryptex OSS container entrypoint.
#
# Prints a friendly URL banner to stdout before handing off to the CMD
# (nginx). The container always serves on port 80 internally; the user
# maps it to a host port via `-p` (docker run) or the CRYPTEX_PORT env
# var (docker-compose default 8080). This script does NOT print the host
# port because it has no way of knowing the mapping — only the operator
# does.
set -e

echo ""
echo "  Cryptex OSS"
echo "  -----------"
echo "  Listening inside the container on port 80."
echo "  -> Open http://localhost:8080/  (docker-compose default host port)"
echo "     or your -p <host-port>:80 mapping."
echo "  Docs: https://github.com/m4xx101/cryptex-oss"
echo ""

exec "$@"
