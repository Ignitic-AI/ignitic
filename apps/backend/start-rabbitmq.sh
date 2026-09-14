#!/bin/bash

# Start RabbitMQ using Docker for development
echo "Starting RabbitMQ for development..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Start RabbitMQ container
docker run -d \
    --name rabbitmq-dev \
    -p 5672:5672 \
    -p 15672:15672 \
    -e RABBITMQ_DEFAULT_USER=sami \
    -e RABBITMQ_DEFAULT_PASS=sami@1234 \
    -e RABBITMQ_DEFAULT_VHOST=/ \
    rabbitmq:3-management

echo "RabbitMQ started successfully!"
echo "Management UI: http://localhost:15672"
echo "Username: sami"
echo "Password: sami@1234"
echo ""
echo "To stop RabbitMQ: docker stop rabbitmq-dev"
echo "To remove RabbitMQ: docker rm rabbitmq-dev"