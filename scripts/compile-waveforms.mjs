import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bins = 128,
  width = 768,
  height = 144,
  center = height / 2,
  halfHeight = 60;
const hash = (body) => createHash('sha256').update(body).digest('hex');
const number = (value) => String(Number(value.toFixed(3)));

function readFloatWave(body, id) {
  assert.equal(body.toString('ascii', 0, 4), 'RIFF', `A${id}: RIFF header required.`);
  assert.equal(body.toString('ascii', 8, 12), 'WAVE', `A${id}: WAVE header required.`);
  const limit = body.readUInt32LE(4) + 8;
  assert.equal(limit, body.length, `A${id}: RIFF length mismatch.`);
  let format, data;
  for (let offset = 12; offset + 8 <= limit; ) {
    const kind = body.toString('ascii', offset, offset + 4);
    const length = body.readUInt32LE(offset + 4),
      start = offset + 8,
      end = start + length;
    assert(end <= limit, `A${id}: ${kind} chunk leaves the RIFF payload.`);
    if (kind === 'fmt ') {
      assert(length >= 16, `A${id}: incomplete audio format.`);
      format = {
        code: body.readUInt16LE(start),
        channels: body.readUInt16LE(start + 2),
        sampleRate: body.readUInt32LE(start + 4),
        blockAlign: body.readUInt16LE(start + 12),
        bits: body.readUInt16LE(start + 14),
      };
    } else if (kind === 'data') {
      assert(!data, `A${id}: duplicate audio data.`);
      data = body.subarray(start, end);
    }
    offset = end + (length % 2);
  }
  assert(format && data?.length, `A${id}: missing format or data.`);
  assert.equal(format.code, 3, `A${id}: expected IEEE float audio.`);
  assert.equal(format.channels, 1, `A${id}: expected mono audio.`);
  assert.equal(format.bits, 32, `A${id}: expected float32 samples.`);
  assert.equal(format.blockAlign, 4, `A${id}: invalid frame alignment.`);
  assert.equal(data.length % format.blockAlign, 0, `A${id}: incomplete frame.`);
  const frames = data.length / 4;
  assert(frames >= bins && format.sampleRate > 0, `A${id}: incomplete audio.`);
  const values = new Float32Array(frames);
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    const value = data.readFloatLE(i * 4);
    assert(Number.isFinite(value), `A${id}: non-finite sample at ${i}.`);
    values[i] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  const envelope = Array.from({ length: bins }, (_, i) => {
    const first = Math.floor((i * frames) / bins),
      end = Math.floor(((i + 1) * frames) / bins);
    let maximum = 0;
    for (let frame = first; frame < end; frame++)
      maximum = Math.max(maximum, Math.abs(values[frame]));
    return maximum;
  });
  return {
    frames,
    sampleRate: format.sampleRate,
    duration: frames / format.sampleRate,
    peak,
    envelope,
  };
}

function waveformSVG(id, sourceHash, audio) {
  const heights = audio.envelope.map((peak) => (audio.peak ? (peak / audio.peak) * halfHeight : 0));
  const pitch = width / bins;
  let envelope = `M0 ${number(center - heights[0])}`;
  for (let i = 0; i < bins; i++)
    envelope += `H${number((i + 1) * pitch)}${i + 1 < bins ? `V${number(center - heights[i + 1])}` : ''}`;
  envelope += `V${number(center + heights.at(-1))}`;
  for (let i = bins - 1; i >= 0; i--)
    envelope += `H${number(i * pitch)}${i > 0 ? `V${number(center + heights[i - 1])}` : ''}`;
  envelope += 'Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title description" data-audio-sha256="${sourceHash}" data-duration="${audio.duration}" data-bins="${bins}"><title id="title">Audio A${id}</title><desc id="description">${number(audio.duration)} seconds. Equal-time peak envelope, normalized to this clip's maximum amplitude.</desc><path d="M0 ${center}H${width}" fill="none" stroke="#e3e6e8" stroke-width="1" vector-effect="non-scaling-stroke"/><path d="${envelope}" fill="#9aa1a8"/></svg>\n`;
}

// Deterministic vectors: the WAV bytes are never changed. The same compiler
// validates published assets so no browser decoder or external library is needed.
export async function compileWaveforms(root = siteRoot, { check = false } = {}) {
  const directory = resolve(root, 'assets/waveforms');
  if (!check) await mkdir(directory, { recursive: true });
  const records = [];
  for (let id = 13; id <= 37; id++) {
    const source = `assets/audio/A${id}.wav`,
      path = `assets/waveforms/A${id}.svg`;
    const body = await readFile(resolve(root, source)),
      sourceHash = hash(body),
      audio = readFloatWave(body, id);
    const svg = waveformSVG(id, sourceHash, audio);
    if (check)
      assert.equal(
        await readFile(resolve(root, path), 'utf8'),
        svg,
        `${path}: waveform does not match its source audio.`,
      );
    else await writeFile(resolve(root, path), svg, 'utf8');
    records.push({
      id,
      path,
      source,
      source_sha256: sourceHash,
      sha256: hash(svg),
      frames: audio.frames,
      sample_rate: audio.sampleRate,
      duration_seconds: audio.duration,
      peak_amplitude: audio.peak,
      bins,
      viewBox: [0, 0, width, height],
    });
  }
  const manifest =
    JSON.stringify(
      {
        method:
          'Equal-time maximum absolute amplitude; linear per-clip peak normalization; all frames included; source WAV unchanged.',
        records,
      },
      null,
      2,
    ) + '\n';
  if (check)
    assert.equal(
      await readFile(resolve(directory, 'manifest.json'), 'utf8'),
      manifest,
      'Waveform provenance is stale.',
    );
  else await writeFile(resolve(directory, 'manifest.json'), manifest, 'utf8');
  const metadata =
    '// Generated from original WAV headers. Run npm run waveforms.\nexport const audioDurations = Object.freeze(' +
    JSON.stringify(
      Object.fromEntries(records.map((record) => [record.id, record.duration_seconds])),
    ) +
    ');\n';
  if (check)
    assert.equal(
      await readFile(resolve(root, 'audio-data.js'), 'utf8'),
      metadata,
      'Audio duration metadata is stale.',
    );
  else await writeFile(resolve(root, 'audio-data.js'), metadata, 'utf8');
  const provenanceFile = resolve(root, 'assets/provenance.json');
  const provenance = JSON.parse(await readFile(provenanceFile, 'utf8'));
  const derived = records.map((record) => ({
    path: record.path,
    source: record.source,
    related_paths: [record.source],
    source_sha256: record.source_sha256,
    sha256: record.sha256,
    encoding: 'Self-contained SVG peak envelope',
    duration_seconds: record.duration_seconds,
    bins,
    processing:
      'All float32 audio frames included in equal-time windows. Maximum absolute amplitude per window, normalized linearly to the clip peak; source audio unchanged. No smoothing, compression or minimum amplitude.',
  }));
  if (check)
    assert.deepEqual(
      provenance.filter((record) => record.path.startsWith('assets/waveforms/')),
      derived,
      'Derived waveform provenance is stale.',
    );
  else
    await writeFile(
      provenanceFile,
      JSON.stringify(
        [
          ...provenance.filter((record) => !record.path.startsWith('assets/waveforms/')),
          ...derived,
        ],
        null,
        2,
      ) + '\n',
      'utf8',
    );
  return records;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const records = await compileWaveforms(siteRoot, { check });
  console.log(
    `${check ? 'Verified' : 'Rendered'} ${records.length} vector waveforms from authentic float32 WAV files.`,
  );
}
