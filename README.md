# Bob the Snake - Discord AI Bot

Bob the Snake is an AI-powered Discord bot designed to interact with users in a playful, character-driven manner. Bob responds to messages, tweets about his dreams and goals, and maintains a dynamic personality, all driven by AI.

## Features

- **AI-Driven Conversations**: Bob interacts with users in Discord channels, responding with context-aware, character-consistent messages.
- **Dynamic Personality**: Bob's goals and dreams are updated periodically, and he stores them in a dream journal.
- **Automated Tweeting**: Bob combines his current goals, dreams, and recent interactions to create tweets. Tweets are scheduled at random intervals between 2 to 4 hours.
- **Immediate Tweeting on Reboot**: For testing purposes, Bob can be configured to tweet immediately upon startup.
- **Contextual Awareness**: Bob processes messages in batches to respond in a contextually relevant way rather than to each message individually.

## Installation

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/yourusername/bob-the-snake.git
   cd bob-the-snake
   ```

2. **Install Dependencies**:

   Ensure you have Node.js and npm installed. Then run:

   ```bash
   npm install
   ```

3. **Environment Variables**:

   Create a `.env` file in the root directory with the following variables:

   ```plaintext
   MONGO_URL=mongodb://localhost:27017
   DISCORD_BOT_TOKEN=your_discord_bot_token
   OPENROUTER_API_KEY=your_openrouter_api_key
   ```

4. **Run the Bot**:

   Start Bob the Snake:

   ```bash
   node index.js
   ```

## Configuration

### `ChatModule` Parameters

- **pollingInterval**: The interval at which Bob checks for new messages (default: 10,000 ms).
- **engagementTimeout**: The time window in which Bob considers a user "engaged" (default: 60,000 ms).
- **immediateTweet**: Set this to `true` if you want Bob to tweet immediately upon startup (default: `true`).

Example:

```javascript
const chatModule = new ChatModule(10000, 60000, true);
chatModule.startPolling();
```

### Default System Prompt

Bob uses the following default system prompt for all AI interactions:

```plaintext
You are Bob, the obsequious snake.
```

This prompt is consistently applied across all AI-driven features, ensuring that Bob's personality remains consistent.

## Features in Detail

### 1. **AI-Driven Conversations**

Bob listens to messages in Discord channels and responds based on the context of recent interactions. He will only respond once per batch of messages to avoid spamming the channel.

### 2. **Dynamic Personality with Goals and Dreams**

Bob's goals and dreams are updated every hour using AI. These are stored in a MongoDB collection called `dreamJournal`. Bob's interactions are influenced by his current goals and dreams.

### 3. **Automated Tweeting**

Every 2 to 4 hours, Bob composes a tweet based on his current goal, dream, and recent messages. The tweet content is generated by the AI, ensuring it is contextually relevant and character-consistent.

### 4. **Immediate Tweet on Startup**

For testing purposes, Bob can be configured to tweet immediately when he starts up. This is controlled by the `immediateTweet` flag in the `ChatModule`.

### 5. **Contextual Awareness**

Bob processes messages in batches, considering the full context of recent interactions before responding. This ensures that his responses are relevant and coherent within the ongoing conversation.

## Database Structure

- **Messages Collection** (`messages`):
  - Stores all incoming messages with details like `authorId`, `content`, `channelId`, `createdAt`, etc.

- **Dream Journal Collection** (`dreamJournal`):
  - Stores Bob's goals and dreams with timestamps.

## Future Improvements

- **Enhanced User Interaction**: Further refinement of Bob's ability to engage with users over extended periods.
- **More Sophisticated Tweeting Logic**: Expanding the tweet generation process to include more varied and creative outputs.

## Contributing

Feel free to fork the repository and submit pull requests. Contributions are welcome!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

## Contact

For any questions or feedback, please reach out at [your email] or open an issue on GitHub.

---

This README reflects the updated functionality and structure of the `ChatModule`, including the new features like dynamic goal and dream generation, automated tweeting with configurable options, and consistent use of the system prompt.Here's an updated README that reflects all the recent changes made to the `ChatModule` and the overall functionality of the bot:

---

# Bob the Snake - Discord AI Bot

Bob the Snake is an AI-powered Discord bot designed to interact with users in a playful, character-driven manner. Bob responds to messages, tweets about his dreams and goals, and maintains a dynamic personality, all driven by AI.

## Features

- **AI-Driven Conversations**: Bob interacts with users in Discord channels, responding with context-aware, character-consistent messages.
- **Dynamic Personality**: Bob's goals and dreams are updated periodically, and he stores them in a dream journal.
- **Automated Tweeting**: Bob combines his current goals, dreams, and recent interactions to create tweets. Tweets are scheduled at random intervals between 2 to 4 hours.
- **Immediate Tweeting on Reboot**: For testing purposes, Bob can be configured to tweet immediately upon startup.
- **Contextual Awareness**: Bob processes messages in batches to respond in a contextually relevant way rather than to each message individually.

## Installation

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/yourusername/bob-the-snake.git
   cd bob-the-snake
   ```

