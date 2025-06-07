# Tech Context: PairSpace LINE Bot

## Technologies Used

### Runtime & Framework
- **Cloudflare Workers**: Serverless edge computing platform
- **Hono**: Lightweight TypeScript web framework
- **TypeScript**: Type-safe JavaScript with strict mode enabled

### Integrations
- **LINE Bot SDK**: Official SDK for LINE messaging platform
- **Cerebras Cloud SDK**: High-performance AI inference API
- **Cloudflare KV**: Distributed key-value storage

### Development Tools
- **Biome**: Fast linter and formatter (replaces ESLint + Prettier)
- **Wrangler**: Cloudflare Workers CLI for development and deployment

## Development Setup

### Prerequisites
- Node.js (latest LTS)
- npm package manager
- Cloudflare account with Workers plan
- LINE Developer account
- Cerebras API account

### Local Development
```bash
npm install
npm run dev          # Start local development server
npm run fix         # Run Biome linter/formatter
```

### Deployment
```bash
npm run deploy      # Deploy to Cloudflare Workers
npm run cf-typegen  # Generate Cloudflare types
```

## Environment Variables
Required in Cloudflare Workers environment:
- `LINE_CHANNEL_SECRET`: LINE bot channel secret
- `LINE_CHANNEL_ACCESS_TOKEN`: LINE bot access token  
- `CEREBRAS_API_KEY`: Cerebras Cloud API key
- `USER_STATE`: Cloudflare KV namespace binding

## Technical Constraints

### Cloudflare Workers Limits
- **Memory**: 128MB per request
- **CPU Time**: 10ms on free plan, 50ms on paid
- **Request Size**: 100MB maximum
- **KV Operations**: Rate limited based on plan

### LINE Bot Limitations
- **Message Types**: Text, Flex, QuickReply supported
- **Reply Limit**: Must reply within 30 seconds
- **Push vs Reply**: Reply tokens single-use only

### Cerebras API
- **Model**: llama3.1-8b-instant used for speed/cost balance
- **Context Length**: Limited, so chat history trimmed to 10 messages
- **Rate Limits**: Applied based on API plan

## Dependencies Management

### Production Dependencies
- `@cerebras/cerebras_cloud_sdk`: AI inference client
- `@line/bot-sdk`: LINE platform integration
- `hono`: Web framework

### Development Dependencies
- `@biomejs/biome`: Linting and formatting
- `@cloudflare/workers-types`: TypeScript definitions
- `wrangler`: Development and deployment CLI

## Security Considerations
- **Webhook Validation**: LINE signature verification enabled
- **Environment Variables**: Secrets stored in Cloudflare environment
- **Type Safety**: Strict TypeScript prevents runtime errors
- **Input Validation**: Event data validated before processing

## Performance Optimizations
- **Modular Imports**: Tree-shaking for smaller bundle size
- **Early Returns**: Reduce unnecessary processing
- **Parallel Promises**: Multiple replies sent concurrently
- **KV Efficiency**: Single read/write per user interaction
