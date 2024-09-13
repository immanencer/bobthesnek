import TaskModule from './taskModule.js';
import AIModule from './aiModule.js';
import XModule from './xModule.js';
import DiscordModule from './discordModule.js';
import ChatModule from './chatModule.js';

// Utility function for timestamped logs
function log(message, ...optionalParams) {
    console.log(`[${new Date().toISOString()}] ${message}`, ...optionalParams);
}

class BotModule {
    constructor(config = {}) {
        // Load configuration with defaults
        this.taskProcessInterval = parseInt(config.TASK_PROCESS_INTERVAL, 10) || 10000; // Default to 10 seconds

        // Initialize modules
        this.taskModule = new TaskModule();
        this.aiModule = new AIModule();
        this.xModule = new XModule();
        this.discordModule = new DiscordModule();
        this.chatModule = new ChatModule();

        // Bind methods
        this.start = this.start.bind(this);
        this.initialize = this.initialize.bind(this);
        this.shutdown = this.shutdown.bind(this);
    }

    /**
     * Initialize all modules and start the bot.
     */
    async start() {
        log('Bot starting...');
        try {
            await this.initialize();
            this.discordModule.start();
            this.processTasksLoop();
            this.setupGracefulShutdown();
            log('Bot started successfully.');
        } catch (error) {
            log('Error during bot initialization:', error);
            process.exit(1); // Exit if initialization fails
        }
    }

    /**
     * Initialize all modules that require asynchronous setup.
     */
    async initialize() {
        try {
            // Initialize each module if they have an initialize method
            if (typeof this.taskModule.initialize === 'function') {
                await this.taskModule.initialize();
                log('TaskModule initialized.');
            }

            if (typeof this.aiModule.initialize === 'function') {
                await this.aiModule.initialize();
                log('AIModule initialized.');
            }

            if (typeof this.xModule.initialize === 'function') {
                await this.xModule.initialize();
                log('XModule initialized.');
            }

            if (typeof this.discordModule.initialize === 'function') {
                await this.discordModule.initialize();
                log('DiscordModule initialized.');
            }

            if (typeof this.chatModule.initialize === 'function') {
                await this.chatModule.initialize();
                log('ChatModule initialized.');
            }

            // Initialize TaskModule dependencies if any
            // For example, if TaskModule depends on other modules
        } catch (error) {
            log('Error during module initialization:', error);
            throw error;
        }
    }

    /**
     * Asynchronous loop to process tasks at regular intervals.
     */
    async processTasksLoop() {
        const process = async () => {
            try {
                log('Processing pending tasks...');
                await Promise.all([
                    this.aiModule.processAIPendingTasks(),
                    this.xModule.processXPendingTasks(),
                    this.discordModule.processDiscordPendingTasks(),
                ]);
                log('Pending tasks processed successfully.');
            } catch (error) {
                log('Error processing tasks:', error);
            } finally {
                // Schedule the next execution
                this.taskTimeout = setTimeout(process, this.taskProcessInterval);
            }
        };
        // Start the loop
        process();
    }

    /**
     * Set up listeners for graceful shutdown.
     */
    setupGracefulShutdown() {
        const gracefulExit = async () => {
            log('Received shutdown signal. Shutting down gracefully...');
            await this.shutdown();
            process.exit(0);
        };

        process.on('SIGINT', gracefulExit);
        process.on('SIGTERM', gracefulExit);
    }

    /**
     * Shutdown all modules and clean up resources.
     */
    async shutdown() {
        try {
            // Clear the task processing timeout
            if (this.taskTimeout) {
                clearTimeout(this.taskTimeout);
                log('Task processing loop stopped.');
            }

            // Shutdown modules if they have a shutdown method
            if (typeof this.taskModule.shutdown === 'function') {
                await this.taskModule.shutdown();
                log('TaskModule shutdown.');
            }

            if (typeof this.aiModule.shutdown === 'function') {
                await this.aiModule.shutdown();
                log('AIModule shutdown.');
            }

            if (typeof this.xModule.shutdown === 'function') {
                await this.xModule.shutdown();
                log('XModule shutdown.');
            }

            if (typeof this.discordModule.shutdown === 'function') {
                await this.discordModule.shutdown();
                log('DiscordModule shutdown.');
            }

            if (typeof this.chatModule.shutdown === 'function') {
                await this.chatModule.shutdown();
                log('ChatModule shutdown.');
            }

            log('All modules have been shut down gracefully.');
        } catch (error) {
            log('Error during shutdown:', error);
        }
    }
}

export default BotModule;
