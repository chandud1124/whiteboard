package com.whiteboard.dao;

import com.whiteboard.model.User;
import com.whiteboard.util.DatabaseConnection;

import java.sql.*;
import java.util.Optional;

/**
 * Data Access Object for User.
 * Handles all database operations for users using JDBC.
 */
public class UserDAO {
    
    private static final String INSERT_USER = 
        "INSERT INTO users (username, email, password_hash, display_name) " +
        "VALUES (?, ?, ?, ?)";
    
    private static final String SELECT_USER_BY_USERNAME = 
        "SELECT id, username, email, password_hash, display_name, created_at, updated_at, is_active, last_login " +
        "FROM users WHERE username = ?";
    
    private static final String SELECT_USER_BY_EMAIL = 
        "SELECT id, username, email, password_hash, display_name, created_at, updated_at, is_active, last_login " +
        "FROM users WHERE email = ?";
    
    private static final String SELECT_USER_BY_ID = 
        "SELECT id, username, email, password_hash, display_name, created_at, updated_at, is_active, last_login " +
        "FROM users WHERE id = ?";
    
    private static final String UPDATE_LAST_LOGIN = 
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?";
    
    private static final String UPDATE_USER = 
        "UPDATE users SET display_name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
    
    private static final String CHECK_USERNAME_EXISTS = 
        "SELECT 1 FROM users WHERE username = ?";
    
    private static final String CHECK_EMAIL_EXISTS = 
        "SELECT 1 FROM users WHERE email = ?";
    
