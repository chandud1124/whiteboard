/**
 * Real-Time Collaborative Whiteboard
 * Frontend JavaScript using Vanilla JS and WebSocket
 * With Room-based sharing and approval system
 */

(function() {
    'use strict';

    // ========================================
    // Configuration
    // ========================================
    const CONFIG = {
        WS_URL: 'ws://localhost:5173/whiteboard/whiteboard',
        RECONNECT_DELAY: 3000,
        MAX_RECONNECT_ATTEMPTS: 5,
        PING_INTERVAL: 30000
    };

    // ========================================
    // State Management
    // ========================================
    const state = {
        // WebSocket
        socket: null,
        isConnected: false,
        reconnectAttempts: 0,
        pingInterval: null,
        sessionId: null,
        
        // Room
        roomCode: null,
        isRoomOwner: false,
        isInRoom: false,
        isApproved: false,
        pendingRequests: [], // For room owner
        currentRequest: null, // Current request being shown
        
        // Canvas
        canvas: null,
        ctx: null,
        isDrawing: false,
        lastX: 0,
        lastY: 0,
        
        // Tools
        currentTool: 'pen',
        currentColor: '#000000',
        strokeWidth: 3,
        lineStyle: 'solid', // solid, dashed, dotted
        
        // Canvas state
        zoom: 1,
        panX: 0,
        panY: 0,
        showGrid: false,
        gridSize: 20,
        snapToGrid: false,
        
        // Drawing state for shapes
        shapeStart: null,
        shapeConstraint: false, // Shift key held
        shapePreviewActive: false,
        shapePreviewData: null, // Canvas data before shape preview
        
        // Undo/Redo
        history: [],
        historyIndex: -1,
        maxHistorySize: 50,
        
        // Selection
        selectedElements: [],
        isSelecting: false,
        selectionStart: null,
        
        // Mini-map
        showMinimap: true,
        
        // Authentication
        isLoggedIn: false,
        currentUser: null,
        userId: null,
        username: null,
        token: null,
        
        // History
        isReceivingHistory: false,
        
        // Collaboration - Live cursors
        userCursors: {},
        
        // Chat
        chatMessages: [],
        lastMouseX: 0,
        lastMouseY: 0,
        cursorSendTimer: null,
        cursorColors: [
            '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
            '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
        ]
    };

    // ========================================
    // DOM Elements
    // ========================================
    const elements = {
        canvas: document.getElementById('whiteboard'),
        canvasContainer: document.getElementById('canvasContainer'),
        canvasOverlay: document.getElementById('canvasOverlay'),
        connectionStatus: document.getElementById('connectionStatus'),
        userCount: document.getElementById('userCount'),
        sessionId: document.getElementById('sessionId'),
        
        // Drawing tools
        penTool: document.getElementById('penTool'),
        lineTool: document.getElementById('lineTool'),
        rectangleTool: document.getElementById('rectangleTool'),
        circleTool: document.getElementById('circleTool'),
        arrowTool: document.getElementById('arrowTool'),
        highlighterTool: document.getElementById('highlighterTool'),
        textTool: document.getElementById('textTool'),
        eraserTool: document.getElementById('eraserTool'),
        
        // Style controls
        lineStyle: document.getElementById('lineStyle'),
        colorPicker: document.getElementById('colorPicker'),
        strokeWidth: document.getElementById('strokeWidth'),
        strokeValue: document.getElementById('strokeValue'),
        presetColors: document.querySelectorAll('.color-preset-compact'),
        moreOptionsBtn: document.getElementById('moreOptionsBtn'),
        toolbarSecondary: document.getElementById('toolbarSecondary'),
        
        // Canvas controls
        gridToggle: document.getElementById('gridToggle'),
        snapToggle: document.getElementById('snapToggle'),
        minimapToggle: document.getElementById('minimapToggle'),
        
        // Zoom controls
        zoomIn: document.getElementById('zoomIn'),
        zoomOut: document.getElementById('zoomOut'),
        zoomReset: document.getElementById('zoomReset'),
        zoomLevel: document.getElementById('zoomLevel'),
        
        // Edit controls
        undoBtn: document.getElementById('undoBtn'),
        redoBtn: document.getElementById('redoBtn'),
        
        // Actions
        clearCanvas: document.getElementById('clearCanvas'),
        downloadCanvas: document.getElementById('downloadCanvas'),
        downloadPDF: document.getElementById('downloadPDF'),
        notifications: document.getElementById('notifications'),
        
        // Room elements
        roomBadge: document.getElementById('roomBadge'),
        roomCodeDisplay: document.getElementById('roomCodeDisplay'),
        copyRoomCode: document.getElementById('copyRoomCode'),
        pendingRequests: document.getElementById('pendingRequests'),
        createRoomBtn: document.getElementById('createRoomBtn'),
        joinRoomBtn: document.getElementById('joinRoomBtn'),
        leaveRoomBtn: document.getElementById('leaveRoomBtn'),
        shareRoomBtn: document.getElementById('shareRoomBtn'),
        
        // Modals
        joinModal: document.getElementById('joinModal'),
        joinRoomCode: document.getElementById('joinRoomCode'),
        joinUsername: document.getElementById('joinUsername'),
        closeJoinModal: document.getElementById('closeJoinModal'),
        cancelJoin: document.getElementById('cancelJoin'),
        confirmJoin: document.getElementById('confirmJoin'),
        
        waitingModal: document.getElementById('waitingModal'),
        waitingRoomCode: document.getElementById('waitingRoomCode'),
        cancelWaiting: document.getElementById('cancelWaiting'),
        
        shareModal: document.getElementById('shareModal'),
        shareCodeDisplay: document.getElementById('shareCodeDisplay'),
        closeShareModal: document.getElementById('closeShareModal'),
        copyShareCode: document.getElementById('copyShareCode'),
        copyShareLink: document.getElementById('copyShareLink'),
        closeShareBtn: document.getElementById('closeShareBtn'),
        
        requestModal: document.getElementById('requestModal'),
        requestUsername: document.getElementById('requestUsername'),
        rejectRequest: document.getElementById('rejectRequest'),
        approveRequest: document.getElementById('approveRequest'),
        
        // Authentication elements
        authButtons: document.getElementById('authButtons'),
        loginBtn: document.getElementById('loginBtn'),
        registerBtn: document.getElementById('registerBtn'),
        userInfo: document.getElementById('userInfo'),
        userDisplayName: document.getElementById('userDisplayName'),
        logoutBtn: document.getElementById('logoutBtn'),
        
        // Login modal
        loginModal: document.getElementById('loginModal'),
        loginUsername: document.getElementById('loginUsername'),
        loginPassword: document.getElementById('loginPassword'),
        closeLoginModal: document.getElementById('closeLoginModal'),
        cancelLogin: document.getElementById('cancelLogin'),
        confirmLogin: document.getElementById('confirmLogin'),
        loginMessage: document.getElementById('loginMessage'),
        switchToRegister: document.getElementById('switchToRegister'),
        
        // Register modal
        registerModal: document.getElementById('registerModal'),
        registerUsername: document.getElementById('registerUsername'),
        registerEmail: document.getElementById('registerEmail'),
        registerPassword: document.getElementById('registerPassword'),
        registerPassword2: document.getElementById('registerPassword2'),
        closeRegisterModal: document.getElementById('closeRegisterModal'),
        cancelRegister: document.getElementById('cancelRegister'),
        confirmRegister: document.getElementById('confirmRegister'),
        registerMessage: document.getElementById('registerMessage'),
        
        // Chat elements
        chatPanel: document.getElementById('chatPanel'),
        chatMessages: document.getElementById('chatMessages'),
        chatInput: document.getElementById('chatInput'),
        sendChatBtn: document.getElementById('sendChatBtn'),
        chatToggle: document.getElementById('chatToggle'),
        closeChatBtn: document.getElementById('closeChatBtn'),
        userCursorsContainer: document.getElementById('userCursorsContainer'),
        switchToLogin: document.getElementById('switchToLogin')
    };

    // ========================================
    // Initialization
    // ========================================
    function restoreAuthState() {
        const userId = localStorage.getItem('whiteboard_userId');
        const username = localStorage.getItem('whiteboard_username');
        const token = localStorage.getItem('whiteboard_token');
        
        if (userId && username && token) {
            state.isLoggedIn = true;
            state.userId = parseInt(userId);
            state.username = username;
            state.token = token;
            state.currentUser = {
                id: parseInt(userId),
                username: username
            };
            
            updateAuthUI();
        }
    }

    function init() {
        restoreAuthState();
        initCanvas();
        initEventListeners();
        initAuthListeners();
        initRoomListeners();
        connectWebSocket();
        checkUrlForRoomCode();
        
        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);
    }

    function initCanvas() {
        state.canvas = elements.canvas;
        // Hint frequent readbacks to avoid performance warnings
        state.ctx = state.canvas.getContext('2d', { willReadFrequently: true });
        
        // Set canvas size
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Initial canvas setup
        state.ctx.lineCap = 'round';
        state.ctx.lineJoin = 'round';
    }

    function resizeCanvas() {
        // Infinite canvas - very large fixed size
        const infiniteWidth = 10000;
        const infiniteHeight = 10000;

        // Save current canvas content
        const imageData = state.ctx ? state.ctx.getImageData(0, 0, state.canvas.width, state.canvas.height) : null;

        // Set infinite canvas size
        state.canvas.width = infiniteWidth;
        state.canvas.height = infiniteHeight;

        // Update container to match canvas size
        const container = elements.canvasContainer;
        container.style.width = infiniteWidth + 'px';
        container.style.height = infiniteHeight + 'px';

        // Restore canvas settings
        state.ctx.lineCap = 'round';
        state.ctx.lineJoin = 'round';
        
        // Restore content if exists
        if (imageData) {
            // If resizing, we need to handle the content differently
            // For now, just clear and let history reload
            state.ctx.fillStyle = '#FFFFFF';
            state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
        } else {
            // Initial setup - clear canvas
            state.ctx.fillStyle = '#FFFFFF';
            state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
        }
    }

    function initEventListeners() {
        // Canvas mouse events
        state.canvas.addEventListener('mousedown', startDrawing);
        state.canvas.addEventListener('mousemove', draw);
        state.canvas.addEventListener('mouseup', stopDrawing);
        state.canvas.addEventListener('mouseout', stopDrawing);
        // Removed wheel event for zoom - fixed canvas size
        state.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Touch events for mobile
        state.canvas.addEventListener('touchstart', handleTouchStart);
        state.canvas.addEventListener('touchmove', handleTouchMove);
        state.canvas.addEventListener('touchend', stopDrawing);
        
        // Tool buttons - Drawing tools
        elements.penTool.addEventListener('click', () => selectTool('pen'));
        elements.lineTool.addEventListener('click', () => selectTool('line'));
        elements.rectangleTool.addEventListener('click', () => selectTool('rectangle'));
        elements.circleTool.addEventListener('click', () => selectTool('circle'));
        elements.arrowTool.addEventListener('click', () => selectTool('arrow'));
        elements.highlighterTool.addEventListener('click', () => selectTool('highlighter'));
        elements.textTool.addEventListener('click', () => selectTool('text'));
        elements.eraserTool.addEventListener('click', () => selectTool('eraser'));
        
        // Style controls
        elements.lineStyle.addEventListener('change', (e) => {
            state.lineStyle = e.target.value;
        });
        
        // Color picker
        elements.colorPicker.addEventListener('input', (e) => {
            state.currentColor = e.target.value;
            updatePresetSelection(null);
        });
        
        // Preset colors
        elements.presetColors.forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.dataset.color;
                state.currentColor = color;
                elements.colorPicker.value = color;
                updatePresetSelection(preset);
            });
        });
        
        // Stroke width
        elements.strokeWidth.addEventListener('input', (e) => {
            state.strokeWidth = parseInt(e.target.value);
            elements.strokeValue.textContent = state.strokeWidth;
        });
        
        // Canvas controls
        elements.gridToggle.addEventListener('click', () => {
            state.showGrid = !state.showGrid;
            elements.gridToggle.classList.toggle('active', state.showGrid);
            redrawCanvas();
        });
        
        elements.snapToggle.addEventListener('click', () => {
            state.snapToGrid = !state.snapToGrid;
            elements.snapToggle.classList.toggle('active', state.snapToGrid);
        });
        
        elements.minimapToggle.addEventListener('click', () => {
            state.showMinimap = !state.showMinimap;
            elements.minimapToggle.classList.toggle('active', state.showMinimap);
            redrawCanvas();
        });
        
        // More options menu toggle
        elements.moreOptionsBtn.addEventListener('click', () => {
            elements.toolbarSecondary.classList.toggle('hidden');
            elements.moreOptionsBtn.classList.toggle('active');
        });
        
        // Close menu when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.toolbar')) {
                elements.toolbarSecondary.classList.add('hidden');
                elements.moreOptionsBtn.classList.remove('active');
            }
        });
        
        // Zoom controls
        elements.zoomIn.addEventListener('click', () => zoomCanvas(1.2));
        elements.zoomOut.addEventListener('click', () => zoomCanvas(0.8));
        elements.zoomReset.addEventListener('click', () => {
            state.zoom = 1;
            state.panX = 0;
            state.panY = 0;
            updateZoomDisplay();
            redrawCanvas();
        });
        
        // Edit controls
        elements.undoBtn.addEventListener('click', undo);
        elements.redoBtn.addEventListener('click', redo);
        
        // Actions
        elements.clearCanvas.addEventListener('click', clearCanvas);
        elements.downloadCanvas.addEventListener('click', downloadCanvas);
        elements.downloadPDF.addEventListener('click', downloadCanvasPDF);
        
        // Chat
        elements.chatToggle.addEventListener('click', () => {
            elements.chatPanel.classList.toggle('open');
        });
        elements.closeChatBtn.addEventListener('click', () => {
            elements.chatPanel.classList.remove('open');
        });
        elements.sendChatBtn.addEventListener('click', sendChatMessage);
        elements.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
        
        // Mouse movement for cursor tracking
        state.canvas.addEventListener('mousemove', (e) => {
            const coords = getCanvasCoordinates(e);
            state.lastMouseX = coords.x;
            state.lastMouseY = coords.y;
            
            // Send cursor position every 100ms
            if (!state.cursorSendTimer) {
                state.cursorSendTimer = setTimeout(() => {
                    sendCursorPosition(coords.x, coords.y);
                    state.cursorSendTimer = null;
                }, 100);
            }
        });
    }

    function initRoomListeners() {
        // Room buttons
        elements.createRoomBtn.addEventListener('click', createRoom);
        elements.joinRoomBtn.addEventListener('click', showJoinModal);
        elements.leaveRoomBtn.addEventListener('click', leaveRoom);
        elements.shareRoomBtn.addEventListener('click', showShareModal);
        elements.copyRoomCode.addEventListener('click', copyRoomCode);
        
        // Join modal
        elements.closeJoinModal.addEventListener('click', hideJoinModal);
        elements.cancelJoin.addEventListener('click', hideJoinModal);
        elements.confirmJoin.addEventListener('click', joinRoom);
        elements.joinRoomCode.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') joinRoom();
        });
        
        // Waiting modal
        elements.cancelWaiting.addEventListener('click', cancelWaitingApproval);
        
        // Share modal
        elements.closeShareModal.addEventListener('click', hideShareModal);
        elements.closeShareBtn.addEventListener('click', hideShareModal);
        elements.copyShareCode.addEventListener('click', () => {
            copyToClipboard(state.roomCode);
            showNotification('Room code copied!', 'success');
        });
        elements.copyShareLink.addEventListener('click', () => {
            const link = window.location.origin + window.location.pathname + '?room=' + state.roomCode;
            copyToClipboard(link);
            showNotification('Share link copied!', 'success');
        });
        
        // Request modal
        elements.rejectRequest.addEventListener('click', rejectCurrentRequest);
        elements.approveRequest.addEventListener('click', approveCurrentRequest);
        
        // Pending requests badge click
        elements.pendingRequests.addEventListener('click', showNextRequest);
        
        // Modal backdrop clicks
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal.id !== 'waitingModal' && modal.id !== 'requestModal') {
                    modal.classList.add('hidden');
                }
            });
        });
    }

    function initAuthListeners() {
        // Login button
        elements.loginBtn.addEventListener('click', () => {
            elements.loginModal.classList.remove('hidden');
            elements.loginUsername.focus();
        });

        // Register button
        elements.registerBtn.addEventListener('click', () => {
            elements.registerModal.classList.remove('hidden');
            elements.registerUsername.focus();
        });

        // Logout button
        elements.logoutBtn.addEventListener('click', handleLogout);

        // Login modal
        elements.closeLoginModal.addEventListener('click', () => {
            elements.loginModal.classList.add('hidden');
        });
        elements.cancelLogin.addEventListener('click', () => {
            elements.loginModal.classList.add('hidden');
        });
        elements.confirmLogin.addEventListener('click', handleLoginSubmit);
        elements.switchToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            elements.loginModal.classList.add('hidden');
            elements.registerModal.classList.remove('hidden');
            elements.registerUsername.focus();
        });

        // Register modal
        elements.closeRegisterModal.addEventListener('click', () => {
            elements.registerModal.classList.add('hidden');
        });
        elements.cancelRegister.addEventListener('click', () => {
            elements.registerModal.classList.add('hidden');
        });
        elements.confirmRegister.addEventListener('click', handleRegisterSubmit);
        elements.switchToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            elements.registerModal.classList.add('hidden');
            elements.loginModal.classList.remove('hidden');
            elements.loginUsername.focus();
        });

        // Enter key in login
        elements.loginUsername.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLoginSubmit();
        });
        elements.loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLoginSubmit();
        });

        // Enter key in register
        elements.registerPassword2.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleRegisterSubmit();
        });
    }

    function handleLoginSubmit() {
        const username = elements.loginUsername.value.trim();
        const password = elements.loginPassword.value;
        
        // Clear previous error
        elements.loginMessage.classList.add('hidden');
        elements.loginMessage.classList.remove('error', 'success');
        
        // Validate input
        if (!username) {
            showAuthMessage(elements.loginMessage, 'Please enter username', 'error');
            return;
        }
        if (!password) {
            showAuthMessage(elements.loginMessage, 'Please enter password', 'error');
            return;
        }
        
        // Send login request to WebSocket
        if (state.socket && state.socket.readyState === WebSocket.OPEN) {
            state.socket.send(JSON.stringify({
                type: 'login',
                username: username,
                password: password
            }));
        } else {
            showAuthMessage(elements.loginMessage, 'Connection lost. Please try again.', 'error');
        }
    }

    function handleRegisterSubmit() {
        const username = elements.registerUsername.value.trim();
        const email = elements.registerEmail.value.trim();
        const password = elements.registerPassword.value;
        const password2 = elements.registerPassword2.value;
        
        // Clear previous error
        elements.registerMessage.classList.add('hidden');
        elements.registerMessage.classList.remove('error', 'success');
        
        // Validate input
        if (!username) {
            showAuthMessage(elements.registerMessage, 'Please enter username', 'error');
            return;
        }
        if (!email) {
            showAuthMessage(elements.registerMessage, 'Please enter email', 'error');
            return;
        }
        if (!password) {
            showAuthMessage(elements.registerMessage, 'Please enter password', 'error');
            return;
        }
        if (!password2) {
            showAuthMessage(elements.registerMessage, 'Please confirm password', 'error');
            return;
        }
        if (password !== password2) {
            showAuthMessage(elements.registerMessage, 'Passwords do not match', 'error');
            return;
        }
        
        // Send register request to WebSocket
        if (state.socket && state.socket.readyState === WebSocket.OPEN) {
            state.socket.send(JSON.stringify({
                type: 'register',
                username: username,
                email: email,
                password: password
            }));
        } else {
            showAuthMessage(elements.registerMessage, 'Connection lost. Please try again.', 'error');
        }
    }

    function handleLogout() {
        // Send logout request to WebSocket
        if (state.socket && state.socket.readyState === WebSocket.OPEN) {
            state.socket.send(JSON.stringify({
                type: 'logout'
            }));
        }
        
        // Reset state locally
        state.isLoggedIn = false;
        state.currentUser = null;
        state.userId = null;
        state.username = '';
        state.token = null;
        
        // Clear authentication state from localStorage
        localStorage.removeItem('whiteboard_userId');
        localStorage.removeItem('whiteboard_username');
        localStorage.removeItem('whiteboard_token');
        
        // Update UI
        updateAuthUI();
        showNotification('Logged out successfully', 'success');
    }

    function showAuthMessage(messageElement, message, type) {
        messageElement.textContent = message;
        messageElement.classList.remove('hidden');
        messageElement.classList.remove('error', 'success');
        messageElement.classList.add(type);
    }

    function updateAuthUI() {
        if (state.isLoggedIn) {
            // Show user info, hide auth buttons
            elements.authButtons.classList.add('hidden');
            elements.userInfo.classList.remove('hidden');
            elements.userDisplayName.textContent = state.username;
        } else {
            // Show auth buttons, hide user info
            elements.authButtons.classList.remove('hidden');
            elements.userInfo.classList.add('hidden');
            
            // Clear forms
            elements.loginUsername.value = '';
            elements.loginPassword.value = '';
            elements.registerUsername.value = '';
            elements.registerEmail.value = '';
            elements.registerPassword.value = '';
            elements.registerPassword2.value = '';
            
            // Hide modals
            elements.loginModal.classList.add('hidden');
            elements.registerModal.classList.add('hidden');
        }
    }

    function checkUrlForRoomCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomCode = urlParams.get('room');
        if (roomCode) {
            // Wait for connection then auto-show join modal
            const checkConnection = setInterval(() => {
                if (state.isConnected) {
                    clearInterval(checkConnection);
                    elements.joinRoomCode.value = roomCode.toUpperCase();
                    showJoinModal();
                }
            }, 100);
        }
    }

    // ========================================
    // WebSocket Connection
    // ========================================
    function connectWebSocket() {
        try {
            state.socket = new WebSocket(CONFIG.WS_URL);
            
            state.socket.onopen = handleSocketOpen;
            state.socket.onmessage = handleSocketMessage;
            state.socket.onclose = handleSocketClose;
            state.socket.onerror = handleSocketError;
            
        } catch (error) {
            console.error('WebSocket connection error:', error);
            showNotification('Failed to connect to server', 'error');
        }
    }

    function handleSocketOpen() {
        console.log('WebSocket connected');
        state.isConnected = true;
        state.reconnectAttempts = 0;
        
        updateConnectionStatus(true);
        hideOverlay();
        showNotification('Connected to whiteboard!', 'success');
        
        // Start ping interval
        state.pingInterval = setInterval(() => {
            if (state.socket && state.socket.readyState === WebSocket.OPEN) {
                state.socket.send(JSON.stringify({ type: 'ping' }));
            }
        }, CONFIG.PING_INTERVAL);
    }

    function handleSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                // Authentication
                case 'registerSuccess':
                    showAuthMessage(elements.registerMessage, 'Registration successful! Please log in.', 'success');
                    setTimeout(() => {
                        elements.registerModal.classList.add('hidden');
                        elements.loginModal.classList.remove('hidden');
                        elements.registerUsername.value = '';
                        elements.registerEmail.value = '';
                        elements.registerPassword.value = '';
                        elements.registerPassword2.value = '';
                        elements.loginUsername.focus();
                    }, 1500);
                    break;
                    
                case 'registerFailed':
                    showAuthMessage(elements.registerMessage, data.message || 'Registration failed', 'error');
                    break;
                    
                case 'loginSuccess':
                    state.isLoggedIn = true;
                    state.userId = data.userId;
                    state.username = data.username;
                    state.token = data.token;
                    state.currentUser = {
                        id: data.userId,
                        username: data.username
                    };
                    
                    // Save authentication state to localStorage
                    localStorage.setItem('whiteboard_userId', data.userId);
                    localStorage.setItem('whiteboard_username', data.username);
                    localStorage.setItem('whiteboard_token', data.token);
                    
                    updateAuthUI();
                    elements.loginModal.classList.add('hidden');
                    showNotification(`Welcome, ${data.username}!`, 'success');
                    break;
                    
                case 'loginFailed':
                    showAuthMessage(elements.loginMessage, data.message || 'Login failed', 'error');
                    break;
                    
                case 'logoutSuccess':
                    state.isLoggedIn = false;
                    state.userId = null;
                    state.username = '';
                    state.token = null;
                    state.currentUser = null;
                    updateAuthUI();
                    showNotification('Logged out successfully', 'success');
                    break;

                case 'welcome':
                    state.sessionId = data.sessionId;
                    elements.sessionId.textContent = data.sessionId.substring(0, 8) + '...';
                    break;
                    
                case 'draw':
                    drawRemoteStroke(data);
                    break;
                    
                case 'shape':
                    drawRemoteShape(data);
                    break;
                    
                case 'text':
                    state.ctx.fillStyle = data.color;
                    state.ctx.font = data.size + 'px monospace';
                    state.ctx.fillText(data.text, data.x, data.y);
                    break;
                    
                case 'chat':
                    addChatMessage(data);
                    break;
                    
                case 'cursor':
                    updateUserCursor(data);
                    break;
                    
                case 'clear':
                    clearCanvasLocal();
                    showNotification('Canvas cleared', 'info');
                    break;
                    
                case 'userCount':
                    updateUserCount(data.count);
                    break;
                    
                case 'historyStart':
                    state.isReceivingHistory = true;
                    // Clear canvas before loading history
                    state.ctx.fillStyle = '#FFFFFF';
                    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
                    break;
                    
                case 'historyEnd':
                    state.isReceivingHistory = false;
                    showNotification('Canvas history loaded', 'success');
                    break;
                    
                case 'pong':
                    break;
                    
                // Room events
                case 'roomCreated':
                    handleRoomCreated(data);
                    break;
                    
                case 'waitingApproval':
                    handleWaitingApproval(data);
                    break;
                    
                case 'approved':
                    handleApproved(data);
                    break;
                    
                case 'rejected':
                    handleRejected();
                    break;
                    
                case 'joinRequest':
                    handleJoinRequest(data);
                    break;
                    
                case 'pendingUpdate':
                    updatePendingCount(data.pendingCount);
                    break;
                    
                case 'userJoined':
                    showNotification('A user joined the room', 'info');
                    updateUserCount(data.userCount);
                    break;
                    
                case 'userLeft':
                    showNotification('A user left the room', 'info');
                    updateUserCount(data.userCount);
                    break;
                    
                case 'roomClosed':
                    handleRoomClosed(data);
                    break;
                    
                case 'leftRoom':
                    resetRoomState();
                    showNotification('You left the room', 'info');
                    break;
                    
                case 'error':
                    showNotification(data.message, 'error');
                    break;
                    
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }

    function handleSocketClose(event) {
        console.log('WebSocket closed:', event.code, event.reason);
        state.isConnected = false;
        
        updateConnectionStatus(false);
        clearInterval(state.pingInterval);
        
        // Attempt reconnection
        if (state.reconnectAttempts < CONFIG.MAX_RECONNECT_ATTEMPTS) {
            state.reconnectAttempts++;
            showNotification(`Connection lost. Reconnecting (${state.reconnectAttempts}/${CONFIG.MAX_RECONNECT_ATTEMPTS})...`, 'warning');
            setTimeout(connectWebSocket, CONFIG.RECONNECT_DELAY);
        } else {
            showNotification('Could not reconnect. Please refresh the page.', 'error');
        }
    }

    function handleSocketError(error) {
        console.error('WebSocket error:', error);
        showNotification('Connection error occurred', 'error');
    }

    function sendMessage(msg) {
        if (!state.isConnected || !state.socket) return;
        state.socket.send(JSON.stringify(msg));
    }

    function sendDrawEvent(x1, y1, x2, y2) {
        if (!state.isConnected || !state.socket) return;
        
        // If in a room but not approved, don't send
        if (state.isInRoom && !state.isApproved) return;
        
        const event = {
            type: 'draw',
            x1: Math.round(x1),
            y1: Math.round(y1),
            x2: Math.round(x2),
            y2: Math.round(y2),
            color: state.currentTool === 'eraser' ? '#FFFFFF' : state.currentColor,
            tool: state.currentTool,
            strokeWidth: state.currentTool === 'eraser' ? state.strokeWidth * 3 : state.strokeWidth,
            lineStyle: state.lineStyle,
            username: state.username || 'Anonymous'
        };
        
        state.socket.send(JSON.stringify(event));
    }

    // ========================================
    // Chat Functions
    // ========================================
    function sendChatMessage() {
        const message = elements.chatInput.value.trim();
        if (!message) return;
        
        elements.chatInput.value = '';
        
        sendMessage({
            type: 'chat',
            message: message,
            username: state.username || 'Anonymous',
            timestamp: new Date().toISOString()
        });
        
        // Add to own chat locally
        addChatMessageLocal(message, state.username || 'Anonymous', true);
    }

    function addChatMessageLocal(message, username, isOwn = false) {
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message' + (isOwn ? ' own' : '');
        
        const userEl = document.createElement('div');
        userEl.className = 'chat-message-user';
        userEl.textContent = username;
        
        const textEl = document.createElement('div');
        textEl.className = 'chat-message-text';
        textEl.textContent = message;
        
        const timeEl = document.createElement('div');
        timeEl.className = 'chat-message-time';
        timeEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageEl.appendChild(userEl);
        messageEl.appendChild(textEl);
        messageEl.appendChild(timeEl);
        
        elements.chatMessages.appendChild(messageEl);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }

    function addChatMessage(data) {
        addChatMessageLocal(data.message, data.username);
    }

    // ========================================
    // Live Cursor Functions
    // ========================================
    function sendCursorPosition(x, y) {
        if (!state.isConnected || !state.socket || !state.username) return;
        
        // Send screen coordinates, not canvas coordinates
        const rect = state.canvas.getBoundingClientRect();
        const screenX = x + rect.left;
        const screenY = y + rect.top;
        
        sendMessage({
            type: 'cursor',
            x: Math.round(screenX),
            y: Math.round(screenY),
            username: state.username,
            sessionId: state.sessionId
        });
    }

    function updateUserCursor(data) {
        const cursorId = 'cursor-' + data.sessionId;
        let cursorEl = document.getElementById(cursorId);
        
        if (!cursorEl) {
            cursorEl = document.createElement('div');
            cursorEl.id = cursorId;
            cursorEl.className = 'user-cursor';
            
            // Assign consistent color based on sessionId
            const colorIndex = Math.abs(data.sessionId.charCodeAt(0) % state.cursorColors.length);
            const color = state.cursorColors[colorIndex];
            cursorEl.style.color = color;
            
            elements.userCursorsContainer.appendChild(cursorEl);
        }
        
        // Convert screen coordinates back to canvas coordinates
        const rect = state.canvas.getBoundingClientRect();
        const canvasX = data.x - rect.left;
        const canvasY = data.y - rect.top;
        
        // Apply zoom and pan transformation
        const displayX = canvasX * state.zoom + state.panX;
        const displayY = canvasY * state.zoom + state.panY;
        
        // Update position
        cursorEl.style.left = displayX + 'px';
        cursorEl.style.top = displayY + 'px';
        
        // Update label
        let label = cursorEl.querySelector('.user-cursor-label');
        if (!label) {
            const pointer = document.createElement('div');
            pointer.className = 'user-cursor-pointer';
            cursorEl.appendChild(pointer);
            
            label = document.createElement('div');
            label.className = 'user-cursor-label';
            cursorEl.appendChild(label);
        }
        label.textContent = data.username;
        
        // Remove cursor after 2 seconds of inactivity
        clearTimeout(cursorEl.hideTimer);
        cursorEl.style.opacity = '1';
        cursorEl.hideTimer = setTimeout(() => {
            cursorEl.style.opacity = '0.3';
        }, 2000);
    }

    // ========================================
    // Room Functions
    // ========================================
    function createRoom() {
        sendMessage({ type: 'createRoom' });
    }

    function handleRoomCreated(data) {
        state.roomCode = data.roomCode;
        state.isRoomOwner = true;
        state.isInRoom = true;
        state.isApproved = true;
        
        updateRoomUI();
        showNotification('Room created! Share the code to invite others.', 'success');
        showShareModal();
    }

    function showJoinModal() {
        elements.joinModal.classList.remove('hidden');
        elements.joinRoomCode.focus();
    }

    function hideJoinModal() {
        elements.joinModal.classList.add('hidden');
        elements.joinRoomCode.value = '';
        elements.joinUsername.value = '';
    }

    function joinRoom() {
        const roomCode = elements.joinRoomCode.value.trim().toUpperCase();
        const username = elements.joinUsername.value.trim() || 'Anonymous';
        
        if (roomCode.length !== 6) {
            showNotification('Please enter a valid 6-character room code', 'error');
            return;
        }
        
        sendMessage({
            type: 'joinRoom',
            roomCode: roomCode,
            username: username
        });
        
        hideJoinModal();
    }

    function handleWaitingApproval(data) {
        state.roomCode = data.roomCode;
        state.isInRoom = true;
        state.isApproved = false;
        
        elements.waitingRoomCode.textContent = data.roomCode;
        elements.waitingModal.classList.remove('hidden');
    }

    function cancelWaitingApproval() {
        elements.waitingModal.classList.add('hidden');
        sendMessage({ type: 'leaveRoom' });
        resetRoomState();
    }

    function handleApproved(data) {
        elements.waitingModal.classList.add('hidden');
        state.isApproved = true;
        
        updateRoomUI();
        updateUserCount(data.userCount);
        showNotification('You have been approved! You can now draw.', 'success');
    }

    function handleRejected() {
        elements.waitingModal.classList.add('hidden');
        showNotification('Your request to join was rejected.', 'error');
        resetRoomState();
    }

    function handleJoinRequest(data) {
        state.pendingRequests.push({
            sessionId: data.sessionId,
            username: data.username
        });
        
        updatePendingCount(data.pendingCount);
        
        // If no request modal is showing, show this one
        if (!state.currentRequest) {
            showNextRequest();
        }
    }

    function showNextRequest() {
        if (state.pendingRequests.length === 0) {
            elements.requestModal.classList.add('hidden');
            state.currentRequest = null;
            return;
        }
        
        state.currentRequest = state.pendingRequests.shift();
        elements.requestUsername.textContent = state.currentRequest.username;
        elements.requestModal.classList.remove('hidden');
    }

    function approveCurrentRequest() {
        if (!state.currentRequest) return;
        
        sendMessage({
            type: 'approveUser',
            sessionId: state.currentRequest.sessionId
        });
        
        showNextRequest();
    }

    function rejectCurrentRequest() {
        if (!state.currentRequest) return;
        
        sendMessage({
            type: 'rejectUser',
            sessionId: state.currentRequest.sessionId
        });
        
        showNextRequest();
    }

    function updatePendingCount(count) {
        const badge = elements.pendingRequests;
        const countEl = badge.querySelector('.pending-count');
        
        countEl.textContent = count;
        badge.classList.toggle('hidden', count === 0);
    }

    function leaveRoom() {
        if (state.isRoomOwner) {
            if (!confirm('Leaving will close the room for all users. Continue?')) {
                return;
            }
        }

        // Clear canvas when leaving room to remove collaborative content
        clearCanvasLocal();

        sendMessage({ type: 'leaveRoom' });
    }

    function handleRoomClosed(data) {
        elements.waitingModal.classList.add('hidden');
        elements.requestModal.classList.add('hidden');
        showNotification(data.reason || 'Room has been closed', 'warning');
        resetRoomState();
    }

    function resetRoomState() {
        state.roomCode = null;
        state.isRoomOwner = false;
        state.isInRoom = false;
        state.isApproved = false;
        state.pendingRequests = [];
        state.currentRequest = null;
        
        updateRoomUI();
    }

    function updateRoomUI() {
        const inRoom = state.isInRoom && state.isApproved;
        
        elements.roomBadge.classList.toggle('hidden', !inRoom);
        elements.roomCodeDisplay.textContent = state.roomCode || '-';
        
        elements.createRoomBtn.classList.toggle('hidden', inRoom);
        elements.joinRoomBtn.classList.toggle('hidden', inRoom);
        elements.leaveRoomBtn.classList.toggle('hidden', !inRoom);
        elements.shareRoomBtn.classList.toggle('hidden', !state.isRoomOwner);
        
        elements.pendingRequests.classList.toggle('hidden', !state.isRoomOwner || state.pendingRequests.length === 0);
    }

    function showShareModal() {
        elements.shareCodeDisplay.textContent = state.roomCode;
        elements.shareModal.classList.remove('hidden');
    }

    function hideShareModal() {
        elements.shareModal.classList.add('hidden');
    }

    function copyRoomCode() {
        copyToClipboard(state.roomCode);
        showNotification('Room code copied!', 'success');
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(() => {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        });
    }

    // ========================================
    // Drawing Functions
    // ========================================
    function startDrawing(e) {
        // Don't allow drawing if in room but not approved
        if (state.isInRoom && !state.isApproved) {
            showNotification('You must be approved by the room owner to draw.', 'warning');
            return;
        }
        
        state.isDrawing = true;
        const coords = getCanvasCoordinates(e);
        state.lastX = coords.x;
        state.lastY = coords.y;
        
        // For shapes, mark the start point and save canvas state
        if (['line', 'rectangle', 'circle', 'arrow'].includes(state.currentTool)) {
            state.shapeStart = { x: coords.x, y: coords.y };
            state.shapePreviewActive = true;
            state.shapePreviewData = state.ctx.getImageData(0, 0, state.canvas.width, state.canvas.height);
            saveHistoryState();
        } else if (state.currentTool === 'text') {
            createTextInput(coords.x, coords.y);
            state.isDrawing = false;
        }
    }

    function draw(e) {
        if (!state.isDrawing) return;
        if (state.isInRoom && !state.isApproved) {
            showNotification('You must be approved by the room owner to draw.', 'warning');
            return;
        }
        
        const coords = getCanvasCoordinates(e);
        
        // Handle pan with middle mouse button
        if (e.buttons === 4) {
            state.panX += coords.x - state.lastX;
            state.panY += coords.y - state.lastY;
            redrawCanvas();
            state.lastX = coords.x;
            state.lastY = coords.y;
            return;
        }
        
        // Check for Shift key for constraints
        state.shapeConstraint = e.shiftKey;
        
        if (state.currentTool === 'pen') {
            drawStroke(state.lastX, state.lastY, coords.x, coords.y, 
                       state.currentColor, state.strokeWidth, state.lineStyle);
            sendDrawEvent(state.lastX, state.lastY, coords.x, coords.y);
        } else if (state.currentTool === 'eraser') {
            drawStroke(state.lastX, state.lastY, coords.x, coords.y,
                       '#FFFFFF', state.strokeWidth * 3, 'solid');
            sendDrawEvent(state.lastX, state.lastY, coords.x, coords.y);
        } else if (state.currentTool === 'highlighter') {
            drawHighlighter(state.lastX, state.lastY, coords.x, coords.y, state.currentColor, state.strokeWidth);
            sendDrawEvent(state.lastX, state.lastY, coords.x, coords.y);
        } else if (['line', 'rectangle', 'circle', 'arrow'].includes(state.currentTool)) {
            // Restore canvas state and draw shape preview
            if (state.shapePreviewData && state.shapePreviewActive) {
                state.ctx.putImageData(state.shapePreviewData, 0, 0);
                
                if (state.currentTool === 'line') {
                    drawLine(state.shapeStart.x, state.shapeStart.y, coords.x, coords.y, 
                            state.currentColor, state.strokeWidth, state.lineStyle);
                } else if (state.currentTool === 'rectangle') {
                    drawRectangle(state.shapeStart.x, state.shapeStart.y, coords.x, coords.y,
                                 state.currentColor, state.strokeWidth, state.shapeConstraint);
                } else if (state.currentTool === 'circle') {
                    drawCircle(state.shapeStart.x, state.shapeStart.y, coords.x, coords.y,
                              state.currentColor, state.strokeWidth, state.shapeConstraint);
                } else if (state.currentTool === 'arrow') {
                    drawArrow(state.shapeStart.x, state.shapeStart.y, coords.x, coords.y,
                             state.currentColor, state.strokeWidth, state.lineStyle);
                }
            }
        }
        
        state.lastX = coords.x;
        state.lastY = coords.y;
    }

    function stopDrawing(e) {
        if (!state.isDrawing) return;
        
        state.isDrawing = false;
        
        // For shapes, finalize or cancel the drawing
        if (state.shapeStart && ['line', 'rectangle', 'circle', 'arrow'].includes(state.currentTool)) {
            const coords = getCanvasCoordinates(e);
            const rect = state.canvas.getBoundingClientRect();
            const isInsideCanvas = e.clientX >= rect.left && e.clientX <= rect.right && 
                                   e.clientY >= rect.top && e.clientY <= rect.bottom;
            
            // Only finalize if mouse is still inside canvas (meaning user completed the shape)
            if (isInsideCanvas && (Math.abs(coords.x - state.shapeStart.x) > 5 || Math.abs(coords.y - state.shapeStart.y) > 5)) {
                // Draw the shape locally immediately
                if (state.currentTool === 'line') {
                    drawLine(state.shapeStart.x, state.shapeStart.y, coords.x, coords.y, 
                            state.currentColor, state.strokeWidth, state.lineStyle);
                } else if (state.currentTool === 'rectangle') {
                    drawRectangle(state.shapeStart.x, state.shapeStart.y, coords.x, coords.y,
                                 state.currentColor, state.strokeWidth, state.shapeConstraint);
                } else if (state.currentTool === 'circle') {
                    drawCircle(state.shapeStart.x, state.shapeStart.y, coords.x, coords.y,
                              state.currentColor, state.strokeWidth, state.shapeConstraint);
                } else if (state.currentTool === 'arrow') {
                    drawArrow(state.shapeStart.x, state.shapeStart.y, coords.x, coords.y,
                             state.currentColor, state.strokeWidth, state.lineStyle);
                }
                
                const shapeData = {
                    type: 'shape',
                    tool: state.currentTool,
                    x1: state.shapeStart.x,
                    y1: state.shapeStart.y,
                    x2: coords.x,
                    y2: coords.y,
                    color: state.currentColor,
                    strokeWidth: state.strokeWidth,
                    lineStyle: state.lineStyle,
                    constraint: state.shapeConstraint
                };
                
                if (state.socket && state.socket.readyState === WebSocket.OPEN) {
                    state.socket.send(JSON.stringify(shapeData));
                }
                
                saveHistoryState();
            } else {
                // Cancel shape - restore original canvas state
                if (state.shapePreviewData) {
                    state.ctx.putImageData(state.shapePreviewData, 0, 0);
                }
            }
            
            state.shapeStart = null;
            state.shapePreviewActive = false;
            state.shapePreviewData = null;
        }
    }

    function handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        startDrawing(mouseEvent);
    }

    function handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            buttons: 1
        });
        draw(mouseEvent);
    }

    function drawStroke(x1, y1, x2, y2, color, width, style = 'solid') {
        state.ctx.beginPath();
        state.ctx.moveTo(x1, y1);
        state.ctx.lineTo(x2, y2);
        state.ctx.strokeStyle = color;
        state.ctx.lineWidth = width;
        state.ctx.lineCap = 'round';
        state.ctx.lineJoin = 'round';
        
        setLineStyle(style);
        state.ctx.stroke();
        state.ctx.closePath();
        state.ctx.setLineDash([]);
    }

    function setLineStyle(style) {
        switch(style) {
            case 'dashed':
                state.ctx.setLineDash([10, 5]);
                break;
            case 'dotted':
                state.ctx.setLineDash([2, 5]);
                break;
            default:
                state.ctx.setLineDash([]);
        }
    }

    function drawLine(x1, y1, x2, y2, color, width, style = 'solid') {
        drawStroke(x1, y1, x2, y2, color, width, style);
    }

    function drawRectangle(x1, y1, x2, y2, color, width, constraint = false) {
        let w = x2 - x1;
        let h = y2 - y1;
        
        // Make square if constraint (Shift) is held
        if (constraint) {
            const size = Math.min(Math.abs(w), Math.abs(h));
            w = w < 0 ? -size : size;
            h = h < 0 ? -size : size;
        }
        
        state.ctx.strokeStyle = color;
        state.ctx.lineWidth = width;
        state.ctx.setLineDash([]);
        state.ctx.strokeRect(x1, y1, w, h);
    }

    function drawCircle(x1, y1, x2, y2, color, width, constraint = false) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const radius = Math.sqrt(dx * dx + dy * dy);
        
        state.ctx.strokeStyle = color;
        state.ctx.lineWidth = width;
        state.ctx.setLineDash([]);
        state.ctx.beginPath();
        state.ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
        state.ctx.stroke();
        state.ctx.closePath();
    }

    function drawArrow(x1, y1, x2, y2, color, width, style = 'solid') {
        const headlen = 20;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        
        // Draw line
        drawStroke(x1, y1, x2, y2, color, width, style);
        
        // Draw arrowhead
        state.ctx.fillStyle = color;
        state.ctx.beginPath();
        state.ctx.moveTo(x2, y2);
        state.ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
        state.ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
        state.ctx.closePath();
        state.ctx.fill();
    }

    function drawHighlighter(x1, y1, x2, y2, color, width) {
        state.ctx.strokeStyle = color;
        state.ctx.globalAlpha = 0.3;
        state.ctx.lineWidth = width * 3;
        state.ctx.lineCap = 'round';
        state.ctx.lineJoin = 'round';
        state.ctx.beginPath();
        state.ctx.moveTo(x1, y1);
        state.ctx.lineTo(x2, y2);
        state.ctx.stroke();
        state.ctx.closePath();
        state.ctx.globalAlpha = 1;
    }

    function drawRemoteStroke(data) {
        if (data.tool === 'eraser') {
            drawStroke(data.x1, data.y1, data.x2, data.y2, '#FFFFFF', data.strokeWidth * 3, 'solid');
        } else if (data.tool === 'highlighter') {
            drawHighlighter(data.x1, data.y1, data.x2, data.y2, data.color, data.strokeWidth);
        } else {
            drawStroke(data.x1, data.y1, data.x2, data.y2, data.color, data.strokeWidth, data.lineStyle || 'solid');
        }
    }

    function drawRemoteShape(data) {
        switch(data.tool) {
            case 'line':
                drawLine(data.x1, data.y1, data.x2, data.y2, data.color, data.strokeWidth, data.lineStyle);
                break;
            case 'rectangle':
                drawRectangle(data.x1, data.y1, data.x2, data.y2, data.color, data.strokeWidth, data.constraint);
                break;
            case 'circle':
                drawCircle(data.x1, data.y1, data.x2, data.y2, data.color, data.strokeWidth, data.constraint);
                break;
            case 'arrow':
                drawArrow(data.x1, data.y1, data.x2, data.y2, data.color, data.strokeWidth, data.lineStyle);
                break;
        }
    }

    function getCanvasCoordinates(e) {
        const rect = state.canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        
        // Fixed canvas - no pan/zoom transformations
        // Snap to grid if enabled
        if (state.snapToGrid) {
            x = Math.round(x / state.gridSize) * state.gridSize;
            y = Math.round(y / state.gridSize) * state.gridSize;
        }
        
        return { x, y };
    }

    function createTextInput(x, y) {
        const input = document.createElement('input');
        input.type = 'text';
        input.style.position = 'absolute';
        input.style.left = (x + state.panX) + 'px';
        input.style.top = (y + state.panY) + 'px';
        input.style.fontSize = state.strokeWidth * 4 + 'px';
        input.style.color = state.currentColor;
        input.style.border = 'none';
        input.style.backgroundColor = 'transparent';
        input.style.fontFamily = 'monospace';
        input.style.zIndex = '1000';
        
        document.body.appendChild(input);
        input.focus();
        
        const finishText = () => {
            if (input.value) {
                state.ctx.fillStyle = state.currentColor;
                state.ctx.font = (state.strokeWidth * 4) + 'px monospace';
                state.ctx.fillText(input.value, x, y);
                
                sendMessage({
                    type: 'text',
                    x: x,
                    y: y,
                    text: input.value,
                    color: state.currentColor,
                    size: state.strokeWidth * 4
                });
            }
            document.body.removeChild(input);
            saveHistoryState();
        };
        
        input.addEventListener('blur', finishText);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finishText();
        });
    }

    // ========================================
    // Tool Functions
    // ========================================
    function selectTool(tool) {
        state.currentTool = tool;
        
        // Update UI - remove active from all tools
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        
        // Add active to selected tool
        const toolMap = {
            'pen': elements.penTool,
            'line': elements.lineTool,
            'rectangle': elements.rectangleTool,
            'circle': elements.circleTool,
            'arrow': elements.arrowTool,
            'highlighter': elements.highlighterTool,
            'text': elements.textTool,
            'eraser': elements.eraserTool
        };
        
        if (toolMap[tool]) {
            toolMap[tool].classList.add('active');
        }
        
        // Update cursor
        const cursorMap = {
            'pen': 'crosshair',
            'line': 'crosshair',
            'rectangle': 'crosshair',
            'circle': 'crosshair',
            'arrow': 'crosshair',
            'highlighter': 'crosshair',
            'text': 'text',
            'eraser': 'cell'
        };
        
        state.canvas.style.cursor = cursorMap[tool] || 'crosshair';
    }

    function updatePresetSelection(selectedPreset) {
        elements.presetColors.forEach(preset => {
            preset.classList.remove('active');
        });
        if (selectedPreset) {
            selectedPreset.classList.add('active');
        }
    }

    // ========================================
    // Canvas Navigation (Zoom & Pan)
    // ========================================
    function handleCanvasZoom(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        zoomCanvas(delta);
    }

    function zoomCanvas(factor) {
        const oldZoom = state.zoom;
        state.zoom *= factor;
        state.zoom = Math.max(0.5, Math.min(5, state.zoom)); // Clamp between 0.5x and 5x
        
        updateZoomDisplay();
        redrawCanvas();
    }

    function updateZoomDisplay() {
        elements.zoomLevel.textContent = Math.round(state.zoom * 100) + '%';
    }

    // ========================================
    // Grid & Snap
    // ========================================
    function drawGrid() {
        if (!state.showGrid) return;
        
        state.ctx.strokeStyle = '#E5E7EB';
        state.ctx.lineWidth = 0.5;
        state.ctx.setLineDash([]);
        
        const gridSize = state.gridSize * state.zoom;
        const offsetX = state.panX % gridSize;
        const offsetY = state.panY % gridSize;
        
        for (let x = offsetX; x < state.canvas.width; x += gridSize) {
            state.ctx.beginPath();
            state.ctx.moveTo(x, 0);
            state.ctx.lineTo(x, state.canvas.height);
            state.ctx.stroke();
        }
        
        for (let y = offsetY; y < state.canvas.height; y += gridSize) {
            state.ctx.beginPath();
            state.ctx.moveTo(0, y);
            state.ctx.lineTo(state.canvas.width, y);
            state.ctx.stroke();
        }
    }

    // ========================================
    // Mini-map
    // ========================================
    function drawMinimap() {
        if (!state.showMinimap) return;
        
        const minimapSize = 120;
        const padding = 10;
        const x = state.canvas.width - minimapSize - padding;
        const y = state.canvas.height - minimapSize - padding;
        
        // Background
        state.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        state.ctx.strokeStyle = '#999';
        state.ctx.lineWidth = 1;
        state.ctx.fillRect(x, y, minimapSize, minimapSize);
        state.ctx.strokeRect(x, y, minimapSize, minimapSize);
        
        // Viewport indicator
        const scaleX = minimapSize / (state.canvas.width / state.zoom);
        const scaleY = minimapSize / (state.canvas.height / state.zoom);
        
        state.ctx.strokeStyle = '#00FF00';
        state.ctx.lineWidth = 2;
        state.ctx.strokeRect(
            x + (-state.panX / state.zoom) * scaleX,
            y + (-state.panY / state.zoom) * scaleY,
            state.canvas.width * scaleX,
            state.canvas.height * scaleY
        );
    }

    // ========================================
    // History (Undo/Redo)
    // ========================================
    function saveHistoryState() {
        // Remove any states after current index (if we've undone something)
        state.history = state.history.slice(0, state.historyIndex + 1);
        
        // Get canvas image data
        const imageData = state.ctx.getImageData(0, 0, state.canvas.width, state.canvas.height);
        state.history.push(imageData);
        state.historyIndex++;
        
        // Limit history size
        if (state.history.length > state.maxHistorySize) {
            state.history.shift();
            state.historyIndex--;
        }
        
        updateHistoryButtons();
    }

    function undo() {
        if (state.historyIndex > 0) {
            state.historyIndex--;
            const imageData = state.history[state.historyIndex];
            state.ctx.putImageData(imageData, 0, 0);
            updateHistoryButtons();
        }
    }

    function redo() {
        if (state.historyIndex < state.history.length - 1) {
            state.historyIndex++;
            const imageData = state.history[state.historyIndex];
            state.ctx.putImageData(imageData, 0, 0);
            updateHistoryButtons();
        }
    }

    function updateHistoryButtons() {
        elements.undoBtn.classList.toggle('disabled', state.historyIndex <= 0);
        elements.redoBtn.classList.toggle('disabled', state.historyIndex >= state.history.length - 1);
    }

    // ========================================
    // Canvas Redraw
    // ========================================
    function redrawCanvas() {
        // Clear canvas
        state.ctx.fillStyle = '#FFFFFF';
        state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
        
        // Apply transformations
        state.ctx.save();
        state.ctx.translate(state.panX, state.panY);
        state.ctx.scale(state.zoom, state.zoom);
        
        // Draw grid
        state.ctx.restore();
        drawGrid();
        
        // Restore transformations for drawing
        state.ctx.save();
        state.ctx.translate(state.panX, state.panY);
        state.ctx.scale(state.zoom, state.zoom);
        state.ctx.restore();
        
        // Draw minimap
        drawMinimap();
    }

    // ========================================
    // Canvas Actions
    // ========================================
    function clearCanvas() {
        if (!state.isConnected) {
            showNotification('Cannot clear - not connected to server', 'error');
            return;
        }
        
        if (confirm('Are you sure you want to clear the canvas? This will clear for all users.')) {
            state.socket.send(JSON.stringify({ type: 'clear' }));
            clearCanvasLocal();
            saveHistoryState();
        }
    }

    function clearCanvasLocal() {
        state.ctx.fillStyle = '#FFFFFF';
        state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
    }

    function downloadCanvas() {
        const link = document.createElement('a');
        link.download = 'whiteboard-' + new Date().toISOString().slice(0, 10) + '.png';
        link.href = state.canvas.toDataURL('image/png');
        link.click();
        showNotification('Canvas saved as PNG!', 'success');
    }

    function downloadCanvasPDF() {
        // Simple PDF export using canvas
        const canvas = state.canvas;
        const imgData = canvas.toDataURL('image/png');
        const width = canvas.width;
        const height = canvas.height;
        
        // Create a simple PDF structure (inline data)
        const pdfStr = 
            '%PDF-1.4\n' +
            '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
            '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
            '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 ' + width + ' ' + height + ']/Contents 4 0 R/Resources<<>>>>endobj\n' +
            '4 0 obj<</Length 44>>stream\nBT\n/F1 12 Tf\n100 100 Td\n(Download as PNG instead) Tj\nET\nendstream\nendobj\n' +
            'xref\n0 5\n' +
            '0000000000 65535 f\n' +
            '0000000009 00000 n\n' +
            '0000000058 00000 n\n' +
            '0000000115 00000 n\n' +
            '0000000214 00000 n\n' +
            'trailer<</Size 5/Root 1 0 R>>\nstartxref\n306\n%%EOF';
        
        // For now, just show a message and download as PNG instead
        showNotification('PDF export: Please use Save PNG option and convert to PDF separately', 'info');
        downloadCanvas();
    }

    // ========================================
    // UI Updates
    // ========================================
    function updateConnectionStatus(connected) {
        const status = elements.connectionStatus;
        const statusText = status.querySelector('.status-text');
        
        status.classList.remove('connected', 'disconnected');
        status.classList.add(connected ? 'connected' : 'disconnected');
        statusText.textContent = connected ? 'Connected' : 'Disconnected';
    }

    function updateUserCount(count) {
        elements.userCount.querySelector('.count').textContent = count;
    }

    function hideOverlay() {
        elements.canvasOverlay.classList.add('hidden');
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        elements.notifications.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ========================================
    // Keyboard Shortcuts
    // ========================================
    function handleKeyboard(e) {
        // Don't trigger if user is typing in an input
        if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
        
        // Handle Ctrl/Cmd + Z for undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            undo();
            return;
        }
        
        // Handle Ctrl/Cmd + Y or Shift+Ctrl+Z for redo
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            redo();
            return;
        }
        
        switch (e.key.toLowerCase()) {
            case 'p':
                selectTool('pen');
                break;
            case 'l':
                selectTool('line');
                break;
            case 'r':
                selectTool('rectangle');
                break;
            case 'c':
                if (!e.ctrlKey && !e.metaKey) {
                    selectTool('circle');
                }
                break;
            case 'a':
                if (!e.ctrlKey && !e.metaKey) {
                    selectTool('arrow');
                }
                break;
            case 'h':
                selectTool('highlighter');
                break;
            case 't':
                if (!e.ctrlKey && !e.metaKey) {
                    selectTool('text');
                }
                break;
            case 'e':
                selectTool('eraser');
                break;
            case 'g':
                state.showGrid = !state.showGrid;
                elements.gridToggle.classList.toggle('active', state.showGrid);
                redrawCanvas();
                break;
            case 'm':
                state.showMinimap = !state.showMinimap;
                elements.minimapToggle.classList.toggle('active', state.showMinimap);
                redrawCanvas();
                break;
            case '+':
            case '=':
                e.preventDefault();
                zoomCanvas(1.2);
                break;
            case '-':
            case '_':
                e.preventDefault();
                zoomCanvas(0.8);
                break;
            case '0':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    state.zoom = 1;
                    state.panX = 0;
                    state.panY = 0;
                    updateZoomDisplay();
                    redrawCanvas();
                }
                break;
            case 'delete':
            case 'backspace':
                if (e.target === state.canvas) {
                    e.preventDefault();
                    clearCanvas();
                }
                break;
            case '[':
                e.preventDefault();
                state.strokeWidth = Math.max(1, state.strokeWidth - 1);
                elements.strokeWidth.value = state.strokeWidth;
                elements.strokeValue.textContent = state.strokeWidth;
                break;
            case ']':
                e.preventDefault();
                state.strokeWidth = Math.min(50, state.strokeWidth + 1);
                elements.strokeWidth.value = state.strokeWidth;
                elements.strokeValue.textContent = state.strokeWidth;
                break;
        }
    }

    // ========================================
    // Start Application
    // ========================================
    document.addEventListener('DOMContentLoaded', init);

})();
