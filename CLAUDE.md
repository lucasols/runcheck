# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Runcheck is a lightweight TypeScript runtime type validation library with autofix support. It's designed to be tiny (<2KB gzipped), fast, tree-shakeable, and zero-dependency.

## Development Commands

### Essential Commands
```bash
# Testing
pnpm test:watch          # Run tests with UI and type checking in watch mode
pnpm test               # Run tests once with type checking

# Linting & Type Checking
pnpm lint               # Run TypeScript compiler and ESLint (ALWAYS run this)
pnpm tsc                # Run TypeScript compiler only
pnpm eslint             # Run ESLint only

# Building
pnpm build              # Full build: test + lint + build
pnpm build:no-test      # Build without running tests
```

### Other Commands
```bash
# Benchmarking
pnpm benchmark          # Run benchmarks
pnpm benchmark-to-ref   # Benchmark against reference

# Publishing
pnpm pre-publish        # Pre-publish checks and build
```

## Code Architecture

### Core Type System
- **Central types**: `RcType<T>` and `RcBase<T, RequiredKey>` form the foundation
- **Internal parsing**: `InternalParseResult<T>` with context tracking (`ParseResultCtx`)
- **Result types**: `RcOkResult<T>` and `RcErrorResult<T>` for type-safe results
- **Functional composition**: Types are immutable and composable via methods like `.optional()`, `.where()`, `.withFallback()`

### Key Patterns
1. **Immutable type composition**: Each modifier returns a new type instance
2. **Context-aware parsing**: Parsing context tracks path, warnings, and strict mode
3. **Error path tracking**: Detailed error messages with full property paths
4. **Lazy evaluation**: Recursive types use lazy evaluation to handle circular references
5. **Performance optimizations**: Short-circuiting, memoization, and V8 deoptimization prevention

### Main Source Files
- `src/runcheck.ts`: Core library and type definitions
- `src/autofixable.ts`: Predefined autofix types 
- `src/rc_object.ts`: Object validation logic
- `src/rc_discriminated_union.ts`: Discriminated union types
- `src/rc_intersection.ts`: Intersection types

### Type System Features
- **Union types**: `rc_union` with intelligent error handling
- **Object validation**: Flexible object schemas with optional/required keys
- **Array validation**: Both strict and loose array validation modes
- **Autofix system**: Automatic data transformation for invalid inputs
- **Fallback system**: Default values when validation fails
- **Standard Schema integration**: Compatible with Standard Schema specification

## Testing

- **Framework**: Vitest with UI mode and type checking
- **Test files**: Located in `tests/` directory
- **Test utilities**: `testUtils.ts` provides helper functions
- **Type testing**: `typingTests.ts` contains type-level tests
- **Timeout**: 2 seconds per test

## Performance Considerations

- Extensive benchmarking setup in `benchmarks/` directory
- Performance profiling tools available
- Optimized for V8 engine with specific patterns
- Bundle size is a primary concern - keep additions minimal

## Configuration

- **TypeScript**: Strict mode enabled, ESNext target
- **Build**: tsup with ESM/CommonJS, minification, source maps
- **Linting**: TypeScript ESLint with strict rules, property mangling for optimization
- **Testing**: Vitest with UI mode and comprehensive coverage

## Important Notes

- Always run `pnpm lint` before committing - this runs both TypeScript compiler and ESLint
- The library is performance-critical - benchmark significant changes
- Maintain zero external dependencies
- Follow immutable patterns for type composition
- Use context-aware parsing for detailed error messages