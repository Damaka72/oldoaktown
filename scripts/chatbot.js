/**
 * Old Oak Town AI Chatbot
 * A helpful assistant to guide visitors through the site and answer questions
 * about the Old Oak Common regeneration project.
 */

(function() {
    'use strict';

    // Chatbot Configuration
    const CONFIG = {
        botName: 'Oak',
        welcomeMessage: "Hello! I'm Oak, your guide to Old Oak Town. I can help you with:\n\n• HS2 & development updates\n• Finding local businesses\n• Community resources\n• Events & activities\n• Housing information\n• Job opportunities\n\nHow can I help you today?",
        placeholder: 'Type your question...'
    };

    // Knowledge Base - Site content and information
    const KNOWLEDGE_BASE = {
        // Navigation helpers
        navigation: {
            news: { section: '#news', description: 'Latest news and updates about Old Oak development' },
            business: { section: '#directory', page: 'business-directory.html', description: 'Find local businesses in the area' },
            resources: { section: '#resources', description: 'Community resources for residents and businesses' },
            events: { section: '#events', description: 'Upcoming community events and activities' },
            advertise: { section: '#advertise', page: 'business-submit.html', description: 'Advertise your business with us' },
            contact: { section: '#contact', description: 'Get in touch with us' }
        },

        // Quick responses for common queries
        responses: {
            // Greetings
            greetings: {
                patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy'],
                response: "Hello! Welcome to Old Oak Town. I'm here to help you navigate the site and answer questions about the Old Oak Common regeneration. What would you like to know?"
            },

            // HS2 Information
            hs2: {
                patterns: ['hs2', 'high speed', 'train', 'station', 'railway', 'rail'],
                response: "The HS2 Old Oak Common station is a major part of the regeneration! Here's what you should know:\n\n🚄 **Station Opening:** Expected 2033\n💰 **Investment:** £1.7 billion\n🚇 **Connections:** Elizabeth Line, Central Line, Overground\n⏱️ **To Birmingham:** 38 minutes\n\nThe station will be one of the UK's largest and best-connected transport hubs.\n\n[View latest HS2 news →](#news)"
            },

            // Housing
            housing: {
                patterns: ['housing', 'homes', 'flat', 'apartment', 'rent', 'buy', 'affordable', 'property', 'live', 'move'],
                response: "Old Oak will have 25,500 new homes, with 50% designated as affordable housing:\n\n🏠 **Social Rent:** ~60% of market rate\n🏠 **London Affordable:** ~80% of market rate\n🏠 **Shared Ownership:** Buy 25-75%\n\n**Priority given to:**\n• Existing local residents\n• Key workers (teachers, nurses, etc.)\n\nFirst homes available from late 2027.\n\n[View housing resources →](#resources)"
            },

            // Jobs
            jobs: {
                patterns: ['job', 'work', 'employment', 'career', 'hiring', 'vacancy', 'training', 'apprentice'],
                response: "The regeneration will create 65,000 new jobs! The Old Oak Jobs Centre offers:\n\n💼 **Free Services:**\n• Job matching & placement\n• CV writing support\n• Interview preparation\n• Skills training courses\n• Apprenticeship links\n\n📍 **Location:** 45 High Street, Harlesden\n🕐 **Hours:** Mon-Fri 9am-6pm, Sat 10am-2pm\n\n[View community resources →](#resources)"
            },

            // Business Directory
            businessDirectory: {
                patterns: ['find business', 'local business', 'directory', 'search business', 'shops', 'services', 'plumber', 'electrician', 'restaurant', 'cafe'],
                response: "Looking for local businesses? Our Business Directory can help!\n\n🔍 Search by category, service type, or name\n⭐ View featured and premium listings\n📞 Get contact details directly\n\n[Browse Business Directory →](business-directory.html)\n\nCan't find what you need? Let me know what service you're looking for!"
            },

            // List Business
            listBusiness: {
                patterns: ['list my business', 'advertise', 'add business', 'submit business', 'promote', 'listing'],
                response: "Great! We have several options to list your business:\n\n**📋 Free Listing** - £0\nBasic directory presence with contact details\n\n**⭐ Featured Listing** - £35/month\nTop placement, logo, enhanced description\n\n**🏆 Premium Package** - £75/month\nHomepage banner, newsletter feature, analytics\n\n**📧 Newsletter Sponsor** - £150/month\nReach 5,000+ subscribers directly\n\n[Submit your business now →](business-submit.html)"
            },

            // Events
            events: {
                patterns: ['event', 'what\'s on', 'activities', 'meeting', 'forum', 'tour', 'market'],
                response: "Here are upcoming community events:\n\n📅 **Old Oak Community Forum**\nMonthly meetings at Harlesden Library\nShare your views on local developments\n\n🚄 **HS2 Station Tours**\nGuided tours with Q&A sessions\n\n🎄 **Community Events**\nMarkets, festivals, and local gatherings\n\n[View all events →](#events)"
            },

            // Resources - Residents
            residents: {
                patterns: ['resident', 'community resource', 'support', 'help', 'library', 'health', 'school', 'education', 'transport'],
                response: "We have resources organized for residents:\n\n🏠 **Housing & Support**\n📚 **Education & Schools**\n🏥 **Health & Wellbeing**\n🚌 **Transport Information**\n📖 **Library Services**\n💼 **Jobs & Training**\n\n[View all resident resources →](#resources)"
            },

            // Resources - Businesses
            businessResources: {
                patterns: ['business resource', 'permits', 'planning', 'grants', 'funding', 'business support'],
                response: "Resources for local businesses:\n\n📋 **Planning & Permits**\nGuidance on applications\n\n💰 **Funding & Grants**\nFinancial support opportunities\n\n🤝 **Business Services**\nNetworking and support\n\n📣 **Marketing & Promotion**\nReach local customers\n\n[View business resources →](#resources)"
            },

            // Timeline / Development
            development: {
                patterns: ['timeline', 'when', 'development', 'regeneration', 'plan', 'masterplan', 'phase', 'future'],
                response: "Old Oak regeneration timeline:\n\n**📍 Area:** 140 hectares\n**🏠 Homes:** 25,500 planned\n**💼 Jobs:** 65,000 expected\n**📅 Timeline:** 2025-2039+\n\n**Key Phases:**\n• 2025-2029: Infrastructure & early housing\n• 2029-2033: Station completion\n• 2033+: Full development\n\n[View development timeline →](#development)"
            },

            // Contact
            contact: {
                patterns: ['contact', 'email', 'phone', 'get in touch', 'speak to', 'message'],
                response: "You can reach us in several ways:\n\n📧 **Email:** info@oldoaktown.co.uk\n📝 **Contact Form:** Available on our site\n📰 **Newsletter:** Weekly development updates\n\n[Go to contact section →](#contact)"
            },

            // Newsletter
            newsletter: {
                patterns: ['newsletter', 'subscribe', 'updates', 'weekly', 'email updates'],
                response: "Stay informed with our weekly newsletter!\n\n📧 **What you'll get:**\n• Latest development news\n• Community events\n• Job opportunities\n• Local business features\n\nSubscribe using the form in our footer or contact section.\n\n[Subscribe now →](#contact)"
            },

            // About
            about: {
                patterns: ['about', 'what is', 'old oak', 'tell me about'],
                response: "**Old Oak Town** is your guide to West London's largest regeneration project.\n\n📍 **Location:** Old Oak Common, West London\n📰 **What we do:** Local news, business directory, community resources\n🎯 **Our mission:** Keep residents informed about the transformation\n\nThe area is being transformed into a major new neighbourhood with excellent transport links, thousands of homes, and tens of thousands of jobs."
            },

            // Key contacts
            keyContacts: {
                patterns: ['key contact', 'organisation', 'council', 'opdc', 'who to contact', 'authority'],
                response: "Key organisations for Old Oak:\n\n🏛️ **OPDC** (Development Corporation)\nMasterplan and planning authority\n\n🚄 **HS2 Ltd**\nStation and railway construction\n\n🏘️ **Old Oak Neighbourhood Forum**\nCommunity representation\n\n🏢 **Local Councils**\nHammersmith & Fulham, Ealing, Brent\n\n[View all key contacts →](#resources)"
            },

            // Thanks
            thanks: {
                patterns: ['thank', 'thanks', 'cheers', 'appreciate'],
                response: "You're welcome! Is there anything else I can help you with? Feel free to ask about:\n\n• HS2 and development updates\n• Local businesses\n• Community resources\n• Events and activities"
            },

            // Goodbye
            goodbye: {
                patterns: ['bye', 'goodbye', 'see you', 'later', 'quit', 'exit'],
                response: "Goodbye! Thanks for visiting Old Oak Town. Come back anytime for the latest updates on the regeneration. Have a great day! 👋"
            }
        },

        // Fallback response
        fallback: "I'm not sure I understood that. Here's what I can help with:\n\n• **HS2 & Development** - Station updates, timeline\n• **Housing** - Affordable homes, applications\n• **Jobs** - Employment opportunities, training\n• **Businesses** - Find or list local businesses\n• **Events** - Community activities\n• **Resources** - Support for residents & businesses\n\nTry asking something like \"Tell me about HS2\" or \"How do I find local businesses?\""
    };

    // Inject CSS styles
    function injectStyles() {
        const styles = `
            /* Chatbot Container */
            .oak-chatbot {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            }

            /* Chat Toggle Button */
            .oak-chat-toggle {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(135deg, #2D5016 0%, #8B4513 100%);
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(45, 80, 22, 0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.3s, box-shadow 0.3s;
            }

            .oak-chat-toggle:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(45, 80, 22, 0.5);
            }

            .oak-chat-toggle svg {
                width: 28px;
                height: 28px;
                fill: white;
            }

            .oak-chat-toggle .close-icon {
                display: none;
            }

            .oak-chatbot.active .oak-chat-toggle .chat-icon {
                display: none;
            }

            .oak-chatbot.active .oak-chat-toggle .close-icon {
                display: block;
            }

            /* Chat Window */
            .oak-chat-window {
                position: absolute;
                bottom: 75px;
                right: 0;
                width: 380px;
                max-width: calc(100vw - 40px);
                height: 500px;
                max-height: calc(100vh - 120px);
                background: white;
                border-radius: 16px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
                display: none;
                flex-direction: column;
                overflow: hidden;
                animation: slideUp 0.3s ease;
            }

            .oak-chatbot.active .oak-chat-window {
                display: flex;
            }

            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            /* Chat Header */
            .oak-chat-header {
                background: linear-gradient(135deg, #2D5016 0%, #8B4513 100%);
                color: white;
                padding: 16px 20px;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .oak-chat-avatar {
                width: 40px;
                height: 40px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
            }

            .oak-chat-header-info h4 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }

            .oak-chat-header-info p {
                margin: 2px 0 0 0;
                font-size: 12px;
                opacity: 0.9;
            }

            /* Chat Messages */
            .oak-chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                background: #f8f9fa;
            }

            .oak-message {
                max-width: 85%;
                padding: 12px 16px;
                border-radius: 16px;
                line-height: 1.5;
                font-size: 14px;
                white-space: pre-wrap;
            }

            .oak-message.bot {
                background: white;
                color: #333;
                align-self: flex-start;
                border-bottom-left-radius: 4px;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }

            .oak-message.user {
                background: linear-gradient(135deg, #2D5016 0%, #3d6b1e 100%);
                color: white;
                align-self: flex-end;
                border-bottom-right-radius: 4px;
            }

            .oak-message a {
                color: #2D5016;
                text-decoration: underline;
                font-weight: 500;
            }

            .oak-message.user a {
                color: #F5F5DC;
            }

            .oak-message strong {
                font-weight: 600;
            }

            /* Typing Indicator */
            .oak-typing {
                display: flex;
                gap: 4px;
                padding: 12px 16px;
                background: white;
                border-radius: 16px;
                border-bottom-left-radius: 4px;
                align-self: flex-start;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }

            .oak-typing span {
                width: 8px;
                height: 8px;
                background: #2D5016;
                border-radius: 50%;
                animation: typing 1.4s infinite;
            }

            .oak-typing span:nth-child(2) {
                animation-delay: 0.2s;
            }

            .oak-typing span:nth-child(3) {
                animation-delay: 0.4s;
            }

            @keyframes typing {
                0%, 60%, 100% {
                    transform: translateY(0);
                    opacity: 0.4;
                }
                30% {
                    transform: translateY(-4px);
                    opacity: 1;
                }
            }

            /* Quick Actions */
            .oak-quick-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                padding: 12px 20px;
                background: white;
                border-top: 1px solid #eee;
            }

            .oak-quick-btn {
                padding: 8px 14px;
                background: #f0f4e8;
                border: 1px solid #2D5016;
                border-radius: 20px;
                font-size: 12px;
                color: #2D5016;
                cursor: pointer;
                transition: all 0.2s;
            }

            .oak-quick-btn:hover {
                background: #2D5016;
                color: white;
            }

            /* Chat Input */
            .oak-chat-input {
                display: flex;
                padding: 16px;
                background: white;
                border-top: 1px solid #eee;
                gap: 10px;
            }

            .oak-chat-input input {
                flex: 1;
                padding: 12px 16px;
                border: 1px solid #ddd;
                border-radius: 24px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s;
            }

            .oak-chat-input input:focus {
                border-color: #2D5016;
            }

            .oak-chat-input button {
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: #2D5016;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }

            .oak-chat-input button:hover {
                background: #1e3a10;
            }

            .oak-chat-input button svg {
                width: 20px;
                height: 20px;
                fill: white;
            }

            /* Mobile Responsive */
            @media (max-width: 480px) {
                .oak-chat-window {
                    width: calc(100vw - 20px);
                    height: calc(100vh - 100px);
                    bottom: 70px;
                    right: -10px;
                    border-radius: 12px;
                }

                .oak-chatbot {
                    right: 15px;
                    bottom: 15px;
                }

                .oak-chat-toggle {
                    width: 55px;
                    height: 55px;
                }
            }

            /* Notification Badge */
            .oak-notification {
                position: absolute;
                top: -5px;
                right: -5px;
                width: 20px;
                height: 20px;
                background: #e74c3c;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                color: white;
                font-weight: bold;
                animation: pulse 2s infinite;
            }

            @keyframes pulse {
                0%, 100% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.1);
                }
            }

            .oak-chatbot.active .oak-notification {
                display: none;
            }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    // Create chatbot HTML structure
    function createChatbotHTML() {
        const chatbot = document.createElement('div');
        chatbot.className = 'oak-chatbot';
        chatbot.innerHTML = `
            <div class="oak-chat-window">
                <div class="oak-chat-header">
                    <div class="oak-chat-avatar">🌳</div>
                    <div class="oak-chat-header-info">
                        <h4>${CONFIG.botName}</h4>
                        <p>Your Old Oak Town Guide</p>
                    </div>
                </div>
                <div class="oak-chat-messages" id="oakChatMessages">
                    <!-- Messages will be inserted here -->
                </div>
                <div class="oak-quick-actions">
                    <button class="oak-quick-btn" data-query="Tell me about HS2">HS2 Updates</button>
                    <button class="oak-quick-btn" data-query="Find local businesses">Businesses</button>
                    <button class="oak-quick-btn" data-query="What events are coming up?">Events</button>
                    <button class="oak-quick-btn" data-query="Housing information">Housing</button>
                    <button class="oak-quick-btn" data-query="Job opportunities">Jobs</button>
                </div>
                <div class="oak-chat-input">
                    <input type="text" id="oakChatInput" placeholder="${CONFIG.placeholder}" autocomplete="off">
                    <button id="oakSendBtn" aria-label="Send message">
                        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
            </div>
            <button class="oak-chat-toggle" id="oakChatToggle" aria-label="Open chat">
                <span class="oak-notification">1</span>
                <svg class="chat-icon" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h10v2H7zm0-3h10v2H7z"/></svg>
                <svg class="close-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
        `;
        document.body.appendChild(chatbot);
        return chatbot;
    }

    // Format message text with markdown-like syntax
    function formatMessage(text) {
        return text
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Links with custom text [text](url)
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" onclick="oakChatbot.handleLink(\'$2\')">$1</a>')
            // Line breaks
            .replace(/\n/g, '<br>');
    }

    // Add message to chat
    function addMessage(text, isUser = false) {
        const messagesContainer = document.getElementById('oakChatMessages');
        const message = document.createElement('div');
        message.className = `oak-message ${isUser ? 'user' : 'bot'}`;
        message.innerHTML = formatMessage(text);
        messagesContainer.appendChild(message);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Show typing indicator
    function showTyping() {
        const messagesContainer = document.getElementById('oakChatMessages');
        const typing = document.createElement('div');
        typing.className = 'oak-typing';
        typing.id = 'oakTyping';
        typing.innerHTML = '<span></span><span></span><span></span>';
        messagesContainer.appendChild(typing);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Hide typing indicator
    function hideTyping() {
        const typing = document.getElementById('oakTyping');
        if (typing) typing.remove();
    }

    // Find best matching response
    function findResponse(query) {
        const lowerQuery = query.toLowerCase();
        const responses = KNOWLEDGE_BASE.responses;

        for (const key in responses) {
            const item = responses[key];
            for (const pattern of item.patterns) {
                if (lowerQuery.includes(pattern)) {
                    return item.response;
                }
            }
        }

        return KNOWLEDGE_BASE.fallback;
    }

    // Process user message
    function processMessage(query) {
        if (!query.trim()) return;

        // Add user message
        addMessage(query, true);

        // Show typing indicator
        showTyping();

        // Simulate processing delay for natural feel
        setTimeout(() => {
            hideTyping();
            const response = findResponse(query);
            addMessage(response);
        }, 500 + Math.random() * 500);
    }

    // Handle link clicks in chat
    function handleLink(url) {
        const chatbot = document.querySelector('.oak-chatbot');

        // If it's an anchor link on the same page
        if (url.startsWith('#')) {
            chatbot.classList.remove('active');
            const element = document.querySelector(url);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
        // If it's a page link
        else if (!url.startsWith('http')) {
            window.location.href = url;
        }
    }

    // Initialize chatbot
    function init() {
        // Inject styles
        injectStyles();

        // Create HTML structure
        const chatbot = createChatbotHTML();

        // Get elements
        const toggle = document.getElementById('oakChatToggle');
        const input = document.getElementById('oakChatInput');
        const sendBtn = document.getElementById('oakSendBtn');
        const quickBtns = chatbot.querySelectorAll('.oak-quick-btn');

        // Toggle chat window
        toggle.addEventListener('click', () => {
            chatbot.classList.toggle('active');
            if (chatbot.classList.contains('active')) {
                // Show welcome message on first open
                const messagesContainer = document.getElementById('oakChatMessages');
                if (messagesContainer.children.length === 0) {
                    addMessage(CONFIG.welcomeMessage);
                }
                input.focus();
            }
        });

        // Send message on button click
        sendBtn.addEventListener('click', () => {
            processMessage(input.value);
            input.value = '';
        });

        // Send message on Enter key
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                processMessage(input.value);
                input.value = '';
            }
        });

        // Quick action buttons
        quickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.getAttribute('data-query');
                processMessage(query);
            });
        });

        // Expose handleLink function globally
        window.oakChatbot = { handleLink };

        console.log('Oak Chatbot initialized successfully');
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
