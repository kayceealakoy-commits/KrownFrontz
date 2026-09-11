/** Split long strings into Stripe metadata chunks (500 char limit per value). */
function chunkMetadata(prefix, value, maxChunks = 8, chunkSize = 500) {
  const str = String(value || "");
  const meta = {};
  let count = 0;
  for (let i = 0; i < maxChunks; i += 1) {
    const chunk = str.slice(i * chunkSize, (i + 1) * chunkSize);
    if (!chunk) break;
    count += 1;
    meta[`${prefix}_${i + 1}`] = chunk;
  }
  if (count) {
    meta[`${prefix}_parts`] = String(count);
  }
  return meta;
}

function joinMetadataChunks(metadata, prefix) {
  if (!metadata) return "";
  const partCount = parseInt(metadata[`${prefix}_parts`] || "0", 10);
  if (!partCount) return metadata[prefix] || "";
  let out = "";
  for (let i = 1; i <= partCount; i += 1) {
    out += metadata[`${prefix}_${i}`] || "";
  }
  return out;
}

module.exports = { chunkMetadata, joinMetadataChunks };
