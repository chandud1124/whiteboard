package com.whiteboard.dao;

import com.whiteboard.model.DrawingEvent;
import com.whiteboard.util.DatabaseConnection;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

/**
 * Data Access Object for DrawingEvent.
 * Handles all database operations for drawing events using JDBC.
 */
public class DrawingEventDAO {
    
    private static final String INSERT_EVENT = 
        "INSERT INTO drawing_events (session_id, x1, y1, x2, y2, color, tool, stroke_width) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    
    private static final String SELECT_ALL_EVENTS = 
        "SELECT id, session_id, x1, y1, x2, y2, color, tool, stroke_width, timestamp " +
        "FROM drawing_events ORDER BY timestamp ASC";
    
    private static final String SELECT_RECENT_EVENTS = 
        "SELECT id, session_id, x1, y1, x2, y2, color, tool, stroke_width, timestamp " +
        "FROM drawing_events ORDER BY timestamp DESC LIMIT ?";
    
    private static final String DELETE_ALL_EVENTS = 
        "DELETE FROM drawing_events";
    
    private static final String DELETE_OLD_EVENTS = 
        "DELETE FROM drawing_events WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? HOUR)";
    
    /**
     * Save a drawing event to the database
     * @param event The DrawingEvent to save
     * @return The generated ID of the saved event, or -1 if failed
     */
    public long saveEvent(DrawingEvent event) {
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;
        
        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(INSERT_EVENT, Statement.RETURN_GENERATED_KEYS);
            
            stmt.setString(1, event.getSessionId());
            stmt.setInt(2, event.getX1());
            stmt.setInt(3, event.getY1());
            stmt.setInt(4, event.getX2());
            stmt.setInt(5, event.getY2());
            stmt.setString(6, event.getColor());
            stmt.setString(7, event.getTool());
            stmt.setInt(8, event.getStrokeWidth());
            
            int affectedRows = stmt.executeUpdate();
            
            if (affectedRows > 0) {
                rs = stmt.getGeneratedKeys();
                if (rs.next()) {
                    return rs.getLong(1);
                }
            }
        } catch (SQLException e) {
            System.err.println("Error saving drawing event: " + e.getMessage());
        } finally {
            closeResources(rs, stmt, conn);
        }
        
        return -1;
    }
    
    /**
     * Batch save multiple drawing events (more efficient for many events)
     * @param events List of DrawingEvents to save
     * @return Number of events successfully saved
     */
    public int saveEventsBatch(List<DrawingEvent> events) {
        Connection conn = null;
        PreparedStatement stmt = null;
        
        try {
            conn = DatabaseConnection.getConnection();
            conn.setAutoCommit(false);
            stmt = conn.prepareStatement(INSERT_EVENT);
            
            for (DrawingEvent event : events) {
                stmt.setString(1, event.getSessionId());
                stmt.setInt(2, event.getX1());
                stmt.setInt(3, event.getY1());
                stmt.setInt(4, event.getX2());
                stmt.setInt(5, event.getY2());
                stmt.setString(6, event.getColor());
                stmt.setString(7, event.getTool());
                stmt.setInt(8, event.getStrokeWidth());
                stmt.addBatch();
            }
            
            int[] results = stmt.executeBatch();
            conn.commit();
            
            int successCount = 0;
            for (int result : results) {
                if (result > 0 || result == Statement.SUCCESS_NO_INFO) {
                    successCount++;
                }
            }
            return successCount;
            
        } catch (SQLException e) {
            System.err.println("Error in batch save: " + e.getMessage());
            try {
                if (conn != null) conn.rollback();
            } catch (SQLException ex) {
                System.err.println("Error rolling back: " + ex.getMessage());
            }
        } finally {
            try {
                if (conn != null) conn.setAutoCommit(true);
            } catch (SQLException e) {
                System.err.println("Error resetting auto-commit: " + e.getMessage());
            }
            closeResources(null, stmt, conn);
        }
        
        return 0;
    }
    
    /**
     * Get all drawing events from the database
     * @return List of all DrawingEvents
     */
    public List<DrawingEvent> getAllEvents() {
        List<DrawingEvent> events = new ArrayList<>();
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;
        
        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(SELECT_ALL_EVENTS);
            rs = stmt.executeQuery();
            
            while (rs.next()) {
                events.add(mapResultSetToEvent(rs));
            }
        } catch (SQLException e) {
            System.err.println("Error fetching all events: " + e.getMessage());
        } finally {
            closeResources(rs, stmt, conn);
        }
        
        return events;
    }
    
    /**
     * Get recent drawing events
     * @param limit Maximum number of events to return
     * @return List of recent DrawingEvents
     */
    public List<DrawingEvent> getRecentEvents(int limit) {
        List<DrawingEvent> events = new ArrayList<>();
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;
        
        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(SELECT_RECENT_EVENTS);
            stmt.setInt(1, limit);
            rs = stmt.executeQuery();
            
            while (rs.next()) {
                events.add(mapResultSetToEvent(rs));
            }
        } catch (SQLException e) {
            System.err.println("Error fetching recent events: " + e.getMessage());
        } finally {
            closeResources(rs, stmt, conn);
        }
        
        return events;
    }
    
    /**
     * Clear all drawing events (clear canvas in database)
     * @return true if successful
     */
    public boolean clearAllEvents() {
        Connection conn = null;
        PreparedStatement stmt = null;
        
        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(DELETE_ALL_EVENTS);
            stmt.executeUpdate();
            return true;
        } catch (SQLException e) {
            System.err.println("Error clearing events: " + e.getMessage());
            return false;
        } finally {
            closeResources(null, stmt, conn);
        }
    }
    
    /**
     * Delete old events to prevent database bloat
     * @param hoursOld Delete events older than this many hours
     * @return Number of events deleted
     */
    public int deleteOldEvents(int hoursOld) {
        Connection conn = null;
        PreparedStatement stmt = null;
        
        try {
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(DELETE_OLD_EVENTS);
            stmt.setInt(1, hoursOld);
            return stmt.executeUpdate();
        } catch (SQLException e) {
            System.err.println("Error deleting old events: " + e.getMessage());
            return 0;
        } finally {
            closeResources(null, stmt, conn);
        }
    }
    
    /**
     * Map a ResultSet row to a DrawingEvent object
     */
    private DrawingEvent mapResultSetToEvent(ResultSet rs) throws SQLException {
        DrawingEvent event = new DrawingEvent();
        event.setId(rs.getLong("id"));
        event.setSessionId(rs.getString("session_id"));
        event.setX1(rs.getInt("x1"));
        event.setY1(rs.getInt("y1"));
        event.setX2(rs.getInt("x2"));
        event.setY2(rs.getInt("y2"));
        event.setColor(rs.getString("color"));
        event.setTool(rs.getString("tool"));
        event.setStrokeWidth(rs.getInt("stroke_width"));
        event.setTimestamp(rs.getTimestamp("timestamp"));
        return event;
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
