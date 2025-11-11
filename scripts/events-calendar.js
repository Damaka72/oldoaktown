/**
 * Events Calendar Manager
 * Handles loading, displaying, and navigating events in a calendar view
 */

class EventsCalendar {
    constructor() {
        this.events = [];
        this.currentDate = new Date();
        this.selectedMonth = this.currentDate.getMonth();
        this.selectedYear = this.currentDate.getFullYear();
    }

    /**
     * Initialize the calendar
     */
    async init() {
        try {
            await this.loadEvents();
            this.render();
            this.attachEventListeners();
        } catch (error) {
            console.error('Failed to initialize calendar:', error);
            this.showError('Failed to load events. Please try again later.');
        }
    }

    /**
     * Load events from JSON file
     */
    async loadEvents() {
        try {
            const response = await fetch('/data/events.json');
            if (!response.ok) {
                throw new Error('Failed to fetch events');
            }
            const data = await response.json();
            this.events = data.events || [];
        } catch (error) {
            console.error('Error loading events:', error);
            throw error;
        }
    }

    /**
     * Get events for a specific month and year
     */
    getEventsForMonth(month, year) {
        return this.events.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate.getMonth() === month && eventDate.getFullYear() === year;
        });
    }

    /**
     * Get all months that have events
     */
    getMonthsWithEvents() {
        const months = new Set();
        this.events.forEach(event => {
            const eventDate = new Date(event.date);
            const key = `${eventDate.getFullYear()}-${eventDate.getMonth()}`;
            months.add(key);
        });
        return Array.from(months).sort();
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-GB', options);
    }

    /**
     * Format time for display
     */
    formatTime(time) {
        if (!time) return '';
        // Convert 24h format to 12h format
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }

    /**
     * Get month name
     */
    getMonthName(month) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[month];
    }

    /**
     * Navigate to previous month with events
     */
    previousMonth() {
        const monthsWithEvents = this.getMonthsWithEvents();
        if (monthsWithEvents.length === 0) return;

        const currentKey = `${this.selectedYear}-${this.selectedMonth}`;
        const currentIndex = monthsWithEvents.indexOf(currentKey);

        if (currentIndex > 0) {
            const prevKey = monthsWithEvents[currentIndex - 1];
            const [year, month] = prevKey.split('-');
            this.selectedYear = parseInt(year);
            this.selectedMonth = parseInt(month);
        } else {
            // Go to last month with events
            const lastKey = monthsWithEvents[monthsWithEvents.length - 1];
            const [year, month] = lastKey.split('-');
            this.selectedYear = parseInt(year);
            this.selectedMonth = parseInt(month);
        }

        this.render();
    }

    /**
     * Navigate to next month with events
     */
    nextMonth() {
        const monthsWithEvents = this.getMonthsWithEvents();
        if (monthsWithEvents.length === 0) return;

        const currentKey = `${this.selectedYear}-${this.selectedMonth}`;
        const currentIndex = monthsWithEvents.indexOf(currentKey);

        if (currentIndex < monthsWithEvents.length - 1) {
            const nextKey = monthsWithEvents[currentIndex + 1];
            const [year, month] = nextKey.split('-');
            this.selectedYear = parseInt(year);
            this.selectedMonth = parseInt(month);
        } else {
            // Go to first month with events
            const firstKey = monthsWithEvents[0];
            const [year, month] = firstKey.split('-');
            this.selectedYear = parseInt(year);
            this.selectedMonth = parseInt(month);
        }

        this.render();
    }

    /**
     * Render the calendar view
     */
    render() {
        const container = document.getElementById('calendar-container');
        if (!container) {
            console.error('Calendar container not found');
            return;
        }

        const monthEvents = this.getEventsForMonth(this.selectedMonth, this.selectedYear);
        const monthsWithEvents = this.getMonthsWithEvents();

        let html = `
            <div class="calendar-header">
                <button id="prev-month" class="calendar-nav-btn" ${monthsWithEvents.length <= 1 ? 'disabled' : ''}>
                    ← Previous
                </button>
                <h2 class="calendar-month-title">
                    ${this.getMonthName(this.selectedMonth)} ${this.selectedYear}
                </h2>
                <button id="next-month" class="calendar-nav-btn" ${monthsWithEvents.length <= 1 ? 'disabled' : ''}>
                    Next →
                </button>
            </div>
        `;

        if (monthEvents.length === 0) {
            html += `
                <div class="no-events">
                    <p>No events scheduled for this month.</p>
                </div>
            `;
        } else {
            html += '<div class="events-grid">';

            // Sort events by date
            monthEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

            monthEvents.forEach(event => {
                const categoryClass = event.category || 'general';
                const timeRange = event.startTime && event.endTime
                    ? `${this.formatTime(event.startTime)} - ${this.formatTime(event.endTime)}`
                    : '';

                html += `
                    <div class="event-card" data-event-id="${event.id}">
                        <div class="event-date-badge">
                            📅 ${this.formatDate(event.date)}
                        </div>
                        <h3 class="event-title">${event.title}</h3>
                        ${timeRange ? `<p class="event-time"><strong>Time:</strong> ${timeRange}</p>` : ''}
                        <p class="event-location">
                            <strong>Location:</strong> ${event.location.name}<br>
                            <span class="event-address">${event.location.address}</span>
                        </p>
                        <p class="event-description">${event.description}</p>
                        <div class="event-links">
                            ${event.sourceUrl ? `
                                <a href="${event.sourceUrl}" target="_blank" rel="noopener" class="btn btn-secondary">
                                    📄 Event Details
                                </a>
                            ` : ''}
                            ${event.registrationUrl && event.registrationUrl !== event.sourceUrl ? `
                                <a href="${event.registrationUrl}" target="_blank" rel="noopener" class="btn btn-primary">
                                    Register
                                </a>
                            ` : event.registrationUrl === event.sourceUrl ? `
                                <a href="${event.registrationUrl}" target="_blank" rel="noopener" class="btn btn-primary">
                                    Learn More & Register
                                </a>
                            ` : ''}
                        </div>
                    </div>
                `;
            });

            html += '</div>';
        }

        container.innerHTML = html;
    }

    /**
     * Attach event listeners to navigation buttons
     */
    attachEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.id === 'prev-month' || e.target.closest('#prev-month')) {
                this.previousMonth();
            } else if (e.target.id === 'next-month' || e.target.closest('#next-month')) {
                this.nextMonth();
            }
        });
    }

    /**
     * Show error message
     */
    showError(message) {
        const container = document.getElementById('calendar-container');
        if (container) {
            container.innerHTML = `
                <div class="calendar-error">
                    <p>⚠️ ${message}</p>
                </div>
            `;
        }
    }
}

// Initialize calendar when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const calendar = new EventsCalendar();
        calendar.init();
    });
} else {
    const calendar = new EventsCalendar();
    calendar.init();
}
