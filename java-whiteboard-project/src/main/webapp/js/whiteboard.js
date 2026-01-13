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
        WS_URL: 'ws://localhost:8080/whiteboard/whiteboard',
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
        
        // Authentication
        isLoggedIn: false,
        currentUser: null,
        userId: null,
        username: null,
        token: null,
        
        // History
        isReceivingHistory: false
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
        penTool: document.getElementById('penTool'),
        eraserTool: document.getElementById('eraserTool'),
        colorPicker: document.getElementById('colorPicker'),
        strokeWidth: document.getElementById('strokeWidth'),
        strokeValue: document.getElementById('strokeValue'),
        clearCanvas: document.getElementById('clearCanvas'),
        downloadCanvas: document.getElementById('downloadCanvas'),
        notifications: document.getElementById('notifications'),
        presetColors: document.querySelectorAll('.color-preset'),
        
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
        switchToLogin: document.getElementById('switchToLogin')
    };

    // ========================================
    // Initialization
    // ========================================
    function init() {
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
        state.ctx = state.canvas.getContext('2d');
        
        // Set canvas size
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Initial canvas setup
        state.ctx.lineCap = 'round';
        state.ctx.lineJoin = 'round';
    }

    function resizeCanvas() {
        const container = elements.canvasContainer;
        const rect = container.getBoundingClientRect();
        
        // Save current canvas content
        const imageData = state.ctx ? state.ctx.getImageData(0, 0, state.canvas.width, state.canvas.height) : null;
        
        // Resize canvas
        state.canvas.width = rect.width;
        state.canvas.height = rect.height;
        
        // Restore canvas settings
        state.ctx.lineCap = 'round';
        state.ctx.lineJoin = 'round';
        
        // Restore content if exists
        if (imageData) {
            state.ctx.putImageData(imageData, 0, 0);
        }
    }

    function initEventListeners() {
        // Canvas mouse events
        state.canvas.addEventListener('mousedown', startDrawing);
        state.canvas.addEventListener('mousemove', draw);
        state.canvas.addEventListener('mouseup', stopDrawing);
        state.canvas.addEventListener('mouseout', stopDrawing);
        
        // Touch events for mobile
        state.canvas.addEventListener('touchstart', handleTouchStart);
        state.canvas.addEventListener('touchmove', handleTouchMove);
        state.canvas.addEventListener('touchend', stopDrawing);
        
        // Tool buttons
        elements.penTool.addEventListener('click', () => selectTool('pen'));
        elements.eraserTool.addEventListener('click', () => selectTool('eraser'));
        
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
        
        // Actions
        elements.clearCanvas.addEventListener('click', clearCanvas);
        elements.downloadCanvas.addEventListener('click', downloadCanvas);
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
                    
                case 'clear':
                    clearCanvasLocal();
                    showNotification('Canvas cleared', 'info');
                    break;
                    
                case 'userCount':
                    updateUserCount(data.count);
                    break;
                    
                case 'historyStart':
                    state.isReceivingHistory = true;
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
            strokeWidth: state.currentTool === 'eraser' ? state.strokeWidth * 3 : state.strokeWidth
        };
        
        state.socket.send(JSON.stringify(event));
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
        if (state.isInRoom && !state.isApproved) return;
        
        state.isDrawing = true;
        const coords = getCanvasCoordinates(e);
        state.lastX = coords.x;
        state.lastY = coords.y;
    }

    function draw(e) {
        if (!state.isDrawing) return;
        if (state.isInRoom && !state.isApproved) return;
        
        const coords = getCanvasCoordinates(e);
        
        // Draw locally
        drawStroke(state.lastX, state.lastY, coords.x, coords.y, 
                   state.currentTool === 'eraser' ? '#FFFFFF' : state.currentColor,
                   state.currentTool === 'eraser' ? state.strokeWidth * 3 : state.strokeWidth);
        
        // Send to server
        sendDrawEvent(state.lastX, state.lastY, coords.x, coords.y);
        
        state.lastX = coords.x;
        state.lastY = coords.y;
    }

    function stopDrawing() {
        state.isDrawing = false;
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
            clientY: touch.clientY
        });
        draw(mouseEvent);
    }

    function drawStroke(x1, y1, x2, y2, color, width) {
        state.ctx.beginPath();
        state.ctx.moveTo(x1, y1);
        state.ctx.lineTo(x2, y2);
        state.ctx.strokeStyle = color;
        state.ctx.lineWidth = width;
        state.ctx.stroke();
        state.ctx.closePath();
    }

    function drawRemoteStroke(data) {
        const color = data.tool === 'eraser' ? '#FFFFFF' : data.color;
        const width = data.tool === 'eraser' ? data.strokeWidth * 3 : data.strokeWidth;
        drawStroke(data.x1, data.y1, data.x2, data.y2, color, width);
    }

    function getCanvasCoordinates(e) {
        const rect = state.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    // ========================================
    // Tool Functions
    // ========================================
    function selectTool(tool) {
        state.currentTool = tool;
        
        // Update UI
        elements.penTool.classList.toggle('active', tool === 'pen');
        elements.eraserTool.classList.toggle('active', tool === 'eraser');
        
        // Update cursor
        state.canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
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
        showNotification('Canvas saved!', 'success');
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
        if (e.target.tagName === 'INPUT') return;
        
        switch (e.key.toLowerCase()) {
            case 'p':
                selectTool('pen');
                break;
            case 'e':
                selectTool('eraser');
                break;
            case 'c':
                if (!e.ctrlKey && !e.metaKey) {
                    clearCanvas();
                }
                break;
            case 'd':
                downloadCanvas();
                break;
            case '[':
                state.strokeWidth = Math.max(1, state.strokeWidth - 1);
                elements.strokeWidth.value = state.strokeWidth;
                elements.strokeValue.textContent = state.strokeWidth;
                break;
            case ']':
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
