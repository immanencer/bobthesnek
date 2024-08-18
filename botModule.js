import TaskModule from './taskModule.js';
import AIModule from './aiModule.js';
import XModule from './xModule.js';
import DiscordModule from './discordModule.js';
import ChatModule from './chatModule.js';

class BotModule {
    constructor() {
        this.taskModule = new TaskModule();
        this.aiModule = new AIModule();
        this.xModule = new XModule();
        this.discordModule = new DiscordModule();
        this.chatModule = new ChatModule();  // Initialize the ChatModule
    }

    async start() {
        console.log('Bot starting...');
        this.discordModule.start();
        this.chatModule.startPolling();  // Start polling for chat tasks independently
        this.processTasks();
    }

    async processTasks() {
        setInterval(async () => {
            await this.aiModule.processAIPendingTasks();
            await this.xModule.processXPendingTasks();
            await this.discordModule.processDiscordPendingTasks();
        }, 10000); // Process tasks every 10 seconds, adjust as needed
    }
}

export default BotModule;
