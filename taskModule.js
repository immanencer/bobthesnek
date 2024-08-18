import { MongoClient, ObjectId } from 'mongodb';

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = 'botDB';
const collectionName = 'tasks';

class TaskModule {
    constructor() {
        this.client = new MongoClient(mongoUrl);
    }

    async connect() {
        if (!this.db) {
            await this.client.connect();
            this.db = this.client.db(dbName);
            this.collection = this.db.collection(collectionName);
        }
    }

    async addTask(task) {
        await this.connect();
        await this.collection.insertOne(task);
    }

    async getPendingTasks(type) {
        await this.connect();
        return await this.collection.find({ type, status: 'pending' }).toArray();
    }

    async updateTaskStatus(taskId, status) {
        await this.connect();
        await this.collection.updateOne({ _id: new ObjectId(taskId) }, { $set: { status } });
    }

    async disconnect() {
        await this.client.close();
    }
}

export default TaskModule;
