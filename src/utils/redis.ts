import { createClient } from "redis";
import { config } from "../config/index";

class RedisService {
    private client;

    constructor() {
        this.client = createClient({
            url: config.redisUrl,
        });

        this.client.on("error", (err) => console.error("Redis Client Error", err));
    }

    async connect() {
        if (!this.client.isOpen) {
            await this.client.connect();
            console.log("✅ Redis Connected");
        }
    }

    async set(key: string, value: any, ttl?: number) {
        const stringValue = JSON.stringify(value);
        if (ttl) {
            await this.client.set(key, stringValue, { EX: ttl });
        } else {
            await this.client.set(key, stringValue);
        }
    }

    async get(key: string) {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
    }

    async del(key: string) {
        await this.client.del(key);
    }
}

export const redisService = new RedisService();
