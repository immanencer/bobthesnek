import TaskModule from "./taskModule.js";
import AIModule from "./aiModule.js";
import { MongoClient } from "mongodb";

function getDayOfWeek() {
    const daysOfWeek = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
    ];
    const today = new Date();
    return daysOfWeek[today.getDay()];
}

class ChatModule {
    constructor(
        pollingInterval = 5 * 1000,
        engagementTimeout = 5 * 60 * 1000,
        immediateTweet = true
    ) {
        // Initialize modules
        this.taskModule = new TaskModule();
        this.aiModule = new AIModule();

        // Initialize MongoDB client
        const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017";
        this.mongoClient = new MongoClient(mongoUrl);

        // Initialize engagement tracking
        this.engagedUsers = new Map();

        // Configuration parameters
        this.pollingInterval = pollingInterval;
        this.engagementTimeout = engagementTimeout;
        this.immediateTweet = immediateTweet;
        this.defaultSystemPrompt = "You are Bob, the obsequious snake.";

        // Channel configurations (externalized)
        this.journalChannelName = process.env.JOURNAL_CHANNEL_NAME || "turgid-swamp";
        this.tweetChannelName = process.env.TWEET_CHANNEL_NAME || "tweets";

        // Initialize MongoDB collections
        this.db = null;
        this.messageCollection = null;
        this.journalCollection = null;

        // Bind methods
        this.startPolling = this.startPolling.bind(this);
        this.processMessages = this.processMessages.bind(this);
        this.scheduleRandomTweet = this.scheduleRandomTweet.bind(this);
    }

    async initialize() {
        try {
            await this.mongoClient.connect();
            console.log("Connected to MongoDB.");

            this.db = this.mongoClient.db("botDB");
            this.messageCollection = this.db.collection("messages");
            this.journalCollection = this.db.collection("journalEntries");

            // Start polling and scheduling tasks
            await this.journalOnStartup();
            this.startPolling();
            this.scheduleRandomTweet();
        } catch (error) {
            console.error("Initialization error:", error);
            process.exit(1); // Exit process if initialization fails
        }
    }

    async close() {
        try {
            await this.mongoClient.close();
            console.log("MongoDB connection closed.");
        } catch (error) {
            console.error("Error closing MongoDB connection:", error);
        }
    }

    async startPolling() {
        console.log("ChatModule polling started...");
        // Use a self-invoking async loop to prevent overlapping executions
        const poll = async () => {
            try {
                await this.processMessages();
            } catch (error) {
                console.error("Error processing messages:", error);
            } finally {
                setTimeout(poll, this.pollingInterval);
            }
        };
        poll();
    }

    async processMessages() {
        try {
            const since = new Date(Date.now() - this.pollingInterval);
            const recentMessages = await this.messageCollection
                .find({ createdAt: { $gt: since } })
                .toArray();

            if (!recentMessages.length) {
                return; // No new messages to process
            }

            const messagesByChannel = this.groupMessagesByChannel(recentMessages);

            for (const [channelId, messages] of Object.entries(messagesByChannel)) {
                const context = await this.getContextForChannel(channelId, messages);
                const lastMessage = messages[messages.length - 1];

                const isJournalChannel = lastMessage.channelName === this.journalChannelName;
                const isMentioningBob = messages.some(
                    (msg) =>
                        msg.content.toLowerCase().includes("bob") ||
                        (Array.isArray(msg.mentions) && msg.mentions.includes(msg.clientId))
                );
                const isEngagedUser = this.isUserEngaged(lastMessage.authorId);

                if (
                    lastMessage.clientId !== lastMessage.authorId &&
                    (isJournalChannel || isMentioningBob || isEngagedUser)
                ) {
                    const aiResponse = await this.generateAIResponse(context);
                    this.updateEngagement(lastMessage.authorId);
                    await this.taskModule.addTask({
                        type: "discord",
                        content: aiResponse,
                        channelId: channelId,
                        status: "pending",
                        createdAt: new Date(),
                    });
                    console.log(
                        `ChatModule responded to context in channel: ${channelId}`
                    );
                }
            }
        } catch (error) {
            console.error("Error in processMessages:", error);
        }
    }

    async journalOnStartup() {
        try {
            const latestJournalEntry = await this.composeJournalEntry();
            await this.storeJournalEntry(latestJournalEntry);
            await this.postJournalEntryToDiscord(
                latestJournalEntry,
                this.journalChannelName
            );
            console.log("Journal entry composed and posted on startup.");
        } catch (error) {
            console.error("Error during journalOnStartup:", error);
        }
    }

    async composeJournalEntry() {
        try {
            const previousEntries = await this.getPreviousJournalEntries();
            const recentMemories = await this.getRecentMemories();
            const journalPrompt = `It is ${getDayOfWeek()}.
Here are your previous journal entries:
${previousEntries}

Here's what you remember:
${recentMemories}

Reflect on your experiences, thoughts, and the interactions you've had recently. Use these memories to write a new journal entry.`;
            const journalEntry = await this.aiModule.chatWithAI(
                journalPrompt,
                this.defaultSystemPrompt
            );
            return journalEntry;
        } catch (error) {
            console.error("Error composing journal entry:", error);
            throw error;
        }
    }

