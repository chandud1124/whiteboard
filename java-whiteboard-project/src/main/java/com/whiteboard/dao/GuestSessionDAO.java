package com.whiteboard.dao;

import com.whiteboard.model.GuestSession;
import com.whiteboard.util.DatabaseConnection;

import java.sql.*;
import java.util.Optional;

/**
 * Data Access Object for Guest Session operations.
 */
public class GuestSessionDAO {

    private static final String INSERT_SESSION =
            "INSERT INTO guest_sessions (session_id, session_data, expires_at) VALUES (?, ?, ?)";

    private static final String SELECT_SESSION =
            "SELECT id, session_id, session_data, created_at, expires_at, is_active " +
            "FROM guest_sessions WHERE session_id = ? AND is_active = TRUE";

    private static final String UPDATE_SESSION_DATA =
            "UPDATE guest_sessions SET session_data = ? WHERE session_id = ?";

    private static final String DEACTIVATE_SESSION =
            "UPDATE guest_sessions SET is_active = FALSE WHERE session_id = ?";

    private static final String CLEANUP_EXPIRED =
            "UPDATE guest_sessions SET is_active = FALSE WHERE expires_at < CURRENT_TIMESTAMP AND is_active = TRUE";

    /**
     * Create a new guest session
     */
    public long createGuestSession(GuestSession session) {
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;

        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(INSERT_SESSION, Statement.RETURN_GENERATED_KEYS);

            stmt.setString(1, session.getSessionId());
            stmt.setString(2, session.getSessionData());
            stmt.setTimestamp(3, session.getExpiresAt());

            int affected = stmt.executeUpdate();
            if (affected > 0) {
                rs = stmt.getGeneratedKeys();
                if (rs.next()) {
                    return rs.getLong(1);
                }
            }
        } catch (SQLException e) {
            System.err.println("Error creating guest session: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try { if (rs != null) rs.close(); } catch (SQLException e) {}
            try { if (stmt != null) stmt.close(); } catch (SQLException e) {}
            DatabaseConnection.closeConnection(conn);
        }
        return -1;
    }

    /**
     * Get guest session by session ID
     */
    public Optional<GuestSession> getGuestSession(String sessionId) {
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;

        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(SELECT_SESSION);
            stmt.setString(1, sessionId);

            rs = stmt.executeQuery();
            if (rs.next()) {
                GuestSession session = new GuestSession();
                session.setId(rs.getLong("id"));
                session.setSessionId(rs.getString("session_id"));
                session.setSessionData(rs.getString("session_data"));
                session.setCreatedAt(rs.getTimestamp("created_at"));
                session.setExpiresAt(rs.getTimestamp("expires_at"));
                session.setActive(rs.getBoolean("is_active"));

                // Check if expired
                if (!session.isExpired()) {
                    return Optional.of(session);
                }
            }
        } catch (SQLException e) {
            System.err.println("Error getting guest session: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try { if (rs != null) rs.close(); } catch (SQLException e) {}
            try { if (stmt != null) stmt.close(); } catch (SQLException e) {}
            DatabaseConnection.closeConnection(conn);
        }
        return Optional.empty();
    }

    /**
     * Update guest session data
     */
    public boolean updateSessionData(String sessionId, String sessionData) {
        Connection conn = null;
        PreparedStatement stmt = null;

        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(UPDATE_SESSION_DATA);

            stmt.setString(1, sessionData);
            stmt.setString(2, sessionId);

            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error updating guest session: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try { if (stmt != null) stmt.close(); } catch (SQLException e) {}
            DatabaseConnection.closeConnection(conn);
        }
        return false;
    }

    /**
     * Deactivate guest session
     */
    public boolean deactivateSession(String sessionId) {
        Connection conn = null;
        PreparedStatement stmt = null;

        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(DEACTIVATE_SESSION);
            stmt.setString(1, sessionId);

            return stmt.executeUpdate() > 0;
        } catch (SQLException e) {
            System.err.println("Error deactivating guest session: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try { if (stmt != null) stmt.close(); } catch (SQLException e) {}
            DatabaseConnection.closeConnection(conn);
        }
        return false;
    }

    /**
     * Cleanup expired sessions
     */
    public int cleanupExpiredSessions() {
        Connection conn = null;
        PreparedStatement stmt = null;

        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(CLEANUP_EXPIRED);

            return stmt.executeUpdate();
        } catch (SQLException e) {
            System.err.println("Error cleaning up expired sessions: " + e.getMessage());
            e.printStackTrace();
        } finally {
            try { if (stmt != null) stmt.close(); } catch (SQLException e) {}
            DatabaseConnection.closeConnection(conn);
        }
        return 0;
    }
}