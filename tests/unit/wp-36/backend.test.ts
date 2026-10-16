import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseBackend, isSoftwareAdapter } from '../../../src/scripts/visuals/backend.ts';
import type { AdapterLike, GpuLike } from '../../../src/scripts/visuals/backend.ts';

const gpuWith = (result: () => Promise<AdapterLike | null>): GpuLike => ({ requestAdapter: result });

test('a hardware adapter is not software', () => {
  assert.equal(isSoftwareAdapter({ info: { vendor: 'nvidia', architecture: 'ada', device: '', description: 'NVIDIA GeForce RTX 4070' } }), false);
  assert.equal(isSoftwareAdapter({}), false);
});

test('the browser fallback adapter and software rasterisers are software', () => {
  assert.equal(isSoftwareAdapter({ isFallbackAdapter: true }), true);
  assert.equal(isSoftwareAdapter({ info: { vendor: 'google', architecture: 'swiftshader', device: '', description: 'SwiftShader driver' } }), true);
  assert.equal(isSoftwareAdapter({ info: { description: 'llvmpipe (LLVM 17.0.6, 256 bits)' } }), true);
  assert.equal(isSoftwareAdapter({ info: { device: 'Microsoft Basic Render Driver' } }), true);
});

test('no navigator.gpu means WebGL2', async () => {
  assert.equal(await chooseBackend(undefined), 'webgl2');
});

test('no adapter means WebGL2', async () => {
  assert.equal(await chooseBackend(gpuWith(async () => null)), 'webgl2');
});

test('a software adapter means WebGL2 (the CPU would render the frame)', async () => {
  assert.equal(await chooseBackend(gpuWith(async () => ({ isFallbackAdapter: true }))), 'webgl2');
  assert.equal(await chooseBackend(gpuWith(async () => ({ info: { architecture: 'swiftshader' } }))), 'webgl2');
});

test('a hardware adapter means WebGPU, asked for with high performance', async () => {
  let asked: unknown;
  const gpu: GpuLike = {
    requestAdapter: async (options) => {
      asked = options;
      return { info: { vendor: 'apple', architecture: 'metal-3' } };
    },
  };
  assert.equal(await chooseBackend(gpu), 'webgpu');
  assert.deepEqual(asked, { powerPreference: 'high-performance' });
});

test('a rejected adapter request falls back to WebGL2 and warns instead of throwing', async () => {
  const warn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => void warnings.push(args);
  try {
    assert.equal(
      await chooseBackend(
        gpuWith(async () => {
          throw new Error('blocked');
        }),
      ),
      'webgl2',
    );
  } finally {
    console.warn = warn;
  }
  assert.equal(warnings.length, 1);
});