    async getPreviousJournalEntries() {
        try {
            const previousEntries = await this.journalCollection
                .find()
                .sort({ createdAt: -1 })
                .limit(5)
                .toArray();
            return previousEntries
                .map((entry) => entry.entry)
                .join("\n\n");
        } catch (error) {
            console.error("Error fetching previous journal entries:", error);
            return "";
        }
    }

    async storeJournalEntry(journalEntry) {
        try {
            await this.journalCollection.insertOne({
                entry: journalEntry.trim(),
                createdAt: new Date(),
            });
            console.log("Journal entry stored successfully.");
        } catch (error) {
            console.error("Error storing journal entry:", error);
        }
    }

    async postJournalEntryToDiscord(journalEntry, channelName) {
        try {
            const targetChannel = await this.findChannelByName(channelName);
            if (targetChannel) {
                await this.taskModule.addTask({
                    type: "discord",
                    content: journalEntry.trim(),
                    channelId: targetChannel.channelId,
                    status: "pending",
                    createdAt: new Date(),
                });
                console.log(`Posted journal entry to channel: ${channelName}`);
            } else {
                console.warn(`Channel not found: ${channelName}`);
            }
        } catch (error) {
            console.error("Error posting journal entry to Discord:", error);
        }
    }

    async findChannelByName(channelName) {
        try {
            const channel = await this.messageCollection.findOne({
                channelName: channelName,
            }, { projection: { channelId: 1 } }); // Fetch only channelId
            return channel;
        } catch (error) {
            console.error(`Error finding channel by name (${channelName}):`, error);
            return null;
        }
    }

    async scheduleRandomTweet() {
        try {
            if (this.immediateTweet) {
                console.log(
                    "Immediate tweet flag is set. Composing and sending a tweet now."
                );
                await this.composeAndSendTweet();
                this.immediateTweet = false;
            }
            const delay = this.getRandomDelay();
            setTimeout(async () => {
                try {
                    await this.composeAndSendTweet();
                } catch (error) {
                    console.error("Error composing and sending tweet:", error);
                } finally {
                    this.scheduleRandomTweet(); // Reschedule regardless of success/failure
                }
            }, delay);
        } catch (error) {
            console.error("Error in scheduleRandomTweet:", error);
        }
    }

    async composeAndSendTweet() {
        try {
            const previousEntries = await this.getPreviousJournalEntries();
            const tweetPrompt = `Based on your recent reflections and memories, compose a SHORT post for X. Here's what you've been thinking about:

${previousEntries}

Tweet MUST be less than 280 characters.`;
            let tweetContent = await this.aiModule.chatWithAI(
                tweetPrompt,
                this.defaultSystemPrompt
            );
            tweetContent = tweetContent.trim().substring(0, 280);
            if (tweetContent.length === 0) {
                console.warn("AI returned an empty tweet. Skipping.");
                return;
            }
            await this.taskModule.addTask({
                type: "x",
                content: tweetContent,
                status: "pending",
                createdAt: new Date(),
            });
            console.log(`Composed and scheduled a new post on X: ${tweetContent}`);
        } catch (error) {
            console.error("Error in composeAndSendTweet:", error);
            throw error;
        }
    }

    getRandomDelay() {
        const minDelay = 2 * 60 * 60 * 1000; // 2 hours in ms
        const maxDelay = 4 * 60 * 60 * 1000; // 4 hours in ms
        return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    }

    async getRecentMemories() {
        try {
            const memories = await this.messageCollection
                .find({})
                .sort({ createdAt: -1 })
                .limit(33)
                .toArray();

            return memories
                .map(
                    (msg) =>
                        `(${msg.channelName}) ${msg.authorUsername}: ${msg.content}`
                )
                .join("\n");
        } catch (error) {
            console.error("Error fetching recent memories:", error);
            return "";
        }
    }

    async getContextForChannel(channelId, messages) {
        try {
            const recentHistory = await this.messageCollection
                .find({ channelId: channelId })
                .sort({ createdAt: -1 })
                .limit(10)
                .toArray();
            // Combine and sort messages chronologically
            const allMessages = [...recentHistory, ...messages].sort(
                (a, b) => a.createdAt - b.createdAt
            );
            return allMessages
                .map((msg) => `${msg.authorUsername}: ${msg.content}`)
                .join("\n");
        } catch (error) {
            console.error(`Error getting context for channel (${channelId}):`, error);
            return "";
        }
    }

    groupMessagesByChannel(messages) {
        return messages.reduce((acc, message) => {
            if (!acc[message.channelId]) {
                acc[message.channelId] = [];
            }
            acc[message.channelId].push(message);
            return acc;
        }, {});
    }

    isUserEngaged(authorId) {
        if (!authorId) return false;
        const lastEngagement = this.engagedUsers.get(authorId);
        if (!lastEngagement) return false;
        return Date.now() - lastEngagement < this.engagementTimeout;
    }

    updateEngagement(authorId) {
        if (!authorId) return;
        this.engagedUsers.set(authorId, Date.now());
    }

    async generateAIResponse(context) {
        try {
            const prompt = `${this.defaultSystemPrompt} Always respond with short snakey sentences, *actions*, and emojis. Reflect your current thoughts and memories in your response.`;
            const fullPrompt = `${prompt}

Context:
${context}

Bob:`;
            const aiResponse = await this.aiModule.chatWithAI(fullPrompt);
            return aiResponse;
        } catch (error) {
            console.error("Error generating AI response:", error);
            return "I'm sorry, I can't respond right now.";
        }
    }
}

export default ChatModule;
