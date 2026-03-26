#!/bin/bash

# Check if .env file already exists
if [ -f ".env" ]; then
    echo ".env file already exists. Skipping initialization."
    exit 0
fi

# Check if .env.example exists
if [ ! -f ".env.example" ]; then
    echo ".env.example file not found. Cannot initialize .env."
    exit 1
fi

# Copy .env.example to .env
cp .env.example .env
echo ".env file initialized from .env.example"