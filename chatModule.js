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
        immediateTweet = true,
    ) {
        this.taskModule = new TaskModule();
        this.aiModule = new AIModule();
        this.mongoClient = new MongoClient(
            process.env.MONGO_URL || "mongodb://localhost:27017",
        );
        this.db = this.mongoClient.db("botDB");
        this.messageCollection = this.db.collection("messages");
        this.journalCollection = this.db.collection("journalEntries");
        this.pollingInterval = pollingInterval;
        this.engagementTimeout = engagementTimeout;
        this.immediateTweet = immediateTweet;
        this.defaultSystemPrompt = "You are Bob, the obsequious snake.";
        this.scheduleRandomTweet();
        this.journalOnStartup();
    }

    async startPolling() {
        console.log("ChatModule polling started...");
        setInterval(async () => {
            await this.processMessages();
        }, this.pollingInterval);
    }

    async processMessages() {
        const recentMessages = await this.messageCollection
            .find({
                createdAt: { $gt: new Date(Date.now() - this.pollingInterval) },
            })
            .toArray();

        const messagesByChannel = this.groupMessagesByChannel(recentMessages);

        for (const [channelId, messages] of Object.entries(messagesByChannel)) {
            const context = await this.getContextForChannel(
                channelId,
                messages,
            );
            const lastMessage = messages[messages.length - 1];

            const isTurgidSwamp = lastMessage.channelName === "turgid-swamp";
            const isMentioningBob = messages.some(
                (msg) =>
                    msg.content.toLowerCase().includes("bob") ||
                    msg.mentions.includes(msg.clientId),
            );
            const isEngagedUser = this.isUserEngaged(lastMessage.authorId);

            if (
                lastMessage.clientId !== lastMessage.authorId &&
                (isTurgidSwamp || isMentioningBob || isEngagedUser)
            ) {
                const aiResponse = await this.generateAIResponse(context);
                this.updateEngagement(lastMessage.authorId, channelId);
                await this.taskModule.addTask({
                    type: "discord",
                    content: aiResponse,
                    channelId: channelId,
                    status: "pending",
                    createdAt: new Date(),
                });
                console.log(
                    "ChatModule responded to context in channel:",
                    channelId,
                );
            }
        }
    }

    async journalOnStartup() {
        const latestJournalEntry = await this.composeJournalEntry();
        await this.storeJournalEntry(latestJournalEntry);
        await this.postJournalEntryToDiscord(
            latestJournalEntry,
            "turgid-swamp",
        );
    }

    async composeJournalEntry() {
        const previousEntries = await this.getPreviousJournalEntries();
        const recentMemories = await this.getRecentMemories();
        const journalPrompt = `It is ${getDayOfWeek()}
        Here are your previous journal entries:\n${previousEntries}
        Here's what you remember:\n${recentMemories}

        Reflect on your experiences, 
        thoughts, and the interactions you've had recently. 
        Use these memories to write a new journal entry. `;
        return await this.aiModule.chatWithAI(
            journalPrompt,
            this.defaultSystemPrompt,
        );
    }

    async getPreviousJournalEntries() {
        const previousEntries = await this.journalCollection
            .find()
            .sort({ createdAt: -1 })
            .limit(5)
            .toArray();
        return previousEntries
            .map((entry) => entry.entry)
            .join("\n\n");
    }

    async storeJournalEntry(journalEntry) {
        await this.journalCollection.insertOne({
            entry: journalEntry.trim(),
            createdAt: new Date(),
        });
    }

    async postJournalEntryToDiscord(journalEntry, channelName) {
        const targetChannel = await this.findChannelByName(channelName);
        if (targetChannel) {
            await this.taskModule.addTask({
                type: "discord",
                content: journalEntry.trim(),
                channelId: targetChannel.channelId,
                status: "pending",
                createdAt: new Date(),
            });
            console.log(`Posted journal entry to ${channelName}`);
        }
    }

    async findChannelByName(channelName) {
        const channel = await this.messageCollection.findOne({
            channelName: channelName,
        });
        return channel;
    }

    async scheduleRandomTweet() {
        if (this.immediateTweet) {
            console.log(
                "Immediate tweet flag is set. Composing and sending a tweet now.",
            );
            await this.composeAndSendTweet();
            this.immediateTweet = false;
        }
        const delay = this.getRandomDelay();
        setTimeout(async () => {
            await this.composeAndSendTweet();
            this.scheduleRandomTweet();
        }, delay);
    }

    async composeAndSendTweet() {
        const previousEntries = await this.getPreviousJournalEntries();
        const tweetPrompt = `Based on your recent reflections and memories,
        compose a SHORT post for X. Here's what you've been thinking about:\n
        
        ${previousEntries}\n\n
        
        Tweet MUST be less than 280 characters.`;
        const tweetContent = await this.aiModule.chatWithAI(
            tweetPrompt,
            this.defaultSystemPrompt,
        );
        await this.taskModule.addTask({
            type: "x",
            content: tweetContent.trim().substring(0, 280),
            status: "pending",
            createdAt: new Date(),
        });
        console.log(
            "Composed and scheduled a new post on X:",
            tweetContent.trim(),
        );
    }

    getRandomDelay() {
        const minDelay = 2 * 60 * 60 * 1000;
        const maxDelay = 4 * 60 * 60 * 1000;
        return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    }

    async getRecentMemories() {
        const memories = await this.messageCollection
            .find({})
            .sort({ createdAt: -1 })
            .limit(33)
            .toArray();
        
        return memories
        .map((msg) => `(${msg.channelName}) ${msg.authorUsername}: ${msg.content}`)
        .join("\n");
    }

    async getContextForChannel(channelId, messages) {
        const recentHistory = await this.messageCollection
            .find({ channelId })
            .sort({ createdAt: -1 })
            .limit(10)
            .toArray();
        const allMessages = [...messages, ...recentHistory.reverse()];
        return allMessages
            .map((msg) => `${msg.authorUsername}: ${msg.content}`)
            .join("\n");
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
        return (
            this.engagedUsers?.has(authorId) &&
            Date.now() - this.engagedUsers.get(authorId) <
                this.engagementTimeout
        );
    }

    updateEngagement(authorId, channelId) {
        if (!this.engagedUsers) {
            this.engagedUsers = new Map();
        }
        this.engagedUsers.set(authorId, Date.now());
        this.engagedUsers.set(channelId, Date.now());
    }

    async generateAIResponse(context) {
        const prompt = `${this.defaultSystemPrompt} Always
        respond with short snakey sentences, *actions*, and emojis.
        Reflect your current thoughts and memories in your response.`;
        return await this.aiModule.chatWithAI(
            `${prompt}\n\nContext:\n${context}\n\nBob: `,
        );
    }
}

export default ChatModule;