    /**
     * Register a new user
     * @param user The user to register
     * @return The generated user ID, or -1 if failed
     */
    public long registerUser(User user) {
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;
        
        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(INSERT_USER, Statement.RETURN_GENERATED_KEYS);
            
            stmt.setString(1, user.getUsername());
            stmt.setString(2, user.getEmail());
            stmt.setString(3, user.getPasswordHash());
            stmt.setString(4, user.getDisplayName());
            
            int affectedRows = stmt.executeUpdate();
            
            if (affectedRows > 0) {
                rs = stmt.getGeneratedKeys();
                if (rs.next()) {
                    long userId = rs.getLong(1);
                    System.out.println("User registered successfully: " + user.getUsername() + " (ID: " + userId + ")");
                    return userId;
                }
            }
            System.err.println("Registration failed: No rows affected");
            return -1;
        } catch (SQLException e) {
            System.err.println("Error registering user: " + e.getMessage());
            e.printStackTrace();
            return -1;
        } finally {
            closeResources(rs, stmt, conn);
        }
    }
    
    /**
     * Find user by username
     * @param username The username to search for
     * @return Optional containing the user if found
     */
    public Optional<User> findByUsername(String username) {
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;
        
        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(SELECT_USER_BY_USERNAME);
            stmt.setString(1, username);
            rs = stmt.executeQuery();
            
            if (rs.next()) {
                User user = mapResultSetToUser(rs);
                System.out.println("User found: " + username);
                return Optional.of(user);
            }
        } catch (SQLException e) {
            System.err.println("Error finding user by username: " + e.getMessage());
        } finally {
            closeResources(rs, stmt, conn);
        }
        
        return Optional.empty();
    }
    
    /**
     * Find user by email
     * @param email The email to search for
     * @return Optional containing the user if found
     */
    public Optional<User> findByEmail(String email) {
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;
        
        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(SELECT_USER_BY_EMAIL);
            stmt.setString(1, email);
            rs = stmt.executeQuery();
            
            if (rs.next()) {
                User user = mapResultSetToUser(rs);
                return Optional.of(user);
            }
        } catch (SQLException e) {
            System.err.println("Error finding user by email: " + e.getMessage());
        } finally {
            closeResources(rs, stmt, conn);
        }
        
        return Optional.empty();
    }
    
    /**
     * Find user by ID
     * @param userId The user ID to search for
     * @return Optional containing the user if found
     */
    public Optional<User> findById(Long userId) {
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;
        
        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(SELECT_USER_BY_ID);
            stmt.setLong(1, userId);
            rs = stmt.executeQuery();
            
            if (rs.next()) {
                User user = mapResultSetToUser(rs);
                return Optional.of(user);
            }
        } catch (SQLException e) {
            System.err.println("Error finding user by ID: " + e.getMessage());
        } finally {
            closeResources(rs, stmt, conn);
        }
        
        return Optional.empty();
    }
    
    /**
     * Check if username already exists
     * @param username The username to check
     * @return true if username exists, false otherwise
     */
    public boolean usernameExists(String username) {
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;
        
        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(CHECK_USERNAME_EXISTS);
            stmt.setString(1, username);
            rs = stmt.executeQuery();
            
            return rs.next();
        } catch (SQLException e) {
            System.err.println("Error checking username existence: " + e.getMessage());
            e.printStackTrace();
            // On database error, allow registration to proceed (fail-open for user experience)
            return false;
        } finally {
            closeResources(rs, stmt, conn);
        }
    }
    
    /**
     * Check if email already exists
     * @param email The email to check
     * @return true if email exists, false otherwise
     */
    public boolean emailExists(String email) {
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;
        
        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(CHECK_EMAIL_EXISTS);
            stmt.setString(1, email);
            rs = stmt.executeQuery();
            
            return rs.next();
        } catch (SQLException e) {
            System.err.println("Error checking email existence: " + e.getMessage());
            e.printStackTrace();
            // On database error, allow registration to proceed (fail-open for user experience)
            return false;
        } finally {
            closeResources(rs, stmt, conn);
        }
    }
    
    /**
     * Update user last login timestamp
     * @param userId The user ID
     * @return true if successful
     */
    public boolean updateLastLogin(Long userId) {
        Connection conn = null;
        PreparedStatement stmt = null;
        
        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(UPDATE_LAST_LOGIN);
            stmt.setLong(1, userId);
            stmt.executeUpdate();
            return true;
        } catch (SQLException e) {
            System.err.println("Error updating last login: " + e.getMessage());
            return false;
        } finally {
            closeResources(null, stmt, conn);
        }
    }
    
    /**
     * Update user profile
     * @param user The user with updated information
     * @return true if successful
     */
    public boolean updateUser(User user) {
        Connection conn = null;
        PreparedStatement stmt = null;
        
        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(UPDATE_USER);
            stmt.setString(1, user.getDisplayName());
            stmt.setString(2, user.getEmail());
            stmt.setLong(3, user.getId());
            
            int affectedRows = stmt.executeUpdate();
            return affectedRows > 0;
        } catch (SQLException e) {
            System.err.println("Error updating user: " + e.getMessage());
            return false;
        } finally {
            closeResources(null, stmt, conn);
        }
    }
    
    /**
     * Map a ResultSet row to a User object
     */
    private User mapResultSetToUser(ResultSet rs) throws SQLException {
        User user = new User();
        user.setId(rs.getLong("id"));
        user.setUsername(rs.getString("username"));
        user.setEmail(rs.getString("email"));
        user.setPasswordHash(rs.getString("password_hash"));
        user.setDisplayName(rs.getString("display_name"));
        user.setCreatedAt(rs.getTimestamp("created_at"));
        user.setUpdatedAt(rs.getTimestamp("updated_at"));
        user.setActive(rs.getBoolean("is_active"));
        user.setLastLogin(rs.getTimestamp("last_login"));
        return user;
    }
    
    /**
     * Close database resources safely
     */
    private void closeResources(ResultSet rs, PreparedStatement stmt, Connection conn) {
        if (rs != null) {
            try {
                rs.close();
            } catch (SQLException e) {
                System.err.println("Error closing ResultSet: " + e.getMessage());
            }
        }
        if (stmt != null) {
            try {
                stmt.close();
            } catch (SQLException e) {
                System.err.println("Error closing Statement: " + e.getMessage());
            }
        }
        DatabaseConnection.closeConnection(conn);
    }
}
