# Project Brief: PairSpace LINE Bot

## Project Overview
PairSpace LINE Bot is an intelligent housing assistance chatbot that combines a structured diagnostic flow with AI-powered chat functionality. Built on Cloudflare Workers using the Hono framework, it integrates LINE Bot SDK with Cerebras AI to provide personalized housing subsidy information and general real estate guidance.

## Core Requirements
1. **Diagnostic Flow**: 3-step housing subsidy assessment when users follow the bot
2. **AI Chat Integration**: Seamless transition to AI-powered chat after diagnostic completion
3. **Restart Functionality**: Multiple ways to restart diagnostic (commands, buttons)
4. **Production Ready**: Deployed on Cloudflare Workers with proper error handling and logging

## Key Features
- **Friend Follow → Diagnostic**: Automatic diagnostic flow initiation
- **QuickReply Interface**: Interactive buttons for diagnostic responses
- **Flex Message Results**: Rich card display for diagnostic results
- **AI Chat Mode**: Cerebras-powered conversational AI with emoji-rich responses
- **State Management**: Persistent user state using Cloudflare KV storage
- **Multiple Restart Triggers**: "診断", "診断開始", "/diagnostic" commands and buttons

## Technical Stack
- **Runtime**: Cloudflare Workers
- **Framework**: Hono (TypeScript)
- **Messaging**: LINE Bot SDK
- **AI**: Cerebras Cloud SDK
- **Storage**: Cloudflare KV
- **Linting**: Biome

## Success Criteria
- Users can complete full diagnostic flow via QuickReply interactions
- Smooth transition from diagnostic to AI chat mode
- AI provides helpful housing/real estate guidance without markdown formatting
- System maintains user state across interactions
- Production deployment handles errors gracefully with comprehensive logging

## Scope
**In Scope**:
- Housing subsidy diagnostic (3 questions)
- AI chat for housing/real estate questions
- State persistence and management
- Production deployment and monitoring

**Out of Scope**:
- LIFF integration (placeholder only)
- Advanced real estate APIs
- User authentication beyond LINE ID
- Complex analytics or reporting