2. **Install Dependencies**:

   Ensure you have Node.js and npm installed. Then run:

   ```bash
   npm install
   ```

3. **Environment Variables**:

   Create a `.env` file in the root directory with the following variables:

   ```plaintext
   MONGO_URL=mongodb://localhost:27017
   DISCORD_BOT_TOKEN=your_discord_bot_token
   OPENROUTER_API_KEY=your_openrouter_api_key
   ```

4. **Run the Bot**:

   Start Bob the Snake:

   ```bash
   node index.js
   ```

## Configuration

### `ChatModule` Parameters

- **pollingInterval**: The interval at which Bob checks for new messages (default: 10,000 ms).
- **engagementTimeout**: The time window in which Bob considers a user "engaged" (default: 60,000 ms).
- **immediateTweet**: Set this to `true` if you want Bob to tweet immediately upon startup (default: `true`).

Example:

```javascript
const chatModule = new ChatModule(10000, 60000, true);
chatModule.startPolling();
```

### Default System Prompt

Bob uses the following default system prompt for all AI interactions:

```plaintext
You are Bob, the obsequious snake.
```

This prompt is consistently applied across all AI-driven features, ensuring that Bob's personality remains consistent.

## Features in Detail

### 1. **AI-Driven Conversations**

Bob listens to messages in Discord channels and responds based on the context of recent interactions. He will only respond once per batch of messages to avoid spamming the channel.

### 2. **Dynamic Personality with Goals and Dreams**

Bob's goals and dreams are updated every hour using AI. These are stored in a MongoDB collection called `dreamJournal`. Bob's interactions are influenced by his current goals and dreams.

### 3. **Automated Tweeting**

Every 2 to 4 hours, Bob composes a tweet based on his current goal, dream, and recent messages. The tweet content is generated by the AI, ensuring it is contextually relevant and character-consistent.

### 4. **Immediate Tweet on Startup**

For testing purposes, Bob can be configured to tweet immediately when he starts up. This is controlled by the `immediateTweet` flag in the `ChatModule`.

### 5. **Contextual Awareness**

Bob processes messages in batches, considering the full context of recent interactions before responding. This ensures that his responses are relevant and coherent within the ongoing conversation.

## Database Structure

- **Messages Collection** (`messages`):
  - Stores all incoming messages with details like `authorId`, `content`, `channelId`, `createdAt`, etc.

- **Dream Journal Collection** (`dreamJournal`):
  - Stores Bob's goals and dreams with timestamps.

## Future Improvements

- **Enhanced User Interaction**: Further refinement of Bob's ability to engage with users over extended periods.
- **More Sophisticated Tweeting Logic**: Expanding the tweet generation process to include more varied and creative outputs.

## Contributing

Feel free to fork the repository and submit pull requests. Contributions are welcome!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

## Contact

For any questions or feedback, please reach out at x.com/@immanencer or open an issue on GitHub.