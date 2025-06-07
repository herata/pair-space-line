# System Patterns: PairSpace LINE Bot

## Architecture Overview
The system follows a modular, event-driven architecture with clear separation of concerns:

```
LINE Platform → Webhook → Hono Router → Event Handlers → State Management → AI/Response
```

## Key Technical Decisions

### 1. Modular File Structure
- **Single Responsibility**: Each file handles one specific concern
- **Clear Imports**: Explicit, minimal imports reduce coupling
- **Type Safety**: Comprehensive TypeScript typing throughout

### 2. Unified State Management
- **UserState Interface**: Single state object for both diagnostic and chat
- **Mode Switching**: Clear transitions between "diagnostic" and "chat" modes
- **KV Storage**: Persistent state using Cloudflare KV with `user:${userId}` keys

### 3. Event-Driven Processing
- **Event Types**: follow, postback, message with specific handlers
- **Early Returns**: Guard clauses for clean flow control
- **Error Isolation**: Try-catch blocks prevent cascading failures

## Design Patterns in Use

### 1. Strategy Pattern (Mode Handling)
```typescript
if (userState.mode === "diagnostic") {
    // Diagnostic flow logic
} else {
    // AI chat logic
}
```

### 2. Factory Pattern (Client Creation)
```typescript
const client = getLineClient(env);
const cerebras = getCerebrasClient(env);
```

### 3. Command Pattern (Restart Triggers)
Multiple commands ("診断", "診断開始", "/diagnostic") trigger same diagnostic restart behavior.

## Component Relationships

### Core Components
1. **handlers.ts**: Main webhook logic and event routing
2. **types.ts**: Shared type definitions and contracts
3. **diagnosticFlow.ts**: Diagnostic-specific logic and UI components
4. **cerebrasClient.ts**: AI integration and response generation
5. **kvStore.ts**: State persistence and retrieval
6. **lineClient.ts**: LINE SDK wrapper and configuration

### Data Flow
1. **Incoming Event** → Event validation and parsing
2. **State Retrieval** → Get/create user state from KV
3. **Mode Processing** → Route to diagnostic or chat handler
4. **Response Generation** → Create appropriate LINE message
5. **State Persistence** → Save updated state to KV
6. **Reply Sending** → Send response via LINE API

## Error Handling Strategy
- **Graceful Degradation**: Fallback messages when AI fails
- **User-Friendly Errors**: Clear Japanese error messages
- **Comprehensive Logging**: Detailed console logs for debugging
- **Recovery Paths**: Always provide way for user to continue

## Performance Patterns
- **Parallel Processing**: Multiple replies queued and sent together
- **State Efficiency**: Minimal KV operations per request
- **Memory Management**: Chat history limited to 10 messages
- **Fast Responses**: Early returns and minimal processing chains
