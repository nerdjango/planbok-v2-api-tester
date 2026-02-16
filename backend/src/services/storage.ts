import fs from 'fs';
import path from 'path';
import { config } from '../config';

// Type definitions
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  walletSetId?: string;
  customerId?: string;
  createdAt: string;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: string;
}

export interface Challenge {
  id: string;
  userId: string;
  customerId: string;
  challengeId: string;
  type: string;
  status: 'pending' | 'completed' | 'failed';
  redirectUrl: string;
  result?: any;
  createdAt: string;
}

/**
 * Simple JSON file-based storage for demo purposes
 * Stores users, sessions, and challenges
 */
export class StorageService {
  private dataDir: string;

  constructor() {
    this.dataDir = config.dataDir;
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getFilePath(collection: string): string {
    return path.join(this.dataDir, `${collection}.json`);
  }

  private readCollection<T>(collection: string): T[] {
    const filePath = this.getFilePath(collection);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  }

  private writeCollection<T>(collection: string, data: T[]): void {
    const filePath = this.getFilePath(collection);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  // ================== Users ==================

  findUserByEmail(email: string): User | undefined {
    const users = this.readCollection<User>('users');
    return users.find((u) => u.email === email);
  }

  findUserById(id: string): User | undefined {
    const users = this.readCollection<User>('users');
    return users.find((u) => u.id === id);
  }

  createUser(user: User): User {
    const users = this.readCollection<User>('users');
    users.push(user);
    this.writeCollection('users', users);
    return user;
  }

  updateUser(id: string, updates: Partial<User>): User | undefined {
    const users = this.readCollection<User>('users');
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return undefined;
    users[index] = { ...users[index], ...updates };
    this.writeCollection('users', users);
    return users[index];
  }

  // ================== Sessions ==================

  findSession(token: string): Session | undefined {
    const sessions = this.readCollection<Session>('sessions');
    const session = sessions.find((s) => s.token === token);
    if (session && new Date(session.expiresAt) < new Date()) {
      this.deleteSession(token);
      return undefined;
    }
    return session;
  }

  createSession(session: Session): Session {
    const sessions = this.readCollection<Session>('sessions');
    sessions.push(session);
    this.writeCollection('sessions', sessions);
    return session;
  }

  deleteSession(token: string): boolean {
    const sessions = this.readCollection<Session>('sessions');
    const filtered = sessions.filter((s) => s.token !== token);
    if (filtered.length === sessions.length) return false;
    this.writeCollection('sessions', filtered);
    return true;
  }

  // ================== Challenges ==================

  findChallenge(id: string): Challenge | undefined {
    const challenges = this.readCollection<Challenge>('challenges');
    return challenges.find((c) => c.id === id);
  }

  findChallengesByUser(userId: string): Challenge[] {
    const challenges = this.readCollection<Challenge>('challenges');
    return challenges.filter((c) => c.userId === userId);
  }

  createChallenge(challenge: Challenge): Challenge {
    const challenges = this.readCollection<Challenge>('challenges');
    challenges.push(challenge);
    this.writeCollection('challenges', challenges);
    return challenge;
  }

  updateChallenge(id: string, updates: Partial<Challenge>): Challenge | undefined {
    const challenges = this.readCollection<Challenge>('challenges');
    const index = challenges.findIndex((c) => c.id === id);
    if (index === -1) return undefined;
    challenges[index] = { ...challenges[index], ...updates };
    this.writeCollection('challenges', challenges);
    return challenges[index];
  }
}

// Singleton instance
export const storageService = new StorageService();
