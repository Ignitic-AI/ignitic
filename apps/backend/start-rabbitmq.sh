#!/usr/bin/env bash
set -euo pipefail

NAME="rabbitmq"
VOL="rabbitmq-data"
HOST_BIND="127.0.0.1"
AMQP_PORT="5672"
MGMT_PORT="15672"

USER="sami"
PASS_RAW="sami@1234"
PASS_ENC="${PASS_RAW//@/%40}"

if ! docker volume inspect "$VOL" >/dev/null 2>&1; then
  echo ">> Creating volume: $VOL"
  docker volume create "$VOL" >/dev/null
fi

if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
  echo ">> Removing existing container: $NAME"
  docker rm -f "$NAME" >/dev/null
fi

echo ">> Starting RabbitMQ container..."
docker run -d --name "$NAME" --hostname "$NAME" \
  -p "${HOST_BIND}:${AMQP_PORT}:5672" \
  -p "${HOST_BIND}:${MGMT_PORT}:15672" \
  -e RABBITMQ_DEFAULT_USER="${USER}" \
  -e RABBITMQ_DEFAULT_PASS="${PASS_RAW}" \
  -v "${VOL}:/var/lib/rabbitmq" \
  rabbitmq:3.13-management >/dev/null

echo ">> Enabling delayed message exchange plugin (optional)..."
docker exec "$NAME" rabbitmq-plugins enable --offline rabbitmq_delayed_message_exchange >/dev/null || true

echo ">> Waiting for RabbitMQ to be healthy..."
for i in $(seq 1 60); do
  if docker exec "$NAME" rabbitmq-diagnostics -q check_running >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec "$NAME" rabbitmq-diagnostics -q check_running >/dev/null
echo ">> RabbitMQ is running."

AMQP_URL="amqp://${USER}:${PASS_ENC}@localhost:${AMQP_PORT}/%2F"   # default vhost "/"
echo
echo "✅ Use this in your apps:"
echo "AMQP_URL=${AMQP_URL}"
echo "AI_BUS_SECRET=dev-shared-hmac   # set the same value in backend and AI engine"
echo
echo "🔎 Management UI: http://localhost:${MGMT_PORT}  (login: ${USER} / ${PASS_RAW})"
