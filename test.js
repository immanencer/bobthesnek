import { MongoClient } from 'mongodb';
import TaskModule from './taskModule.js';
import AIModule from './aiModule.js';
import XModule from './xModule.js';
import DiscordModule from './discordModule.js';
import ChatModule from './chatModule.js';

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = 'testBobDB';

// Initialize Modules
const taskModule = new TaskModule();
const aiModule = new AIModule();
const xModule = new XModule();
const discordModule = new DiscordModule();
const chatModule = new ChatModule();

// Utility function to clear the test database
async function clearDatabase() {
    const client = new MongoClient(mongoUrl);
    await client.connect();
    const db = client.db(dbName);
    // await db.dropDatabase();
    console.warn("drop database manually");
    await client.close();
}

// Testing TaskModule
async function testTaskModule() {
    console.log('Testing TaskModule...');

    // Clear database before testing
    await clearDatabase();

    // Test adding a task
    await taskModule.addTask({ type: 'test', content: 'This is a test', status: 'pending', createdAt: new Date() });

    // Test retrieving tasks
    const tasks = await taskModule.getPendingTasks('test');
    console.assert(tasks.length > 0, 'Should retrieve the test task');

    // Test updating a task
    await taskModule.updateTaskStatus(tasks[0]._id, 'completed');
    const updatedTasks = await taskModule.getPendingTasks('test');
    console.assert(updatedTasks.length === 0, 'Should have no pending test tasks after update');

    console.log('TaskModule tests passed.');
}

// Testing AIModule
let message = "this is a test message"
async function testAIModule() {
    console.log('Testing AIModule...');

    // Test AI response
    const response = await aiModule.chatWithAI('write a tweet to send to the world as Bob the obsequious snake, no more than 140 characters');
    console.assert(response, 'AI response should not be empty');
    console.log('AIModule tests passed.');
    message = response;
}

// Testing XModule
async function testXModule() {
    console.log('Testing XModule...');

    // Test Twitter posting (consider using a mock or test Twitter account)
    await xModule.postTweet(message);
    console.log('Test tweet posted successfully.');

    console.log('XModule tests passed.');
}

// Testing DiscordModule (requires a running Discord bot in a server)
async function testDiscordModule() {
    console.log('Testing DiscordModule...');

    // Starting the Discord bot and processing tasks
    discordModule.start();
    setTimeout(async () => {
        await discordModule.processDiscordPendingTasks();
        console.log('DiscordModule tests passed.');
    }, 5000); // Delay to allow Discord bot to initialize
}

// Testing ChatModule
async function testChatModule() {
    console.log('Testing ChatModule...');

    // Test chat task creation
    await chatModule.createChatTask({ content: 'Test message', channelId: '1227366562743451711' });
    console.log('Chat task created successfully.');

    // Start polling (observe logs to verify polling and task processing)
    chatModule.startPolling();

    console.log('ChatModule tests started. Observe logs for processing.');
}

// Run all tests
async function runTests() {
    await testTaskModule();
    await testAIModule();
    await testXModule();
    await testDiscordModule();
    await testChatModule();
}

runTests().then(() => {
    console.log('All tests completed.');
}).catch(err => {
    console.error('Test suite failed:', err);
});
