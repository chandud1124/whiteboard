-- Insert test users for login
INSERT INTO users (username, email, password_hash, display_name, is_active) 
VALUES ('demo', 'demo@example.com', 'demo123', 'Demo User', TRUE);

INSERT INTO users (username, email, password_hash, display_name, is_active) 
VALUES ('john', 'john@example.com', 'password123', 'John Doe', TRUE);

INSERT INTO users (username, email, password_hash, display_name, is_active) 
VALUES ('alice', 'alice@example.com', 'alice456', 'Alice Smith', TRUE);

-- Display created users
SELECT id, username, email, display_name, is_active FROM users;
