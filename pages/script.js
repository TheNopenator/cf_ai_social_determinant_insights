// Configuration
const API_BASE_URL = 'https://morning-moon-2ac7.ricklee2487.workers.dev'; // Points to the worker
const SESSION_COOKIE_NAME = 'sdh_user_id';
const SESSION_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const chatForm = document.getElementById('chatForm');
const sendBtn = document.getElementById('sendBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const userIdDisplay = document.getElementById('userId');
const editRiskBtn = document.getElementById('editRiskBtn');
const riskFactorsDisplay = document.getElementById('riskFactors');
const conditionsDisplay = document.getElementById('conditions');
const newSessionBtn = document.getElementById('newSessionBtn');

// Modal elements
const riskModal = document.getElementById('riskModal');
const submitRiskBtn = document.getElementById('submitRiskBtn');
const cancelRiskBtn = document.getElementById('cancelRiskBtn');
const closeModalBtn = document.querySelector('.close-btn');
const riskInput = document.getElementById('riskInput');
const conditionsInput = document.getElementById('conditionsInput');

// Quick reply buttons
const quickReplyBtns = document.querySelectorAll('.quick-reply-btn');

// Global state
let currentUserId = null;
let currentMemory = null;

// ============================================================================
// Session Management
// ============================================================================

/**
 * Get or create a session cookie
 */
function getOrCreateSession() {
	let userId = getCookie(SESSION_COOKIE_NAME);
	if (!userId) {
		userId = generateUserId();
		setCookie(SESSION_COOKIE_NAME, userId, SESSION_COOKIE_MAX_AGE);
	}
	currentUserId = userId;
	userIdDisplay.textContent = `Session: ${userId}`;
	return userId;
}

/**
 * Generate a unique user ID
 */
function generateUserId() {
	return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get a cookie value by name
 */
function getCookie(name) {
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) return parts.pop().split(';').shift();
	return null;
}

/**
 * Set a cookie
 */
function setCookie(name, value, maxAge) {
	document.cookie = `${name}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

/**
 * Clear session and start new
 */
function startNewSession() {
	if (confirm('Are you sure you want to start a new session? Chat history will be lost.')) {
		document.cookie = `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/`;
		currentUserId = generateUserId();
		setCookie(SESSION_COOKIE_NAME, currentUserId, SESSION_COOKIE_MAX_AGE);
		userIdDisplay.textContent = `Session: ${currentUserId}`;
		chatMessages.innerHTML = `
			<div class="message assistant-message">
				<div class="message-bubble">
					<p>Session started fresh! Share your concerns or risk factors, and I'll provide personalized insights.</p>
				</div>
			</div>
		`;
		currentMemory = null;
		riskFactorsDisplay.innerHTML = '<span class="tag">No risk factors entered</span>';
		conditionsDisplay.innerHTML = '<span class="tag">None recorded</span>';
	}
}

// ============================================================================
// Chat Functions
// ============================================================================

/**
 * Simple markdown parser for rendering formatted text
 */
function parseMarkdown(text) {
	let html = text;
	
	// Escape HTML first
	html = html.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
	
	// Bold: **text** or __text__
	html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
	
	// Italic: *text* or _text_
	html = html.replace(/\*([^\*]+?)\*/g, '<em>$1</em>');
	html = html.replace(/_([^_]+?)_/g, '<em>$1</em>');
	
	// Line breaks
	html = html.replace(/\n/g, '<br>');
	
	// Bullet lists: lines starting with - or *
	html = html.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
	html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
	html = html.replace(/<\/li>\n<li>/g, '</li><li>');
	
	// Numbered lists: lines starting with digit.
	html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
	
	// Headers: # Text, ## Text, etc.
	html = html.replace(/^### (.+?)(?=<br>|$)/gm, '<h3>$1</h3>');
	html = html.replace(/^## (.+?)(?=<br>|$)/gm, '<h2>$1</h2>');
	html = html.replace(/^# (.+?)(?=<br>|$)/gm, '<h1>$1</h1>');
	
	return html;
}

/**
 * Add a message to the chat UI
 */
function addMessage(text, isUser = false) {
	const messageDiv = document.createElement('div');
	messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;

	const bubbleDiv = document.createElement('div');
	bubbleDiv.className = 'message-bubble';

	const p = document.createElement('p');
	
	if (isUser) {
		// User messages: plain text
		p.textContent = text;
	} else {
		// Assistant messages: parse markdown
		p.innerHTML = parseMarkdown(text);
	}

	bubbleDiv.appendChild(p);
	messageDiv.appendChild(bubbleDiv);
	chatMessages.appendChild(messageDiv);

	// Auto-scroll to bottom
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Send a chat message
 */
async function sendMessage(message) {
	if (!message.trim()) return;

	// Add user message to UI
	addMessage(message, true);
	messageInput.value = '';

	// Show loading indicator
	showLoading(true);
	sendBtn.disabled = true;

	try {
		console.log(`Sending message to: ${API_BASE_URL}/chat`);
		const response = await fetch(`${API_BASE_URL}/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userId: currentUserId,
				message: message,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`API error (${response.status}):`, errorText);
			throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
		}

		const data = await response.json();
		console.log('Chat response received:', data);

		// Add assistant response to UI
		addMessage(data.aiResponse, false);

		// Update memory display
		if (data.context) {
			currentMemory = { context: data.context };
			updateProfileDisplay(data.context);
		}
	} catch (error) {
		console.error('Chat error:', error);
		addMessage(`Sorry, I encountered an error: ${error.message}. Make sure the worker is deployed at ${API_BASE_URL}`, false);
	} finally {
		showLoading(false);
		sendBtn.disabled = false;
		messageInput.focus();
	}
}

