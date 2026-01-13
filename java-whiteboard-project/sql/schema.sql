-- Real-Time Collaborative Whiteboard Database Schema
-- Run this script in MySQL to set up the database

-- Create database
CREATE DATABASE IF NOT EXISTS whiteboard_db;
USE whiteboard_db;

-- Create drawing_events table
CREATE TABLE IF NOT EXISTS drawing_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    x1 INT NOT NULL,
    y1 INT NOT NULL,
    x2 INT NOT NULL,
    y2 INT NOT NULL,
    color VARCHAR(20) DEFAULT '#000000',
    tool VARCHAR(20) DEFAULT 'pen',
    stroke_width INT DEFAULT 3,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session (session_id),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create users table (for authentication and user management)
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create sessions table (for tracking active users and WebSocket sessions)
CREATE TABLE IF NOT EXISTS whiteboard_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    user_id BIGINT,
    username VARCHAR(100),
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    disconnected_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    room_id VARCHAR(100),
    INDEX idx_active (is_active),
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create user sessions table (for authentication tokens)
CREATE TABLE IF NOT EXISTS user_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_valid BOOLEAN DEFAULT TRUE,
    INDEX idx_user_id (user_id),
    INDEX idx_token (token),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create user activity log table (optional - for audit trail)
CREATE TABLE IF NOT EXISTS user_activity (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT,
    activity_type VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create user for the application (optional - for security)
-- CREATE USER 'whiteboard_user'@'localhost' IDENTIFIED BY 'your_secure_password';
-- GRANT ALL PRIVILEGES ON whiteboard_db.* TO 'whiteboard_user'@'localhost';
-- FLUSH PRIVILEGES;

-- Verify tables created
SHOW TABLES;
DESCRIBE users;
DESCRIBE drawing_events;
DESCRIBE whiteboard_sessions;
DESCRIBE user_tokens;
