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
        WS_URL: 'ws://localhost:8082/whiteboard/whiteboard',
        RECONNECT_DELAY: 3000,
        MAX_RECONNECT_ATTEMPTS: 5,
        PING_INTERVAL: 30000,
        AUTO_SAVE_DEBOUNCE: 1500,
        AUTO_SAVE_INTERVAL: 20000
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
        historyEventCount: 0,
        lastReceivedCanvasSnapshot: null,
        shouldRestoreSnapshotAfterHistory: false,
        isApplyingRemoteCanvasState: false,
        
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
        ],
        
        // Boards Management
        boards: [],
        currentBoardId: null,
        currentBoardTitle: '',
        roomBoardTitle: '',
        editingBoardId: null,
        deletingBoardId: null,
        boardModalMode: 'default', // default | edit | room
        pendingRoomCreation: false,
        pendingRoomBoardId: null,
        pendingRoomBoardTitle: '',
        pendingRoomOptions: null,
        awaitingRoomSaveForRoom: false,
        queuedRoomBoardId: null,
        queuedRoomOptions: null,
        lastRoomShareSyncAt: 0,

        // Auto-save
        autoSaveTimer: null,
        autoSaveIntervalId: null,
        hasUnsavedChanges: false,
        lastAutoSaveAt: 0
    };

    // ========================================
    // DOM Elements
    // ========================================
    const elements = {
        canvas: document.getElementById('whiteboard'),
        canvasContainer: document.getElementById('canvasContainer'),
        canvasOverlay: document.getElementById('canvasOverlay'),
        connectionStatus: document.getElementById('connectionStatus'),
        saveStatus: document.getElementById('saveStatus'),
        userCount: document.getElementById('userCount'),
        sessionId: document.getElementById('sessionId'),
        homeBtn: document.getElementById('homeBtn'),
        
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
        roomBoardTitle: document.getElementById('roomBoardTitle'),
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
        switchToLogin: document.getElementById('switchToLogin'),
        
        // Boards Dashboard elements
        boardsDashboard: document.getElementById('boardsDashboard'),
        boardsGrid: document.getElementById('boardsGrid'),
        emptyState: document.getElementById('emptyState'),
        createNewBoardBtn: document.getElementById('createNewBoardBtn'),
        createFirstBoardBtn: document.getElementById('createFirstBoardBtn'),
        logoHome: document.getElementById('logoHome'),
        dashboardLogoutBtn: document.getElementById('dashboardLogoutBtn'),
        dashboardCreateRoomBtn: document.getElementById('dashboardCreateRoomBtn'),
        dashboardJoinRoomBtn: document.getElementById('dashboardJoinRoomBtn'),
        
        // Board Modal elements
        boardModal: document.getElementById('boardModal'),
        boardModalTitle: document.getElementById('boardModalTitle'),
        boardName: document.getElementById('boardName'),
        boardDescription: document.getElementById('boardDescription'),
        closeBoardModal: document.getElementById('closeBoardModal'),
        cancelBoardModal: document.getElementById('cancelBoardModal'),
        saveBoardBtn: document.getElementById('saveBoardBtn'),
        
        // Delete Modal elements
        deleteBoardModal: document.getElementById('deleteBoardModal'),
        deleteBoardName: document.getElementById('deleteBoardName'),
        closeDeleteModal: document.getElementById('closeDeleteModal'),
        cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
    };

    function initCustomTooltips(root = document) {
        let tooltip = document.getElementById('appTooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'appTooltip';
            tooltip.className = 'app-tooltip';
            document.body.appendChild(tooltip);
        }

        let activeTarget = null;

        const hideTooltip = () => {
            tooltip.classList.remove('visible');
            activeTarget = null;
        };

        const positionTooltip = (event, target) => {
            if (!activeTarget) return;
            const rect = target.getBoundingClientRect();
            let x = rect.left + rect.width / 2;
            let y = rect.top;

            if (event) {
                if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
                    x = event.clientX;
                    y = event.clientY;
                } else if (event.touches && event.touches[0]) {
                    x = event.touches[0].clientX;
                    y = event.touches[0].clientY;
                }
            }

            tooltip.style.left = `${Math.round(x)}px`;
            tooltip.style.top = `${Math.round(y)}px`;
        };

        const showTooltip = (event) => {
            const target = event.currentTarget;
            const label = target.dataset.tooltip;
            if (!label) return;
            tooltip.textContent = label;
            tooltip.classList.add('visible');
            activeTarget = target;
            positionTooltip(event.type === 'focus' ? null : event, target);
        };

        const targets = Array.from(root.querySelectorAll('[data-tooltip], [title]'))
            .filter((el) => {
                const label = el.getAttribute('data-tooltip') || el.getAttribute('title');
                return !!label && el.dataset.tooltipBound !== 'true';
            });

        targets.forEach((target) => {
            const label = target.getAttribute('data-tooltip') || target.getAttribute('title');
            target.dataset.tooltip = label;
            target.dataset.tooltipBound = 'true';
            target.removeAttribute('title');
            target.addEventListener('mouseenter', showTooltip);
            target.addEventListener('mousemove', (event) => positionTooltip(event, target));
            target.addEventListener('mouseleave', hideTooltip);
            target.addEventListener('focus', showTooltip);
            target.addEventListener('blur', hideTooltip);
            target.addEventListener('touchstart', (event) => {
                showTooltip(event);
                positionTooltip(event, target);
                setTimeout(hideTooltip, 1200);
            }, { passive: true });
        });

        if (document.body && document.body.dataset.tooltipScrollBound !== 'true') {
            document.addEventListener('scroll', hideTooltip, true);
            document.body.dataset.tooltipScrollBound = 'true';
        }
    }

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
        initWelcomeModal();
        initBoardsDashboard();
        initCustomTooltips();
        connectWebSocket();
        checkUrlForRoomCode();
        
        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);
        
        // Show dashboard if logged in
        if (state.isLoggedIn) {
            // Show dashboard immediately
            elements.boardsDashboard.classList.remove('hidden');
            startAutoSaveInterval();
            // Request boards list from server after connection
            setTimeout(() => {
                if (state.socket && state.socket.readyState === WebSocket.OPEN) {
                    requestBoardsList();
                }
            }, 500);
        }
    }

    // ========================================
    // Welcome Modal Functionality
    // ========================================
    function initWelcomeModal() {
        const welcomeModal = document.getElementById('welcomeModal');
        const continueAsGuestBtn = document.getElementById('continueAsGuest');
        const welcomeLoginBtn = document.getElementById('welcomeLogin');
        const guestBanner = document.getElementById('guestBanner');
        const closeGuestBanner = document.getElementById('closeGuestBanner');
        const guestLoginPrompt = document.getElementById('guestLoginPrompt');

        console.log('Initializing welcome modal...', {
            modal: !!welcomeModal,
            guestBtn: !!continueAsGuestBtn,
            loginBtn: !!welcomeLoginBtn,
            isLoggedIn: state.isLoggedIn,
            hasGuestSession: !!sessionStorage.getItem('whiteboard_guest')
        });

        // If user is logged in, hide both welcome modal and guest banner
        if (state.isLoggedIn) {
            if (welcomeModal) {
                welcomeModal.classList.add('hidden');
            }
            if (guestBanner) {
                guestBanner.classList.add('hidden');
            }
            // Clear any guest session
            sessionStorage.removeItem('whiteboard_guest');
            console.log('User is logged in - hiding welcome UI');
            return;
        }

        // Show welcome modal if not logged in and no guest session
        if (!sessionStorage.getItem('whiteboard_guest')) {
            if (welcomeModal) {
                welcomeModal.classList.remove('hidden');
                console.log('Welcome modal shown');
            }
            if (guestBanner) {
                guestBanner.classList.add('hidden');
            }
        } else {
            // Show guest banner if in guest mode
            if (welcomeModal) {
                welcomeModal.classList.add('hidden');
            }
            if (guestBanner) {
                guestBanner.classList.remove('hidden');
            }
        }

        // Continue as Guest button
        if (continueAsGuestBtn) {
            continueAsGuestBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Guest button clicked');
                
                // Set guest session flag immediately
                sessionStorage.setItem('whiteboard_guest', 'true');
                
                // Hide welcome modal immediately
                if (welcomeModal) {
                    welcomeModal.classList.add('hidden');
                }
                
                // Show guest banner
                if (guestBanner) {
                    guestBanner.classList.remove('hidden');
                }
                
                // Send guest mode request to server when available
                const sendGuestMode = () => {
                    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
                        state.socket.send(JSON.stringify({
                            type: 'guestMode'
                        }));
                        console.log('Guest mode message sent to server');
                    } else {
                        console.log('WebSocket not ready, will send on connect');
                    }
                };
                
                // Try to send immediately, or wait for connection
                sendGuestMode();
            });
            console.log('Guest button listener attached');
        } else {
            console.error('Continue as Guest button not found!');
        }

        // Welcome Login button
        if (welcomeLoginBtn) {
            welcomeLoginBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Login button clicked');
                
                if (welcomeModal) {
                    welcomeModal.classList.add('hidden');
                }
                
                // Show login modal
                if (elements.loginModal) {
                    elements.loginModal.classList.remove('hidden');
                    if (elements.loginUsername) {
                        elements.loginUsername.focus();
                    }
                } else {
                    console.error('Login modal not found');
                }
            });
            console.log('Login button listener attached');
        } else {
            console.error('Login button not found!');
        }

        // Close guest banner
        if (closeGuestBanner) {
            closeGuestBanner.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (guestBanner) {
                    guestBanner.classList.add('hidden');
                }
            });
        }

        // Guest login prompt button
        if (guestLoginPrompt) {
            guestLoginPrompt.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (guestBanner) {
                    guestBanner.classList.add('hidden');
                }
                if (elements.loginModal) {
                    elements.loginModal.classList.remove('hidden');
                    if (elements.loginUsername) {
                        elements.loginUsername.focus();
                    }
                }
            });
        }
    }

    // ========================================
    // Boards Dashboard Functionality
    // ========================================
    function initBoardsDashboard() {
        // Logo click - return to dashboard
        if (elements.logoHome) {
            elements.logoHome.addEventListener('click', () => {
                if (state.isLoggedIn) {
                    showBoardsDashboard();
                }
            });
        }

        // Create new board buttons
        if (elements.createNewBoardBtn) {
            elements.createNewBoardBtn.addEventListener('click', openCreateBoardModal);
        }
        if (elements.createFirstBoardBtn) {
            elements.createFirstBoardBtn.addEventListener('click', openCreateBoardModal);
        }
        if (elements.dashboardCreateRoomBtn) {
            elements.dashboardCreateRoomBtn.addEventListener('click', () => {
                createRoom({ fromDashboard: true, forceNewBoard: true });
            });
        }
        if (elements.dashboardJoinRoomBtn) {
            elements.dashboardJoinRoomBtn.addEventListener('click', () => {
                hideBoardsDashboard();
                showJoinModal();
            });
        }

        // Board modal controls
        if (elements.closeBoardModal) {
            elements.closeBoardModal.addEventListener('click', closeBoardModal);
        }
        if (elements.cancelBoardModal) {
            elements.cancelBoardModal.addEventListener('click', closeBoardModal);
        }
        if (elements.saveBoardBtn) {
            elements.saveBoardBtn.addEventListener('click', handleSaveBoard);
        }
        
        // Board name enter key
        if (elements.boardName) {
            elements.boardName.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveBoard();
                }
            });
        }

        // Delete modal controls
        if (elements.closeDeleteModal) {
            elements.closeDeleteModal.addEventListener('click', closeDeleteModal);
        }
        if (elements.cancelDeleteBtn) {
            elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
        }
        if (elements.confirmDeleteBtn) {
            elements.confirmDeleteBtn.addEventListener('click', confirmDeleteBoard);
        }
        
        // Close modals on backdrop click
        if (elements.boardModal) {
            elements.boardModal.addEventListener('click', (e) => {
                if (e.target === elements.boardModal || e.target.classList.contains('modal-backdrop')) {
                    closeBoardModal();
                }
            });
        }
        if (elements.deleteBoardModal) {
            elements.deleteBoardModal.addEventListener('click', (e) => {
                if (e.target === elements.deleteBoardModal || e.target.classList.contains('modal-backdrop')) {
                    closeDeleteModal();
                }
            });
        }
    }

    function showBoardsDashboard() {
        elements.boardsDashboard.classList.remove('hidden');
        document.body.style.overflow = 'auto';
        requestBoardsList();
    }

    function hideBoardsDashboard() {
        elements.boardsDashboard.classList.add('hidden');
        document.body.style.overflow = 'hidden';
    }

    function requestBoardsList() {
        if (state.socket && state.socket.readyState === WebSocket.OPEN) {
            state.socket.send(JSON.stringify({
                type: 'getBoards'
            }));
            console.log('Requested boards list');
        }
    }

    function renderBoards(boards) {
        state.boards = boards;
        
        if (!boards || boards.length === 0) {
            elements.boardsGrid.innerHTML = '';
            elements.emptyState.classList.remove('hidden');
            return;
        }

        elements.emptyState.classList.add('hidden');
        
        elements.boardsGrid.innerHTML = boards.map(board => `
            <div class="board-card" data-board-id="${board.id}">
                <div class="board-thumbnail">
                    ${board.thumbnail || '🎨'}
                </div>
                <div class="board-info">
                    <div class="board-header">
                        <h3 class="board-title">${escapeHtml(board.title)}</h3>
                        <div class="board-actions">
                            <button class="board-menu-btn" onclick="toggleBoardMenu(event, ${board.id})">⋮</button>
                            <div class="board-menu" id="menu-${board.id}">
                                <button class="board-menu-item" onclick="openBoard(${board.id})">
                                    <span>📂</span> Open
                                </button>
                                <button class="board-menu-item" onclick="openRenameBoardModal(${board.id}, '${escapeHtml(board.title)}', '${escapeHtml(board.description || '')}')">
                                    <span>✏️</span> Rename
                                </button>
                                <button class="board-menu-item" onclick="duplicateBoard(${board.id})">
                                    <span>📋</span> Duplicate
                                </button>
                                <button class="board-menu-item danger" onclick="openDeleteBoardModal(${board.id}, '${escapeHtml(board.title)}')">
                                    <span>🗑️</span> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                    ${board.description ? `<p class="board-description">${escapeHtml(board.description)}</p>` : ''}
                    <div class="board-meta">
                        <span>Updated ${formatDate(board.updatedAt)}</span>
                    </div>
                </div>
            </div>
        `).join('');

        initCustomTooltips(elements.boardsGrid);

        // Add click listeners to board cards
        document.querySelectorAll('.board-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't open if clicking menu button or menu items
                if (!e.target.closest('.board-actions')) {
                    const boardId = parseInt(card.dataset.boardId);
                    openBoard(boardId);
                }
            });
        });
        
        // Close menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.board-actions')) {
                document.querySelectorAll('.board-menu.show').forEach(menu => {
                    menu.classList.remove('show');
                });
            }
        });
    }

    function applyBoardCanvasSnapshot(canvasData) {
        if (!canvasData) {
            return false;
        }

        state.lastReceivedCanvasSnapshot = canvasData;
        const img = new Image();
        img.onload = () => {
            state.isApplyingRemoteCanvasState = true;
            try {
                state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
                state.ctx.drawImage(img, 0, 0);
                state.history = [];
                state.historyIndex = -1;
                saveHistoryState();
                state.hasUnsavedChanges = false;
                updateSaveStatus('saved');
            } finally {
                state.isApplyingRemoteCanvasState = false;
            }
        };
        img.onerror = () => {
            console.error('Failed to load board image');
            state.ctx.fillStyle = '#FFFFFF';
            state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
            saveHistoryState();
            state.hasUnsavedChanges = false;
        };
        img.src = canvasData;
        return true;
    }

    function openCreateBoardModal(mode = 'default') {
        if (mode && typeof mode.preventDefault === 'function') {
            mode.preventDefault();
            mode = 'default';
        }
        const resolvedMode = typeof mode === 'string' ? mode : 'default';
        state.editingBoardId = null;
        state.boardModalMode = resolvedMode;
        const isRoomFlow = resolvedMode === 'room';
        elements.boardModalTitle.textContent = isRoomFlow ? 'Create Board for Room' : 'Create New Board';
        elements.boardName.value = '';
        elements.boardDescription.value = '';
        elements.saveBoardBtn.textContent = isRoomFlow ? 'Create Board & Start Room' : 'Create Board';
        elements.boardModal.classList.remove('hidden');
        elements.boardName.focus();
    }

    function openRenameBoardModal(boardId, title, description) {
        state.editingBoardId = boardId;
        state.boardModalMode = 'edit';
        elements.boardModalTitle.textContent = 'Edit Board';
        elements.boardName.value = unescapeHtml(title);
        elements.boardDescription.value = unescapeHtml(description);
        elements.saveBoardBtn.textContent = 'Save Changes';
        elements.boardModal.classList.remove('hidden');
        elements.boardName.focus();
    }

    function closeBoardModalInternal(preserveRoomFlow) {
        elements.boardModal.classList.add('hidden');
        state.editingBoardId = null;
        if (state.boardModalMode === 'room' && !preserveRoomFlow) {
            state.pendingRoomCreation = false;
            state.pendingRoomBoardId = null;
            state.pendingRoomBoardTitle = '';
        }
        state.boardModalMode = 'default';
    }

    function closeBoardModal(event) {
        if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
        }
        closeBoardModalInternal(false);
    }

    function handleSaveBoard() {
        const title = elements.boardName.value.trim();
        
        console.log('handleSaveBoard called', { title, editingBoardId: state.editingBoardId });
        
        if (!title) {
            alert('Please enter a board name');
            elements.boardName.focus();
            return;
        }

        const description = elements.boardDescription.value.trim();
        const isRoomFlow = state.boardModalMode === 'room';
        if (isRoomFlow) {
            state.pendingRoomBoardTitle = title;
        }

        if (state.editingBoardId) {
            // Update existing board
            console.log('Updating board:', state.editingBoardId);
            if (state.socket && state.socket.readyState === WebSocket.OPEN) {
                state.socket.send(JSON.stringify({
                    type: 'updateBoardTitle',
                    boardId: state.editingBoardId,
                    title: title,
                    description: description
                }));
            } else {
                console.error('WebSocket not connected');
                alert('Connection lost. Please try again.');
                return;
            }
        } else {
            // Create new board
            console.log('Creating new board:', { title, description });
            if (state.socket && state.socket.readyState === WebSocket.OPEN) {
                state.socket.send(JSON.stringify({
                    type: 'createBoard',
                    title: title,
                    description: description
                }));
                console.log('Create board message sent');
                if (isRoomFlow) {
                    showNotification('Creating board for your room...', 'info');
                }
            } else {
                console.error('WebSocket not connected');
                alert('Connection lost. Please try again.');
                return;
            }
        }

        if (isRoomFlow) {
            closeBoardModalInternal(true);
        } else {
            closeBoardModalInternal(false);
        }
    }

    function openBoard(boardId) {
        if (state.socket && state.socket.readyState === WebSocket.OPEN) {
            state.socket.send(JSON.stringify({
                type: 'openBoard',
                boardId: boardId
            }));
            state.currentBoardId = boardId;
            hideBoardsDashboard();
        }
    }

    function duplicateBoard(boardId) {
        if (state.socket && state.socket.readyState === WebSocket.OPEN) {
            state.socket.send(JSON.stringify({
                type: 'duplicateBoard',
                boardId: boardId
            }));
        }
    }

    function openDeleteBoardModal(boardId, title) {
        state.deletingBoardId = boardId;
        elements.deleteBoardName.textContent = unescapeHtml(title);
        elements.deleteBoardModal.classList.remove('hidden');
    }

    function closeDeleteModal() {
        elements.deleteBoardModal.classList.add('hidden');
        state.deletingBoardId = null;
    }

    function confirmDeleteBoard() {
        if (state.deletingBoardId && state.socket && state.socket.readyState === WebSocket.OPEN) {
            state.socket.send(JSON.stringify({
                type: 'deleteBoard',
                boardId: state.deletingBoardId
            }));
        }
        closeDeleteModal();
    }

    function toggleBoardMenu(event, boardId) {
        event.stopPropagation();
        const menu = document.getElementById(`menu-${boardId}`);
        const allMenus = document.querySelectorAll('.board-menu');
        
        allMenus.forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });
        
        menu.classList.toggle('show');
    }

    // Utility functions
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function unescapeHtml(text) {
        const div = document.createElement('div');
        div.innerHTML = text;
        return div.textContent;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        if (days < 365) return `${Math.floor(days / 30)} months ago`;
        return date.toLocaleDateString();
    }

    // Make functions globally accessible for onclick handlers
    window.toggleBoardMenu = toggleBoardMenu;
    window.openBoard = openBoard;
    window.openRenameBoardModal = openRenameBoardModal;
    window.duplicateBoard = duplicateBoard;
    window.openDeleteBoardModal = openDeleteBoardModal;

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
        const container = elements.canvasContainer;
        
        // Fixed canvas size for scrolling
        const width = 2000;
        const height = 1500;

        // Save current canvas content
        const imageData = state.ctx ? state.ctx.getImageData(0, 0, state.canvas.width, state.canvas.height) : null;

        // Set fixed canvas size
        state.canvas.width = width;
        state.canvas.height = height;

        // Set container to show scrollbars
        container.style.width = '100%';
        container.style.height = '100%';

        // Restore canvas settings
        state.ctx.lineCap = 'round';
        state.ctx.lineJoin = 'round';
        
        // Restore content if exists
        if (imageData) {
            // For fixed size, just clear for now
            state.ctx.fillStyle = '#FFFFFF';
            state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
        } else {
            // Initial setup - clear canvas
            state.ctx.fillStyle = '#FFFFFF';
            state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
            // Save initial blank canvas state for undo functionality
            saveHistoryState();
        }

        updateZoomDisplay();
        applyCanvasTransform();
    }

    function initEventListeners() {
        if (elements.homeBtn) {
            elements.homeBtn.addEventListener('click', goHome);
        }
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
        
        if (elements.snapToggle) {
            elements.snapToggle.addEventListener('click', () => {
                state.snapToGrid = !state.snapToGrid;
                elements.snapToggle.classList.toggle('active', state.snapToGrid);
            });
        }
        
        if (elements.minimapToggle) {
            elements.minimapToggle.addEventListener('click', () => {
                state.showMinimap = !state.showMinimap;
                elements.minimapToggle.classList.toggle('active', state.showMinimap);
                redrawCanvas();
            });
        }
        
        // Secondary toolbar is now always visible - no toggle needed
        
        // Zoom controls
        elements.zoomIn.addEventListener('click', () => zoomCanvas(1.2));
        elements.zoomOut.addEventListener('click', () => zoomCanvas(0.8));
        elements.zoomReset.addEventListener('click', () => {
            state.zoom = 1;
            state.panX = 0;
            state.panY = 0;
            updateZoomDisplay();
            applyCanvasTransform();
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
        if (elements.dashboardLogoutBtn) {
            elements.dashboardLogoutBtn.addEventListener('click', handleLogout);
        }

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

    function clearStoredAuth() {
        // Reset state locally
        state.isLoggedIn = false;
        state.currentUser = null;
        state.userId = null;
        state.username = '';
        state.token = null;
        state.currentBoardId = null;

        if (state.autoSaveTimer) {
            clearTimeout(state.autoSaveTimer);
            state.autoSaveTimer = null;
        }
        if (state.autoSaveIntervalId) {
            clearInterval(state.autoSaveIntervalId);
            state.autoSaveIntervalId = null;
        }
        state.hasUnsavedChanges = false;

        // Clear authentication state from localStorage
        localStorage.removeItem('whiteboard_userId');
        localStorage.removeItem('whiteboard_username');
        localStorage.removeItem('whiteboard_token');

        // Update UI
        updateAuthUI();
    }

    function handleLogout() {
        // Send logout request to WebSocket
        if (state.socket && state.socket.readyState === WebSocket.OPEN) {
            state.socket.send(JSON.stringify({
                type: 'logout'
            }));
        }
        
        clearStoredAuth();
        // Notification will be shown by server response
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

    function startAutoSaveInterval() {
        if (state.autoSaveIntervalId) return;
        state.autoSaveIntervalId = setInterval(() => {
            if (state.hasUnsavedChanges) {
                performAutoSave('interval');
            }
        }, CONFIG.AUTO_SAVE_INTERVAL);
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

        // Restore authenticated session after reconnect
        if (state.isLoggedIn && state.token) {
            state.socket.send(JSON.stringify({
                type: 'restoreSession',
                token: state.token
            }));
        } else if (sessionStorage.getItem('whiteboard_guest')) {
            state.socket.send(JSON.stringify({ type: 'guestMode' }));
        }
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
                    
                    // Clear guest session if exists
                    sessionStorage.removeItem('whiteboard_guest');
                    
                    // Hide guest banner
                    const guestBanner = document.getElementById('guestBanner');
                    if (guestBanner) {
                        guestBanner.classList.add('hidden');
                    }
                    
                    updateAuthUI();
                    elements.loginModal.classList.add('hidden');
                    showNotification(`Welcome, ${data.username}!`, 'success');
                    startAutoSaveInterval();
                    
                    // Show boards dashboard
                    showBoardsDashboard();
                    break;

                case 'sessionRestored':
                    state.isLoggedIn = true;
                    state.userId = data.userId;
                    state.username = data.username;
                    state.token = data.token || state.token;
                    state.currentUser = {
                        id: data.userId,
                        username: data.username
                    };

                    // Refresh auth UI and dashboard
                    updateAuthUI();
                    startAutoSaveInterval();
                    showBoardsDashboard();
                    requestBoardsList();
                    break;

                case 'sessionRestoreFailed':
                    clearStoredAuth();
                    showNotification(data.message || 'Session expired. Please log in again.', 'error');
                    if (elements.loginModal) {
                        elements.loginModal.classList.remove('hidden');
                        if (elements.loginUsername) {
                            elements.loginUsername.focus();
                        }
                    }
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
                
                case 'guestModeActivated':
                    console.log('Guest mode activated:', data);
                    showNotification('Guest mode activated. Work will not be saved.', 'info');
                    break;
                
                // Board Management
                case 'boardsList':
                    renderBoards(data.boards);
                    break;
                    
                case 'boardCreated':
                    showNotification('Board created successfully!', 'success');
                    requestBoardsList();
                    if (data.boardId) {
                        // Optionally open the newly created board
                        openBoard(data.boardId);
                    }
                    break;
                    
                case 'boardOpened':
                    console.log('Board opened:', data);
                    if (data.boardId) {
                        state.currentBoardId = data.boardId;
                    }
                    if (data.title) {
                        state.currentBoardTitle = data.title;
                    }
                    const boardImage = data.canvasData || data.data;
                    if (!applyBoardCanvasSnapshot(boardImage)) {
                        // Clear canvas for new board
                        state.ctx.fillStyle = '#FFFFFF';
                        state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
                        saveHistoryState();
                    }
                    if (state.isRoomOwner) {
                        state.roomBoardTitle = state.currentBoardTitle;
                    }
                    if (state.pendingRoomCreation) {
                        finalizePendingRoomCreation();
                    }
                    state.hasUnsavedChanges = false;
                    hideBoardsDashboard();
                    updateRoomUI();
                    showNotification('Board opened', 'success');
                    break;

                case 'boardSaved':
                    updateSaveStatus('saved');
                    state.hasUnsavedChanges = false;
                    if (state.awaitingRoomSaveForRoom && state.queuedRoomBoardId) {
                        const queuedBoardId = state.queuedRoomBoardId;
                        const queuedOptions = state.queuedRoomOptions || {};
                        state.awaitingRoomSaveForRoom = false;
                        state.queuedRoomBoardId = null;
                        state.queuedRoomOptions = null;
                        const nextOptions = Object.assign({}, queuedOptions, { skipSync: true });
                        sendCreateRoomRequest(queuedBoardId, nextOptions);
                    }
                    break;
                    
                case 'boardUpdated':
                    showNotification('Board updated successfully!', 'success');
                    requestBoardsList();
                    break;

                case 'boardTitleUpdated':
                    if (data.boardId && state.currentBoardId && Number(data.boardId) === Number(state.currentBoardId)) {
                        if (data.title) {
                            state.currentBoardTitle = data.title;
                            if (state.isInRoom && state.isApproved) {
                                state.roomBoardTitle = data.title;
                            }
                            updateRoomUI();
                        }
                    }
                    requestBoardsList();
                    showNotification('Board title updated', 'success');
                    break;
                    
                case 'boardDeleted':
                    showNotification('Board deleted', 'success');
                    requestBoardsList();
                    break;
                    
                case 'boardDuplicated':
                    showNotification('Board duplicated successfully!', 'success');
                    requestBoardsList();
                    break;

                case 'welcome':
                    state.sessionId = data.sessionId;
                    elements.sessionId.textContent = data.sessionId.substring(0, 8) + '...';
                    break;
                    
                case 'draw':
                    if (state.isReceivingHistory) {
                        state.historyEventCount++;
                    }
                    drawRemoteStroke(data);
                    break;
                    
                case 'shape':
                    if (state.isReceivingHistory) {
                        state.historyEventCount++;
                    }
                    drawRemoteShape(data);
                    break;
                    
                case 'text':
                    if (state.isReceivingHistory) {
                        state.historyEventCount++;
                    }
                    if (!matchesCurrentBoard(data.boardId)) {
                        break;
                    }
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
                    if (state.isReceivingHistory) {
                        state.historyEventCount++;
                    }
                    const sameBoard = !data.boardId || !state.currentBoardId || Number(data.boardId) === Number(state.currentBoardId);
                    const sameRoom = !data.roomCode || !state.roomCode || data.roomCode === state.roomCode;
                    if (sameBoard && sameRoom) {
                        clearCanvasLocal();
                        saveHistoryState();
                        showNotification('Canvas cleared', 'info');
                    }
                    break;
                    
                case 'userCount':
                    updateUserCount(data.count);
                    break;
                    
                case 'historyStart':
                    state.isReceivingHistory = true;
                    state.historyEventCount = 0;
                    // Clear canvas before loading history
                    state.ctx.fillStyle = '#FFFFFF';
                    state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
                    break;
                    
                case 'historyEnd':
                    state.isReceivingHistory = false;
                    if (state.shouldRestoreSnapshotAfterHistory && state.historyEventCount === 0 && state.lastReceivedCanvasSnapshot) {
                        applyBoardCanvasSnapshot(state.lastReceivedCanvasSnapshot);
                    }
                    if (state.historyEventCount > 0) {
                        state.lastReceivedCanvasSnapshot = null;
                    }
                    state.shouldRestoreSnapshotAfterHistory = false;
                    state.historyEventCount = 0;
                    showNotification('Canvas history loaded', 'success');
                    break;

                case 'canvasState':
                    if (!matchesCurrentBoard(data.boardId)) {
                        break;
                    }
                    if (data.canvasData) {
                        applyBoardCanvasSnapshot(data.canvasData);
                    }
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
                    
                case 'leftRoom': {
                    const wasOwner = state.isRoomOwner;
                    const wasInRoom = state.isInRoom;
                    resetRoomState();
                    if (wasInRoom) {
                        showBoardsDashboard();
                    }
                    showNotification('You left the room', 'info');
                    break;
                }
                    
                case 'error':
                    // Check if it's a save-related error
                    if (data.message && data.message.toLowerCase().includes('save')) {
                        updateSaveStatus('error');
                    }
                    // Handle auth errors in modals
                    if (!elements.loginModal.classList.contains('hidden')) {
                        showAuthMessage(elements.loginMessage, data.message, 'error');
                    } else if (!elements.registerModal.classList.contains('hidden')) {
                        showAuthMessage(elements.registerMessage, data.message, 'error');
                    } else {
                        showNotification(data.message, 'error');
                    }
                    if (state.awaitingRoomSaveForRoom && state.queuedRoomBoardId) {
                        const queuedBoardId = state.queuedRoomBoardId;
                        const queuedOptions = state.queuedRoomOptions || {};
                        state.awaitingRoomSaveForRoom = false;
                        state.queuedRoomBoardId = null;
                        state.queuedRoomOptions = null;
                        const retryOptions = Object.assign({}, queuedOptions, { skipSync: true });
                        sendCreateRoomRequest(queuedBoardId, retryOptions);
                    }
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
            username: state.username || 'Anonymous',
            boardId: state.currentBoardId || null
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

    function startCreateRoomFlow() {
        state.pendingRoomCreation = true;
        state.pendingRoomBoardId = null;
        state.pendingRoomBoardTitle = '';
        openCreateBoardModal('room');
    }

    function sendCreateRoomRequest(boardId, options = {}) {
        if (!boardId) {
            showNotification('Open or create a board before starting a room.', 'warning');
            return;
        }

        const numericBoardId = Number(boardId);
        if (!Number.isFinite(numericBoardId) || numericBoardId <= 0) {
            showNotification('Could not determine the board to share.', 'error');
            return;
        }

        state.currentBoardId = numericBoardId;
        const titleForRoom = state.pendingRoomBoardTitle || state.currentBoardTitle || state.roomBoardTitle;
        if (titleForRoom) {
            state.roomBoardTitle = titleForRoom;
        }

        if (options.skipSync !== true) {
            const syncOptions = Object.assign({}, options, { forceSync: true });
            const waitingForSave = syncBoardStateForRoomShare(numericBoardId, syncOptions);
            if (waitingForSave) {
                return;
            }
        }

        dispatchCreateRoom(numericBoardId);
    }

    function dispatchCreateRoom(boardId) {
        state.awaitingRoomSaveForRoom = false;
        state.queuedRoomBoardId = null;
        state.queuedRoomOptions = null;

        sendMessage({
            type: 'createRoom',
            boardId: boardId
        });
    }

    function finalizePendingRoomCreation() {
        if (!state.pendingRoomCreation) {
            return;
        }
        const boardId = state.pendingRoomBoardId || state.currentBoardId;
        if (!boardId) {
            return;
        }

        if (state.pendingRoomBoardTitle) {
            state.currentBoardTitle = state.pendingRoomBoardTitle;
        }

        const pendingOptions = state.pendingRoomOptions || {};
        sendCreateRoomRequest(boardId, pendingOptions);
        state.pendingRoomCreation = false;
        state.pendingRoomBoardId = null;
        state.pendingRoomBoardTitle = '';
        state.pendingRoomOptions = null;
    }
    function sendCursorPosition(x, y) {
        if (!state.isConnected || !state.socket || !state.username) return;

        // Convert canvas coordinates to screen coordinates before sending
        const rect = state.canvas.getBoundingClientRect();
        const screenX = x + rect.left;
        const screenY = y + rect.top;

        sendMessage({
            type: 'cursor',
            x: screenX,
            y: screenY,
            username: state.username,
            sessionId: state.sessionId
        });
    }

    function updateUserCursor(data) {
        const cursorId = 'cursor-' + data.sessionId;
        let cursorEl = document.getElementById(cursorId);
        
        if (!cursorEl) {
        state.pendingRoomCreation = false;
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
    function handleRoomCreated(data) {
        state.roomCode = data.roomCode;
        state.isRoomOwner = true;
        state.isInRoom = true;
        state.isApproved = true;
        if (typeof data.boardId === 'number') {
            state.currentBoardId = data.boardId;
        }
        if (data.boardTitle) {
            state.roomBoardTitle = data.boardTitle;
        } else if (state.currentBoardTitle) {
            state.roomBoardTitle = state.currentBoardTitle;
        }
        
        updateRoomUI();
        showNotification('Room created! Share the code to invite others.', 'success');
        showShareModal();
    }

    function showJoinModal() {
        if (state.isLoggedIn && state.username) {
            elements.joinUsername.value = state.username;
            elements.joinUsername.readOnly = true;
            elements.joinUsername.classList.add('readonly');
        } else {
            elements.joinUsername.readOnly = false;
            elements.joinUsername.classList.remove('readonly');
            elements.joinUsername.value = '';
        }
        elements.joinModal.classList.remove('hidden');
        elements.joinRoomCode.focus();
    }

    function hideJoinModal() {
        elements.joinModal.classList.add('hidden');
        elements.joinRoomCode.value = '';
        elements.joinUsername.readOnly = false;
        elements.joinUsername.classList.remove('readonly');
        elements.joinUsername.value = '';
    }

    function joinRoom() {
        const roomCode = elements.joinRoomCode.value.trim().toUpperCase();
        const username = (state.isLoggedIn && state.username)
            ? state.username
            : (elements.joinUsername.value.trim() || 'Anonymous');
        
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
        state.isInRoom = true;
        state.isRoomOwner = false;
        if (data.roomCode) {
            state.roomCode = data.roomCode;
        }
        if (typeof data.boardId === 'number') {
            state.currentBoardId = data.boardId;
        }
        if (data.boardTitle) {
            state.currentBoardTitle = data.boardTitle;
            state.roomBoardTitle = data.boardTitle;
        } else if (!state.roomBoardTitle && state.currentBoardTitle) {
            state.roomBoardTitle = state.currentBoardTitle;
        }
        if (data.canvasData) {
            state.shouldRestoreSnapshotAfterHistory = true;
            state.historyEventCount = 0;
            applyBoardCanvasSnapshot(data.canvasData);
        } else {
            state.shouldRestoreSnapshotAfterHistory = false;
            state.lastReceivedCanvasSnapshot = null;
        }

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
        const wasOwner = state.isRoomOwner;
        const wasInRoom = state.isInRoom;
        elements.waitingModal.classList.add('hidden');
        elements.requestModal.classList.add('hidden');
        showNotification(data.reason || 'Room has been closed', 'warning');
        resetRoomState();
        if (wasInRoom) {
            showBoardsDashboard();
        }
    }

    function resetRoomState() {
        state.roomCode = null;
        state.isRoomOwner = false;
        state.isInRoom = false;
        state.isApproved = false;
        state.pendingRequests = [];
        state.currentRequest = null;
        state.roomBoardTitle = '';
        state.pendingRoomCreation = false;
        state.pendingRoomOptions = null;
        state.awaitingRoomSaveForRoom = false;
        state.queuedRoomBoardId = null;
        state.queuedRoomOptions = null;
        
        updateRoomUI();
    }

    function updateRoomUI() {
        const inRoom = state.isInRoom && state.isApproved;
        const hasBoardTitle = inRoom && !!state.roomBoardTitle;

        if (elements.roomBadge) {
            elements.roomBadge.classList.toggle('hidden', !inRoom);
        }
        if (elements.roomCodeDisplay) {
            elements.roomCodeDisplay.textContent = state.roomCode || '-';
        }
        if (elements.roomBoardTitle) {
            elements.roomBoardTitle.textContent = hasBoardTitle ? state.roomBoardTitle : '';
            elements.roomBoardTitle.classList.toggle('hidden', !hasBoardTitle);
        }
        if (elements.copyRoomCode) {
            elements.copyRoomCode.disabled = !inRoom;
            elements.copyRoomCode.classList.toggle('hidden', !inRoom);
        }
        if (elements.leaveRoomBtn) {
            elements.leaveRoomBtn.classList.toggle('hidden', !inRoom);
            elements.leaveRoomBtn.disabled = !inRoom;
        }
        if (elements.shareRoomBtn) {
            elements.shareRoomBtn.classList.toggle('hidden', !inRoom);
            elements.shareRoomBtn.disabled = !inRoom;
        }
        if (elements.createRoomBtn) {
            const showCreate = !state.isInRoom;
            elements.createRoomBtn.classList.toggle('hidden', !showCreate);
            elements.createRoomBtn.disabled = !showCreate || state.pendingRoomCreation;
            elements.createRoomBtn.classList.toggle('loading', state.pendingRoomCreation);
        }
        if (elements.joinRoomBtn) {
            elements.joinRoomBtn.disabled = state.pendingRoomCreation || state.isInRoom;
        }
        if (elements.pendingRequests) {
            const showPending = state.isRoomOwner && state.pendingRequests.length > 0;
            elements.pendingRequests.classList.toggle('hidden', !showPending);
            const countEl = elements.pendingRequests.querySelector('.pending-count');
            if (countEl) {
                countEl.textContent = state.pendingRequests.length;
            }
        }
    }

    function createRoom(options = {}) {
        const forceNewBoard = options.forceNewBoard === true;
        const fromDashboard = options.fromDashboard === true;

        if (state.isInRoom && state.isApproved) {
            showNotification('You already have an active room.', 'info');
            return;
        }
        if (state.pendingRoomCreation) {
            showNotification('Finish creating the board for this room first.', 'info');
            return;
        }

        if (fromDashboard) {
            hideBoardsDashboard();
        }

        if (forceNewBoard || !state.currentBoardId) {
            state.pendingRoomOptions = Object.assign({}, options);
            startCreateRoomFlow();
            return;
        }

        sendCreateRoomRequest(state.currentBoardId, options);
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
        
        // Save history state for drawing tools (pen, eraser, highlighter)
        if (['pen', 'eraser', 'highlighter'].includes(state.currentTool)) {
            saveHistoryState();
        }
        // For shapes, mark the start point and save canvas state
        else if (['line', 'rectangle', 'circle', 'arrow'].includes(state.currentTool)) {
            state.shapeStart = { x: coords.x, y: coords.y };
            state.shapePreviewActive = true;
            state.shapePreviewData = state.ctx.getImageData(0, 0, state.canvas.width, state.canvas.height);
            saveHistoryState();
        } else if (state.currentTool === 'text') {
            createTextInput(coords.x, coords.y, e.clientX, e.clientY);
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
            applyCanvasTransform();
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
        let didModify = false;
        let historySaved = false;
        
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
                    constraint: state.shapeConstraint,
                    username: state.username || 'Anonymous',
                    boardId: state.currentBoardId || null
                };
                
                if (state.socket && state.socket.readyState === WebSocket.OPEN) {
                    state.socket.send(JSON.stringify(shapeData));
                }
                
                saveHistoryState();
                historySaved = true;
                didModify = true;
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

        if (['pen', 'eraser', 'highlighter'].includes(state.currentTool)) {
            didModify = true;
        }

        if (didModify) {
            if (!historySaved) {
                saveHistoryState();
            }
            markDirty();
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
        if (!matchesCurrentBoard(data.boardId)) {
            return;
        }
        if (data.tool === 'eraser') {
            drawStroke(data.x1, data.y1, data.x2, data.y2, '#FFFFFF', data.strokeWidth * 3, 'solid');
        } else if (data.tool === 'highlighter') {
            drawHighlighter(data.x1, data.y1, data.x2, data.y2, data.color, data.strokeWidth);
        } else {
            drawStroke(data.x1, data.y1, data.x2, data.y2, data.color, data.strokeWidth, data.lineStyle || 'solid');
        }
    }

    function drawRemoteShape(data) {
        if (!matchesCurrentBoard(data.boardId)) {
            return;
        }
        switch(data.tool) {
            case 'line':
                drawLine(data.x1, data.y1, data.x2, data.y2, data.color, data.strokeWidth, data.lineStyle || 'solid');
                break;
            case 'rectangle':
                drawRectangle(data.x1, data.y1, data.x2, data.y2, data.color, data.strokeWidth, data.constraint);
                break;
            case 'circle':
                drawCircle(data.x1, data.y1, data.x2, data.y2, data.color, data.strokeWidth, data.constraint);
                break;
            case 'arrow':
                drawArrow(data.x1, data.y1, data.x2, data.y2, data.color, data.strokeWidth, data.lineStyle || 'solid');
                break;
        }
    }

    function matchesCurrentBoard(eventBoardId) {
        if (eventBoardId === undefined) {
            return true;
        }
        if (eventBoardId === null) {
            return !state.currentBoardId;
        }
        if (!state.currentBoardId) {
            return true;
        }
        return Number(eventBoardId) === Number(state.currentBoardId);
    }

    function getCanvasCoordinates(e) {
        const rect = state.canvas.getBoundingClientRect();
        let x = (e.clientX - rect.left) / state.zoom;
        let y = (e.clientY - rect.top) / state.zoom;
        
        // Apply snap to grid if enabled
        // Snap to grid if enabled
        if (state.snapToGrid) {
            x = Math.round(x / state.gridSize) * state.gridSize;
            y = Math.round(y / state.gridSize) * state.gridSize;
        }
        
        return { x, y };
    }

    function createTextInput(x, y, screenX, screenY) {
        const input = document.createElement('input');
        input.type = 'text';
        input.style.position = 'absolute';
        
        // Position relative to canvas
        const posX = typeof screenX === 'number' ? screenX : (state.canvas.getBoundingClientRect().left + x * state.zoom);
        const posY = typeof screenY === 'number' ? screenY : (state.canvas.getBoundingClientRect().top + y * state.zoom);
        input.style.left = posX + 'px';
        input.style.top = posY + 'px';
        
        input.style.fontSize = state.strokeWidth * 4 + 'px';
        input.style.color = state.currentColor;
        input.style.border = '1px solid #ccc';
        input.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        input.style.padding = '2px 4px';
        input.style.minWidth = '100px';
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
                    size: state.strokeWidth * 4,
                    boardId: state.currentBoardId || null,
                    roomCode: state.roomCode || null,
                    username: state.username || 'Anonymous'
                });
            }
            document.body.removeChild(input);
            saveHistoryState();
            markDirty();
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
        applyCanvasTransform();
    }

    function updateZoomDisplay() {
        elements.zoomLevel.textContent = Math.round(state.zoom * 100) + '%';
    }

    function applyCanvasTransform() {
        state.canvas.style.transformOrigin = '0 0';
        state.canvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
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
            markDirty();
            broadcastCanvasSnapshot('undo');
        }
    }

    function redo() {
        if (state.historyIndex < state.history.length - 1) {
            state.historyIndex++;
            const imageData = state.history[state.historyIndex];
            state.ctx.putImageData(imageData, 0, 0);
            updateHistoryButtons();
            markDirty();
            broadcastCanvasSnapshot('redo');
        }
    }

    function updateHistoryButtons() {
        elements.undoBtn.classList.toggle('disabled', state.historyIndex <= 0);
        elements.redoBtn.classList.toggle('disabled', state.historyIndex >= state.history.length - 1);
    }

    function broadcastCanvasSnapshot(action, snapshotData) {
        if (state.isApplyingRemoteCanvasState) {
            return;
        }
        if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
            return;
        }

        const roomCode = state.roomCode || null;
        const boardId = state.currentBoardId || null;

        if (!roomCode && !boardId) {
            return;
        }

        const canvasData = snapshotData || state.canvas.toDataURL('image/png');

        const payload = {
            type: 'canvasState',
            action: action,
            canvasData: canvasData,
            roomCode: roomCode,
            boardId: boardId
        };

        state.socket.send(JSON.stringify(payload));
    }

    // ========================================
    // Canvas Redraw
    // ========================================
    function redrawCanvas() {
        const snapshot = state.ctx.getImageData(0, 0, state.canvas.width, state.canvas.height);

        // Clear canvas
        state.ctx.fillStyle = '#FFFFFF';
        state.ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);

        // Restore drawing
        state.ctx.putImageData(snapshot, 0, 0);

        // Draw overlays
        drawGrid();
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
            state.socket.send(JSON.stringify({
                type: 'clear',
                boardId: state.currentBoardId || null,
                roomCode: state.roomCode || null
            }));
            clearCanvasLocal();
            saveHistoryState();
            broadcastCanvasSnapshot('clear');
            markDirty();
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

    function markDirty() {
        if (state.isApplyingRemoteCanvasState) {
            return;
        }
        state.hasUnsavedChanges = true;
        scheduleAutoSave();
    }

    function scheduleAutoSave() {
        if (!state.isLoggedIn || !state.currentBoardId) return;
        if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return;

        if (state.autoSaveTimer) {
            clearTimeout(state.autoSaveTimer);
        }

        state.autoSaveTimer = setTimeout(() => {
            performAutoSave('debounce');
        }, CONFIG.AUTO_SAVE_DEBOUNCE);
    }

    function performAutoSave(reason) {
        if (state.isApplyingRemoteCanvasState) return;
        if (!state.hasUnsavedChanges) return;
        if (!state.isLoggedIn || !state.currentBoardId) return;
        if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return;

        updateSaveStatus('saving');
        const canvasData = state.canvas.toDataURL('image/jpeg', 0.7);
        state.socket.send(JSON.stringify({
            type: 'saveBoard',
            canvasData: canvasData
        }));

        state.lastAutoSaveAt = Date.now();
        state.hasUnsavedChanges = false;
        if (reason === 'manual') {
            showNotification('Board saved', 'success');
        }
    }

    function syncBoardStateForRoomShare(boardId, options = {}) {
        if (!state.currentBoardId) return false;
        if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return false;
        if (state.isApplyingRemoteCanvasState) return false;

        const numericBoardId = Number(boardId);
        if (!Number.isFinite(numericBoardId) || numericBoardId <= 0) {
            return false;
        }

        if (state.awaitingRoomSaveForRoom) {
            return true;
        }

        if (!state.hasUnsavedChanges && !options.forceSync) {
            return false;
        }

        state.awaitingRoomSaveForRoom = true;
        state.queuedRoomBoardId = numericBoardId;
        state.queuedRoomOptions = options;

        updateSaveStatus('saving');
        const canvasData = state.canvas.toDataURL('image/jpeg', 0.7);
        sendMessage({
            type: 'saveBoard',
            canvasData
        });
        state.lastRoomShareSyncAt = Date.now();
        state.lastAutoSaveAt = Date.now();
        // keep hasUnsavedChanges until acknowledgement arrives
        return true;
    }

    function goHome() {
        if (state.isLoggedIn) {
            if (state.hasUnsavedChanges) {
                performAutoSave('home');
            }
            showBoardsDashboard();
        } else {
            showNotification('Please log in to access boards', 'info');
        }
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

    function updateSaveStatus(status) {
        const saveStatus = elements.saveStatus;
        if (!saveStatus) return;
        
        const saveIcon = saveStatus.querySelector('.save-icon');
        const saveText = saveStatus.querySelector('.save-text');
        
        saveStatus.classList.remove('hidden', 'saving', 'saved', 'error');
        
        switch (status) {
            case 'saving':
                saveStatus.classList.add('saving');
                saveIcon.textContent = '💾';
                saveText.textContent = 'Saving...';
                break;
            case 'saved':
                saveStatus.classList.add('saved');
                saveIcon.textContent = '✓';
                saveText.textContent = 'Saved';
                // Hide after 3 seconds
                setTimeout(() => {
                    if (saveStatus.classList.contains('saved')) {
                        saveStatus.classList.add('hidden');
                    }
                }, 3000);
                break;
            case 'error':
                saveStatus.classList.add('error');
                saveIcon.textContent = '⚠️';
                saveText.textContent = 'Save failed';
                break;
            default:
                saveStatus.classList.add('hidden');
        }
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

        // Handle Ctrl/Cmd + S for save
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            performAutoSave('manual');
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
                if (elements.minimapToggle) {
                    elements.minimapToggle.classList.toggle('active', state.showMinimap);
                }
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
                    applyCanvasTransform();
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
