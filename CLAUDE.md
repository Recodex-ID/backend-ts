# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development server with hot reload
npm run debug

# Build and run production
npm run start

# Linting
npm run lint

# Build only (TypeScript compilation)
tsc
```

## Architecture Overview

This is a TypeScript Express.js backend application with JWT authentication and MongoDB integration. The architecture follows a modular pattern with clear separation of concerns:

### Core Structure

- **Entry Point**: `src/index.ts` - Express server setup with configuration loading
- **Routing**: `src/router.ts` - Main router that delegates to controller modules
- **Controllers**: `src/controller/` - Request handlers with authentication and CRUD operations
- **Models**: `src/model/` - Database models and user management logic
- **Library**: `src/library/` - Utilities for configuration, JWT signing, and helpers
- **Schemas**: `src/schema/` - Mongoose schemas for database entities

### Key Architectural Patterns

**Configuration Management**: 
- Config stored in user home directory under `.edifly-si/config.json`
- Environment-based configuration with defaults in `src/library/config.ts`
- Supports development vs production settings via `isStaging` flag

**Authentication System**:
- RSA256 JWT tokens using public/private key pairs in `key/` directory
- JWT tokens expire in 5 hours with refresh capability
- Custom auth middleware in `src/controller/utils.ts:AuthMiddleware`
- CAPTCHA protection for login endpoints

**Generic CRUD Controllers**:
- Factory pattern in `src/controller/utils.ts:createCrudController` 
- Provides standard REST endpoints: GET, POST, pagination, search, detail views
- Configurable with custom hooks: beforeSave, afterSave, beforeRead, etc.
- Built-in privilege checking based on user level bitmasks

**User Management**:
- Factory pattern in `src/model/base_users.ts` creates user controllers
- Password hashing with HMAC-SHA256 + salt
- User levels as bitmask for granular permissions
- Soft delete support with `deleted` flag

### Database Integration

Uses Mongoose with:
- Auto-population of referenced documents via `mongoose-autopopulate`
- Text search capabilities with `$text` operator support
- Audit fields: `createdBy`, `createdAt`, `deletedBy`, `deletedAt`
- Unique constraints (e.g., username uniqueness)

### Security Features

- JWT-based authentication with RSA256 signatures
- CAPTCHA validation for login attempts
- Configurable auth header name via `AUTHHEADER` environment variable
- Password hashing with application-specific salt
- Activity logging for security events

### Development Notes

- Uses `ts-node-dev` for development with file watching
- ESLint configuration with TypeScript support
- Docker support with production optimizations
- Public/private key pairs must be generated using `generateKey.sh`
- No test framework currently configured (shows placeholder in package.json)

### Environment Variables

Required:
- `SALT` - Password hashing salt (defaults to hardcoded value)
- `AUTHHEADER` - HTTP header name for auth tokens (defaults to 'srawung-token')
- `NAME` - Application name for config directory (defaults to '.edifly-si')

The application loads configuration from `~/.{NAME}/config.json` and merges with defaults.