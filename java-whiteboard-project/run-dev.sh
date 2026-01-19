#!/bin/bash

# Development run script for Whiteboard Project
echo "Starting Whiteboard Project in Development Mode..."
echo "=========================================="

# Check if MySQL is running
if ! pgrep -x "mysqld" > /dev/null; then
    echo "Warning: MySQL doesn't appear to be running. Please start MySQL first."
    echo "On macOS: brew services start mysql"
fi

# Run with Maven Tomcat plugin
cd "$(dirname "$0")"
mvn org.apache.tomcat.maven:tomcat7-maven-plugin:2.2:run

echo "Whiteboard running at: http://localhost:8082/whiteboard/"