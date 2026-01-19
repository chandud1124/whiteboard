-- Insert test users for login (with properly hashed passwords)
INSERT INTO users (username, email, password_hash, display_name, is_active)
VALUES ('demo', 'demo@example.com', 'fqGC7hx5jZgVgr3M9wdI3Q==:hv0IZ0Hib7vz1hIW78KdTLjNse26kltSfxFtk/lYVfs=', 'Demo User', TRUE);

INSERT INTO users (username, email, password_hash, display_name, is_active)
VALUES ('john', 'john@example.com', '0kVhfnKITej6iYC6DfmZGw==:uaCh+GvLw6GDTcQnDnTErfFgc9Z0LkavkzMVCib+jb4=', 'John Doe', TRUE);

INSERT INTO users (username, email, password_hash, display_name, is_active)
VALUES ('alice', 'alice@example.com', 'L+MeVsqgBIqmQTKnCboP0g==:0Kjo/xqQgDAHx5YB90y7Nij0nqepxaZJmMh5Cz0kNHU=', 'Alice Smith', TRUE);

-- Display created users
SELECT id, username, email, display_name, is_active FROM users;
