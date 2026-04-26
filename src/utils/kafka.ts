import { Kafka, Producer, Consumer } from "kafkajs";
import { config } from "../config/index";

class KafkaService {
    private kafka: Kafka;
    private producer: Producer;
    private consumer: Consumer;

    private callbacks: Map<string, (data: any) => Promise<void>> = new Map();
    private isRunning: boolean = false;

    private connectionPromise: Promise<void> | null = null;

    constructor() {
        this.kafka = new Kafka({
            clientId: "pick-my-pit-service",
            brokers: config.kafkaBrokers,
            retry: {
                initialRetryTime: 100,
                retries: 8
            }
        });
        this.producer = this.kafka.producer();
        this.consumer = this.kafka.consumer({ groupId: "project-group" });
    }

    async connect() {
        if (this.connectionPromise) return this.connectionPromise;

        this.connectionPromise = (async () => {
            try {
                await this.producer.connect();
                await this.consumer.connect();
                console.log("✅ Kafka Connected");
            } catch (error) {
                this.connectionPromise = null;
                console.error("❌ Kafka Connection Error:", error);
                throw error;
            }
        })();

        return this.connectionPromise;
    }

    async send(topic: string, message: any) {
        try {
            await this.producer.send({
                topic,
                messages: [{ value: JSON.stringify(message) }],
            });
        } catch (error) {
            console.error(`❌ Failed to send message to ${topic}:`, error);
        }
    }

    async subscribe(topic: string, callback: (message: any) => Promise<void>) {
        let subscribed = false;
        let retries = 5;

        while (!subscribed && retries > 0) {
            try {
                await this.consumer.subscribe({ topic, fromBeginning: true });
                subscribed = true;
            } catch (error: any) {
                if (error.type === 'UNKNOWN_TOPIC_OR_PARTITION') {
                    console.warn(`⏳ Topic "${topic}" not found. Kafka might be auto-creating it. Retrying in 3s... (${retries} left)`);
                    await new Promise(res => setTimeout(res, 3000));
                    retries--;
                } else {
                    throw error;
                }
            }
        }

        if (!subscribed) {
            console.error(`❌ Forced to skip subscription for topic "${topic}" after multiple retries.`);
            return;
        }

        this.callbacks.set(topic, callback);

        if (!this.isRunning) {
            this.isRunning = true;
            await this.consumer.run({
                eachMessage: async ({ topic: receivedTopic, message }) => {
                    if (message.value) {
                        try {
                            const data = JSON.parse(message.value.toString());
                            const cb = this.callbacks.get(receivedTopic);
                            if (cb) {
                                await cb(data);
                            }
                        } catch (err) {
                            console.error(`❌ Error processing message on topic ${receivedTopic}:`, err);
                        }
                    }
                },
            });
        }
    }
}

export const kafkaService = new KafkaService();
