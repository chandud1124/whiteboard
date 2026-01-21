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
    private static final Object COLUMN_LOCK = new Object();
    private static volatile boolean boardColumnChecked = false;
    
    private static final String INSERT_EVENT =
        "INSERT INTO drawing_events (board_id, session_id, room_code, username, x1, y1, x2, y2, color, tool, stroke_width, line_style) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    private static final String SELECT_ALL_EVENTS =
        "SELECT id, board_id, session_id, room_code, username, x1, y1, x2, y2, color, tool, stroke_width, line_style, timestamp " +
        "FROM drawing_events ORDER BY timestamp ASC";

    private static final String SELECT_RECENT_EVENTS =
        "SELECT id, board_id, session_id, room_code, username, x1, y1, x2, y2, color, tool, stroke_width, line_style, timestamp " +
        "FROM drawing_events ORDER BY timestamp DESC LIMIT ?";

    private static final String SELECT_EVENTS_BY_ROOM =
        "SELECT id, board_id, session_id, room_code, username, x1, y1, x2, y2, color, tool, stroke_width, line_style, timestamp " +
        "FROM drawing_events WHERE room_code = ? ORDER BY timestamp ASC";

    private static final String SELECT_EVENTS_BY_BOARD =
        "SELECT id, board_id, session_id, room_code, username, x1, y1, x2, y2, color, tool, stroke_width, line_style, timestamp " +
        "FROM drawing_events WHERE board_id = ? ORDER BY timestamp ASC";

    private static final String DELETE_ALL_EVENTS =
        "DELETE FROM drawing_events";

    private static final String DELETE_EVENTS_BY_BOARD =
        "DELETE FROM drawing_events WHERE board_id = ?";

    private static final String DELETE_EVENTS_BY_ROOM =
        "DELETE FROM drawing_events WHERE room_code = ?";

    private static final String DELETE_OLD_EVENTS =
        "DELETE FROM drawing_events WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? HOUR)";

    static {
        ensureBoardIdColumn();
    }
    
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
            ensureBoardIdColumn();
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(INSERT_EVENT, Statement.RETURN_GENERATED_KEYS);
            
            if (event.getBoardId() != null) {
                stmt.setLong(1, event.getBoardId());
            } else {
                stmt.setNull(1, Types.BIGINT);
            }
            stmt.setString(2, event.getSessionId());
            stmt.setString(3, event.getRoomCode());
            stmt.setString(4, event.getUsername());
            stmt.setInt(5, event.getX1());
            stmt.setInt(6, event.getY1());
            stmt.setInt(7, event.getX2());
            stmt.setInt(8, event.getY2());
            stmt.setString(9, event.getColor());
            stmt.setString(10, event.getTool());
            stmt.setInt(11, event.getStrokeWidth());
            stmt.setString(12, event.getLineStyle());
            
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
        if (events == null || events.isEmpty()) {
            return 0;
        }

        Connection conn = null;
        PreparedStatement stmt = null;
        
        try {
            ensureBoardIdColumn();
            conn = DatabaseConnection.getConnection();
            conn.setAutoCommit(false);
            stmt = conn.prepareStatement(INSERT_EVENT);
            
            for (DrawingEvent event : events) {
                if (event.getBoardId() != null) {
                    stmt.setLong(1, event.getBoardId());
                } else {
                    stmt.setNull(1, Types.BIGINT);
                }
                stmt.setString(2, event.getSessionId());
                stmt.setString(3, event.getRoomCode());
                stmt.setString(4, event.getUsername());
                stmt.setInt(5, event.getX1());
                stmt.setInt(6, event.getY1());
                stmt.setInt(7, event.getX2());
                stmt.setInt(8, event.getY2());
                stmt.setString(9, event.getColor());
                stmt.setString(10, event.getTool());
                stmt.setInt(11, event.getStrokeWidth());
                stmt.setString(12, event.getLineStyle());
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
            ensureBoardIdColumn();
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
     * Get drawing events for a specific room
     * @param roomCode The room code to filter events by
     * @return List of DrawingEvents for the room
     */
    public List<DrawingEvent> getEventsByRoom(String roomCode) {
        List<DrawingEvent> events = new ArrayList<>();
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;
        
        try {
            ensureBoardIdColumn();
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(SELECT_EVENTS_BY_ROOM);
            stmt.setString(1, roomCode);
            rs = stmt.executeQuery();
            
            while (rs.next()) {
                events.add(mapResultSetToEvent(rs));
            }
        } catch (SQLException e) {
            System.err.println("Error fetching events for room " + roomCode + ": " + e.getMessage());
        } finally {
            closeResources(rs, stmt, conn);
        }
        
        return events;
    }

    /**
     * Get drawing events for a specific board
     */
    public List<DrawingEvent> getEventsByBoard(long boardId) {
        List<DrawingEvent> events = new ArrayList<>();
        Connection conn = null;
        PreparedStatement stmt = null;
        ResultSet rs = null;

        try {
            ensureBoardIdColumn();
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(SELECT_EVENTS_BY_BOARD);
            stmt.setLong(1, boardId);
            rs = stmt.executeQuery();

            while (rs.next()) {
                events.add(mapResultSetToEvent(rs));
            }
        } catch (SQLException e) {
            System.err.println("Error fetching events for board " + boardId + ": " + e.getMessage());
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
            ensureBoardIdColumn();
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
            ensureBoardIdColumn();
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

    public boolean clearEventsForBoard(long boardId) {
        Connection conn = null;
        PreparedStatement stmt = null;

        try {
            ensureBoardIdColumn();
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(DELETE_EVENTS_BY_BOARD);
            stmt.setLong(1, boardId);
            stmt.executeUpdate();
            return true;
        } catch (SQLException e) {
            System.err.println("Error clearing events for board " + boardId + ": " + e.getMessage());
            return false;
        } finally {
            closeResources(null, stmt, conn);
        }
    }

    public boolean clearEventsForRoom(String roomCode) {
        Connection conn = null;
        PreparedStatement stmt = null;

        try {
            ensureBoardIdColumn();
            conn = DatabaseConnection.getConnection();
            stmt = conn.prepareStatement(DELETE_EVENTS_BY_ROOM);
            stmt.setString(1, roomCode);
            stmt.executeUpdate();
            return true;
        } catch (SQLException e) {
            System.err.println("Error clearing events for room " + roomCode + ": " + e.getMessage());
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
            ensureBoardIdColumn();
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
        long boardId = rs.getLong("board_id");
        if (!rs.wasNull()) {
            event.setBoardId(boardId);
        }
        event.setSessionId(rs.getString("session_id"));
        event.setRoomCode(rs.getString("room_code"));
        event.setUsername(rs.getString("username"));
        event.setX1(rs.getInt("x1"));
        event.setY1(rs.getInt("y1"));
        event.setX2(rs.getInt("x2"));
        event.setY2(rs.getInt("y2"));
        event.setColor(rs.getString("color"));
        event.setTool(rs.getString("tool"));
        event.setStrokeWidth(rs.getInt("stroke_width"));
        event.setLineStyle(rs.getString("line_style"));
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

    private static void ensureBoardIdColumn() {
        if (boardColumnChecked) {
            return;
        }

        synchronized (COLUMN_LOCK) {
            if (boardColumnChecked) {
                return;
            }

            try (Connection conn = DatabaseConnection.getConnection()) {
                if (conn == null) {
                    return;
                }

                if (hasColumn(conn, "drawing_events", "board_id")) {
                    boardColumnChecked = true;
                    return;
                }

                try (Statement stmt = conn.createStatement()) {
                    stmt.executeUpdate("ALTER TABLE drawing_events ADD COLUMN board_id BIGINT NULL AFTER id");
                    try {
                        stmt.executeUpdate("CREATE INDEX idx_board_id ON drawing_events (board_id)");
                    } catch (SQLException indexEx) {
                        // Ignore if index already exists
                        if (!indexEx.getMessage().toLowerCase().contains("duplicate")) {
                            System.err.println("Error creating idx_board_id index: " + indexEx.getMessage());
                        }
                    }
                }

                boardColumnChecked = true;
                System.out.println("Added missing board_id column to drawing_events");
            } catch (SQLException e) {
                System.err.println("Error ensuring drawing_events.board_id column: " + e.getMessage());
            }
        }
    }

    private static boolean hasColumn(Connection conn, String tableName, String columnName) throws SQLException {
        DatabaseMetaData metaData = conn.getMetaData();
        String catalog = conn.getCatalog();

        try (ResultSet rs = metaData.getColumns(catalog, null, tableName, columnName)) {
            if (rs.next()) {
                return true;
            }
        }

        try (ResultSet rs = metaData.getColumns(catalog, null, tableName.toUpperCase(), columnName.toUpperCase())) {
            if (rs.next()) {
                return true;
            }
        }

        try (ResultSet rs = metaData.getColumns(catalog, null, tableName.toLowerCase(), columnName.toLowerCase())) {
            return rs.next();
        }
    }
}
