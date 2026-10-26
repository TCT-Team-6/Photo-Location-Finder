import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { mock, test } from "node:test";
import type { File } from "@google-cloud/storage";

mock.module("./objectAcl.js", {
  namedExports: {
    ObjectPermission: { READ: "read", WRITE: "write" },
    canAccessObject: async () => true,
    getObjectAclPolicy: async () => ({ visibility: "private" }),
    setObjectAclPolicy: async () => {},
  },
});
const { ObjectStorageService } = await import("./objectStorage.js");
const storage = new ObjectStorageService();
let streamRange: { start?: number; end?: number } | undefined;
const bytes = Buffer.from("0123456789");
const file = {
  getMetadata: async () => [{ size: "10", contentType: "video/mp4" }],
  createReadStream: (range?: { start?: number; end?: number }) => {
    streamRange = range;
    return Readable.from([range ? bytes.subarray(range.start, range.end! + 1) : bytes]);
  },
} as unknown as File;

test("saved media supports private full downloads and byte-range seeking", async () => {
  let response = await storage.downloadObject(file);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "video/mp4");
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.match(response.headers.get("cache-control")!, /^private/);
  assert.equal(await response.text(), "0123456789");
  response = await storage.downloadObject(file, 3600, "bytes=3-5");
  assert.equal(response.status, 206);
  assert.deepEqual(streamRange, { start: 3, end: 5 });
  assert.equal(response.headers.get("content-range"), "bytes 3-5/10");
  assert.equal(response.headers.get("content-length"), "3");
  assert.equal(await response.text(), "345");
});

test("open-ended and suffix video ranges work and invalid ranges return 416", async () => {
  let response = await storage.downloadObject(file, 3600, "bytes=8-");
  assert.equal(await response.text(), "89");
  response = await storage.downloadObject(file, 3600, "bytes=-2");
  assert.equal(await response.text(), "89");
  for (const range of ["bytes=10-", "bytes=5-2", "bytes=-0", "bytes=0-1,4-5", "not-a-range", "bytes=-"]) {
    response = await storage.downloadObject(file, 3600, range);
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get("content-range"), "bytes */10");
  }
});
