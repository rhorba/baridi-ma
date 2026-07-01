import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

const handleReadingMock = vi.fn();
vi.mock("../src/ingest.js", () => ({ handleReading: handleReadingMock }));

class FakeMqttClient extends EventEmitter {
  subscribe = vi.fn((_topic: string, cb: (err: Error | null) => void) => cb(null));
}

const fakeClient = new FakeMqttClient();
const connectMock = vi.fn(() => fakeClient);
vi.mock("mqtt", () => ({ default: { connect: connectMock } }));

function fakeLogger() {
  return { error: vi.fn(), warn: vi.fn(), info: vi.fn() } as unknown as import("fastify").FastifyBaseLogger;
}

beforeEach(() => {
  handleReadingMock.mockReset();
  connectMock.mockClear();
  fakeClient.subscribe.mockClear();
  fakeClient.removeAllListeners();
});

describe("startMqttSubscriber", () => {
  it("subscribes to the sensor topic on connect", async () => {
    const { startMqttSubscriber } = await import("../src/mqtt-client.js");
    startMqttSubscriber({} as never, fakeLogger());
    fakeClient.emit("connect");
    expect(fakeClient.subscribe).toHaveBeenCalledWith("sensors/+/readings", expect.any(Function));
  });

  it("parses a valid JSON message and forwards it to handleReading", async () => {
    const { startMqttSubscriber } = await import("../src/mqtt-client.js");
    const pool = {} as never;
    startMqttSubscriber(pool, fakeLogger());
    handleReadingMock.mockResolvedValueOnce({ ok: true });

    fakeClient.emit("message", "sensors/d1/readings", Buffer.from(JSON.stringify({ deviceToken: "t", temperatureC: 4 })));
    await new Promise((r) => setTimeout(r, 10));

    expect(handleReadingMock).toHaveBeenCalledWith(pool, { deviceToken: "t", temperatureC: 4 });
  });

  it("logs a warning when handleReading rejects the message", async () => {
    const { startMqttSubscriber } = await import("../src/mqtt-client.js");
    const logger = fakeLogger();
    startMqttSubscriber({} as never, logger);
    handleReadingMock.mockResolvedValueOnce({ ok: false, reason: "unknown_device" });

    fakeClient.emit("message", "sensors/d1/readings", Buffer.from(JSON.stringify({ deviceToken: "t", temperatureC: 4 })));
    await new Promise((r) => setTimeout(r, 10));

    expect(logger.warn).toHaveBeenCalledWith({ reason: "unknown_device" }, "Reading not ingested");
  });

  it("discards a malformed (non-JSON) message without throwing", async () => {
    const { startMqttSubscriber } = await import("../src/mqtt-client.js");
    const logger = fakeLogger();
    startMqttSubscriber({} as never, logger);

    fakeClient.emit("message", "sensors/d1/readings", Buffer.from("not json"));
    await new Promise((r) => setTimeout(r, 10));

    expect(handleReadingMock).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("logs MQTT client errors", async () => {
    const { startMqttSubscriber } = await import("../src/mqtt-client.js");
    const logger = fakeLogger();
    startMqttSubscriber({} as never, logger);

    fakeClient.emit("error", new Error("connection refused"));
    expect(logger.error).toHaveBeenCalled();
  });
});