/**
 * Show/hide loading indicator
 */
function showLoading(show) {
	loadingIndicator.style.display = show ? 'block' : 'none';
}

/**
 * Update profile display with risk factors and conditions
 */
function updateProfileDisplay(context) {
	if (context.riskFactors && context.riskFactors.length > 0) {
		riskFactorsDisplay.innerHTML = context.riskFactors
			.map(rf => `<span class="tag active">${rf}</span>`)
			.join('');
	}

	if (context.conditions && context.conditions.length > 0) {
		conditionsDisplay.innerHTML = context.conditions
			.map(c => `<span class="tag">${c}</span>`)
			.join('');
	}
}

/**
 * Fetch user context from API
 */
async function fetchUserContext() {
	try {
		const response = await fetch(`${API_BASE_URL}/context?userId=${currentUserId}`);
		if (!response.ok) throw new Error('Failed to fetch context');

		const data = await response.json();
		currentMemory = data.memory;
		updateProfileDisplay(data.memory.profile);
	} catch (error) {
		console.error('Failed to fetch context:', error);
	}
}

// ============================================================================
// Risk Factor Modal
// ============================================================================

/**
 * Show risk factor modal
 */
function showRiskModal() {
	riskModal.style.display = 'flex';
	messageInput.focus();
}

/**
 * Close risk factor modal
 */
function closeRiskModal() {
	riskModal.style.display = 'none';
}

/**
 * Submit risk factors update
 */
async function submitRiskFactors() {
	const riskFactors = riskInput.value
		.split(',')
		.map(rf => rf.trim())
		.filter(rf => rf.length > 0);

	const conditions = conditionsInput.value
		.split(',')
		.map(c => c.trim())
		.filter(c => c.length > 0);

	if (riskFactors.length === 0 && conditions.length === 0) {
		alert('Please enter at least one risk factor or condition.');
		return;
	}

	showLoading(true);

	try {
		const response = await fetch(`${API_BASE_URL}/risk`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userId: currentUserId,
				riskFactors,
				conditions,
			}),
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();

		// Update UI
		if (data.profile) {
			updateProfileDisplay(data.profile);
		}

		// Clear inputs
		riskInput.value = '';
		conditionsInput.value = '';

		closeRiskModal();
		addMessage(`Great! I've updated your profile with ${riskFactors.length + conditions.length} item(s). How can I help you today?`, false);
	} catch (error) {
		console.error('Risk update error:', error);
		alert(`Error updating risk factors: ${error.message}`);
	} finally {
		showLoading(false);
	}
}

// ============================================================================
// Event Listeners
// ============================================================================

// Chat form submission
chatForm.addEventListener('submit', (e) => {
	e.preventDefault();
	const message = messageInput.value.trim();
	if (message) {
		sendMessage(message);
	}
});

// Quick reply buttons
quickReplyBtns.forEach(btn => {
	btn.addEventListener('click', () => {
		const message = btn.getAttribute('data-message');
		sendMessage(message);
	});
});

// Risk factor modal
editRiskBtn.addEventListener('click', showRiskModal);
submitRiskBtn.addEventListener('click', submitRiskFactors);
cancelRiskBtn.addEventListener('click', closeRiskModal);
closeModalBtn.addEventListener('click', closeRiskModal);

// Close modal when clicking outside
riskModal.addEventListener('click', (e) => {
	if (e.target === riskModal) {
		closeRiskModal();
	}
});

// New session button
newSessionBtn.addEventListener('click', startNewSession);

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
	// Initialize session
	getOrCreateSession();

	// Fetch initial context
	await fetchUserContext();

	// Focus input
	messageInput.focus();

	console.log('Chat application initialized');
});
