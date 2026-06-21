import assert from "node:assert/strict";
import test from "node:test";
import { SOCKET_CHANNEL, SOCKET_EVENTS } from "../src/constants.js";
import { SocketHandler } from "../src/SocketHandler.js";

test("SocketHandler registers, emits, imports, refreshes, and ignores unknown events", async () => {
  const calls = [];
  const game = {
    socket: {
      on(channel, callback) {
        calls.push(["on", channel]);
        this.callback = callback;
      },
      emit(channel, payload) {
        calls.push(["emit", channel, payload]);
      }
    }
  };
  const imported = [];
  const handler = new SocketHandler({
    game,
    dataManager: { importData: async (data) => imported.push(data) },
    uiManager: { renderOpenWindows: () => calls.push(["render"]) }
  });
  assert.equal(handler.register(), true);
  assert.deepEqual(calls[0], ["on", SOCKET_CHANNEL]);
  assert.deepEqual(handler.emit(SOCKET_EVENTS.REFRESH_HUB, { ok: true }, ["gm"]), {
    event: SOCKET_EVENTS.REFRESH_HUB,
    data: { ok: true },
    recipients: ["gm"]
  });
  await game.socket.callback({ event: SOCKET_EVENTS.REFRESH_HUB });
  await handler.receive({ event: SOCKET_EVENTS.IMPORT_DATA, data: { triggers: [] } });
  assert.deepEqual(imported, [{ triggers: [] }]);
  assert.equal(await handler.receive({ event: "unknown" }), false);
});

test("SocketHandler reports unavailable socket registration", () => {
  assert.equal(new SocketHandler({ game: {} }).register(), false);
});

