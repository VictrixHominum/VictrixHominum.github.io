---
title: Understanding TypeScript Generics
date: 2026-02-20
excerpt: Generics are one of TypeScript's most powerful features. Here's a practical guide to using them effectively.
tags: [TypeScript, Programming, Tutorial]
author: VictrixHominum
---

## What Are Generics?

Generics allow you to write flexible, reusable code that works with multiple types while maintaining type safety. Think of them as type parameters for your functions, classes, and interfaces.

## Basic Syntax

```typescript
function identity<T>(arg: T): T {
  return arg;
}

const num = identity(42);       // type: number
const str = identity("hello");  // type: string
```

The `<T>` syntax declares a type variable that gets inferred from usage.

## Constraining Generics

You can restrict what types are allowed using `extends`:

```typescript
interface HasLength {
  length: number;
}

function logLength<T extends HasLength>(arg: T): T {
  console.log(arg.length);
  return arg;
}

logLength("hello");     // OK - strings have length
logLength([1, 2, 3]);   // OK - arrays have length
// logLength(42);        // Error - numbers don't have length
```

## Generic Interfaces

Generics shine when defining reusable data structures:

```typescript
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

type UserResponse = ApiResponse<User>;
type PostResponse = ApiResponse<Post[]>;
```

## Practical Tips

1. **Start simple** - Don't add generics until you need them
2. **Use meaningful names** - `TItem` is clearer than `T` in complex scenarios
3. **Leverage inference** - Let TypeScript figure out the types when possible
4. **Constrain when needed** - Use `extends` to prevent misuse

Generics are a deep topic, but mastering the basics will significantly improve your TypeScript code.
