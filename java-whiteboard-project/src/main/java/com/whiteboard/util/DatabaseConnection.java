package com.whiteboard.util;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * Database connection utility class using JDBC.
 * Manages MySQL connections for the whiteboard application.
 */
public class DatabaseConnection {
    
    // Database configuration - UPDATE THESE VALUES
    private static final String DB_URL = "jdbc:mysql://localhost:3306/whiteboard_db";
    private static final String DB_USER = "root";
    private static final String DB_PASSWORD = ""; // No password for local development
    
    // Connection pool settings
    private static final String DRIVER_CLASS = "com.mysql.cj.jdbc.Driver";
    
    // Static block to load the JDBC driver
    static {
        try {
            Class.forName(DRIVER_CLASS);
            System.out.println("MySQL JDBC Driver loaded successfully");
        } catch (ClassNotFoundException e) {
            System.err.println("MySQL JDBC Driver not found!");
            System.err.println("Make sure mysql-connector-java-8.x.x.jar is in the classpath");
            e.printStackTrace();
        }
    }
    
    /**
     * Get a connection to the MySQL database
     * @return Connection object
     * @throws SQLException if connection fails
     */
    public static Connection getConnection() throws SQLException {
        try {
            Connection connection = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
            System.out.println("Database connection established");
            return connection;
        } catch (SQLException e) {
            System.err.println("Failed to connect to database: " + e.getMessage());
            throw e;
        }
    }
    
    /**
     * Close a database connection safely
     * @param connection The connection to close
     */
    public static void closeConnection(Connection connection) {
        if (connection != null) {
            try {
                connection.close();
                System.out.println("Database connection closed");
            } catch (SQLException e) {
                System.err.println("Error closing connection: " + e.getMessage());
            }
        }
    }
    
    /**
     * Test the database connection
     * @return true if connection successful, false otherwise
     */
    public static boolean testConnection() {
        try (Connection conn = getConnection()) {
            return conn != null && !conn.isClosed();
        } catch (SQLException e) {
            System.err.println("Connection test failed: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Get database URL (for logging/debugging)
     */
    public static String getDbUrl() {
        return DB_URL;
    }
}
