// DiscordModule.js
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { MongoClient } from 'mongodb';
import TaskModule from './taskModule.js';

// Constants for configuration
const {
    DISCORD_BOT_TOKEN,
    MONGO_URL = 'mongodb://localhost:27017',
    DB_NAME = 'botDB',
    MESSAGE_LIMIT = 2000, // Discord's message character limit
    TASK_PROCESS_INTERVAL = 10000, // in milliseconds
} = process.env;

// Utility function for timestamped logs
function log(message, ...optionalParams) {
    console.log(`[${new Date().toISOString()}] ${message}`, ...optionalParams);
}

class DiscordModule {
    constructor(options = {}) {
        // Configuration options with defaults
        this.discordBotToken = options.discordBotToken || DISCORD_BOT_TOKEN;
        this.mongoUrl = options.mongoUrl || MONGO_URL;
        this.dbName = options.dbName || DB_NAME;
        this.messageLimit = options.messageLimit || MESSAGE_LIMIT;
        this.taskProcessInterval = options.taskProcessInterval || TASK_PROCESS_INTERVAL;

        // Initialize Discord Client with necessary intents
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ],
            partials: [Partials.Channel], // For handling partial data
        });

        // Initialize MongoDB client
        this.mongoClient = new MongoClient(this.mongoUrl);

        // Initialize TaskModule
        this.taskModule = options.taskModule || new TaskModule();

        // MongoDB collections
        this.db = null;
        this.collection = null;

        // Bind methods
        this.start = this.start.bind(this);
        this.setupEventHandlers = this.setupEventHandlers.bind(this);
        this.processDiscordPendingTasks = this.processDiscordPendingTasks.bind(this);
        this.shutdown = this.shutdown.bind(this);
    }

    /**
     * Initialize MongoDB and Discord Client, then start the bot.
     */
    async start() {
        try {
            await this.connectToMongoDB();
            this.setupEventHandlers();
            await this.loginToDiscord();
            log('DiscordModule started successfully.');
        } catch (error) {
            log('Error starting DiscordModule:', error);
            await this.shutdown();
            process.exit(1); // Exit the process if initialization fails
        }
    }

    /**
     * Connect to MongoDB and set up the collection.
     */
    async connectToMongoDB() {
        try {
            await this.mongoClient.connect();
            log('Connected to MongoDB.');

            this.db = this.mongoClient.db(this.dbName);
            this.collection = this.db.collection('messages');

            log('MongoDB collection initialized with necessary indexes.');
        } catch (error) {
            log('Error connecting to MongoDB:', error);
            throw error; // Rethrow to handle in the start method
        }
    }

    /**
     * Log in to Discord.
     */
    async loginToDiscord() {
        return new Promise((resolve, reject) => {
            this.client.once('ready', () => {
                log(`Discord bot logged in as ${this.client.user.tag}`);
                resolve();
            });

            this.client.on('error', (error) => {
                log('Discord client error:', error);
                reject(error);
            });

            this.client.login(this.discordBotToken).catch(reject);
        });
    }

    /**
     * Set up Discord event handlers.
     */
    setupEventHandlers() {
        this.client.on('messageCreate', this.handleMessageCreate.bind(this));
    }

    /**
     * Handle incoming Discord messages.
     * @param {Message} message - The Discord message object.
     */
    async handleMessageCreate(message) {
        try {
            // Ignore messages from bots to prevent feedback loops
            if (message.author.bot) return;

            // Prepare message data for MongoDB
            const messageData = {
                clientId: this.client.user.id,
                content: message.content,
                authorId: message.author.id,
                authorUsername: message.author.username,
                channelId: message.channel.id,
                channelName: message.channel.name || 'DM', // Handle DM channels
                createdAt: new Date(),
                mentions: message.mentions.members
                    ? Array.from(message.mentions.members.keys())
                    : [],
            };

            // Insert the message into MongoDB
            await this.collection.insertOne(messageData);
            log(`Message logged from ${message.author.username}: ${message.content}`);
        } catch (error) {
            log('Error handling messageCreate event:', error);
        }
    }

    /**
     * Process pending Discord tasks periodically.
     */
    async processDiscordPendingTasks() {
        try {
            log('Processing pending Discord tasks...');
            const tasks = await this.taskModule.getPendingTasks('discord');

            if (tasks.length === 0) {
                log('No pending Discord tasks to process.');
                return;
            }

            // Process tasks sequentially to manage rate limits
            for (const task of tasks) {
                await this.processSingleTask(task);
            }

            log('Finished processing Discord tasks.');
        } catch (error) {
            log('Error processing Discord pending tasks:', error);
        }
    }

    /**
     * Process a single Discord task.
     * @param {Object} task - The task object from TaskModule.
     */
    async processSingleTask(task) {
        try {
            const { channelId, content, _id } = task;

            if (!channelId) {
                log('Task missing channelId. Marking as failed.');
                await this.taskModule.updateTaskStatus(_id, 'failed');
                return;
            }

            // Fetch the channel
            const channel = await this.client.channels.fetch(channelId);

            if (!channel || !channel.isTextBased()) {
                log(`Channel not found or not text-based: ${channelId}`);
                await this.taskModule.updateTaskStatus(_id, 'failed');
                return;
            }

            // Split the message into chunks if necessary
            const messageChunks = this.chunkMessage(content);

            // Send each chunk sequentially
            for (const chunk of messageChunks) {
                await channel.send(chunk);
            }

            // Mark the task as completed
            await this.taskModule.updateTaskStatus(_id, 'completed');
            log(`Task ${_id} completed and message sent to channel ${channelId}.`);
        } catch (error) {
            log(`Error processing task ${task._id}:`, error);
            // Optionally, mark the task as failed or retry based on error type
            try {
                await this.taskModule.updateTaskStatus(task._id, 'failed');
            } catch (updateError) {
                log(`Failed to update task status for task ${task._id}:`, updateError);
            }
        }
    }

    /**
     * Split a long message into chunks adhering to Discord's character limit.
     * @param {string} content - The message content to split.
     * @returns {string[]} - Array of message chunks.
     */
    chunkMessage(content) {
        const maxLength = this.messageLimit;
        const paragraphs = content.split(/\n\s*\n/); // Split by double line breaks or multiple line breaks
        const chunks = [];
        let currentChunk = '';

        for (const paragraph of paragraphs) {
            const trimmedParagraph = paragraph.trim();

            if (trimmedParagraph.length === 0) {
                continue; // Skip empty paragraphs
            }

            // If the paragraph itself exceeds the limit, split it further
            if (trimmedParagraph.length > maxLength) {
                const subParagraphs = this.splitLongParagraph(trimmedParagraph);
                for (const sub of subParagraphs) {
                    if ((currentChunk + '\n\n' + sub).length > maxLength) {
                        if (currentChunk.length > 0) {
                            chunks.push(currentChunk.trim());
                            currentChunk = '';
                        }
                        chunks.push(sub);
                    } else {
                        currentChunk += (currentChunk.length ? '\n\n' : '') + sub;
                    }
                }
            } else if ((currentChunk + '\n\n' + trimmedParagraph).length > maxLength) {
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = trimmedParagraph;
            } else {
                currentChunk += (currentChunk.length ? '\n\n' : '') + trimmedParagraph;
            }
        }

        if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    /**
     * Split a long paragraph into smaller chunks based on sentences.
     * @param {string} paragraph - The long paragraph to split.
     * @returns {string[]} - Array of sub-paragraphs.
     */
    splitLongParagraph(paragraph) {
        const sentences = paragraph.match(/[^.!?]+[.!?]?/g) || [paragraph];
        const chunks = [];
        let currentChunk = '';

        for (const sentence of sentences) {
            if ((currentChunk + ' ' + sentence).length > this.messageLimit) {
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk.trim());
                    currentChunk = '';
                }
                // If the sentence itself is too long, force split
                if (sentence.length > this.messageLimit) {
                    const forcedChunks = this.forceSplit(sentence);
                    chunks.push(...forcedChunks);
                } else {
                    currentChunk = sentence;
                }
            } else {
                currentChunk += (currentChunk.length ? ' ' : '') + sentence;
            }
        }

        if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    /**
     * Forcefully split a very long string into smaller chunks.
     * @param {string} text - The long text to split.
     * @returns {string[]} - Array of forced chunks.
     */
    forceSplit(text) {
        const chunks = [];
        let start = 0;
        while (start < text.length) {
            const end = start + this.messageLimit;
            chunks.push(text.substring(start, end));
            start = end;
        }
        return chunks;
    }

    /**
     * Gracefully shut down the Discord client and MongoDB connection.
     */
    async shutdown() {
        try {
            log('Shutting down DiscordModule...');
            await this.client.destroy();
            log('Discord client destroyed.');

            await this.mongoClient.close();
            log('MongoDB connection closed.');
        } catch (error) {
            log('Error during DiscordModule shutdown:', error);
        }
    }
}

export default DiscordModule;
